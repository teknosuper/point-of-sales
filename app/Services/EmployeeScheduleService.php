<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeSchedule;
use App\Models\EmployeeShift;
use Carbon\Carbon;
use Carbon\CarbonImmutable;

class EmployeeScheduleService
{
    /**
     * Acuan tanggal untuk perhitungan rotasi yang stabil antar hari.
     */
    private const ROTATION_EPOCH = '2000-01-01';

    /**
     * Generate jadwal dengan rotasi adil + peraturan libur yang dapat dikonfigurasi.
     *
     * Aturan libur (lihat EmployeeScheduleConfig):
     *  - setiap pegawai aktif mendapat jatah libur `day_off_per_week` hari per pekan;
     *  - libur TIDAK boleh jatuh pada hari yang terdaftar di `blocked_weekdays`
     *    (mis. Jumat/Sabtu/Minggu);
     *  - pada hari terlarang libur, semua pegawai bekerja (bila pegawai > shift,
     *    satu slot shift boleh dipakai oleh lebih dari satu pegawai).
     *
     * @return array{generated_dates: int, generated_rows: int, skipped_dates: int}
     */
    public function generate(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?string $jobType = null,
        bool $overwrite = false
    ): array {
        $start = $start->startOfDay();
        $end = $end->startOfDay();

        if ($start->greaterThan($end)) {
            throw new \InvalidArgumentException('Tanggal mulai tidak boleh melewati tanggal selesai.');
        }

        $generatedDates = 0;
        $generatedRows = 0;
        $skippedDates = 0;

        if ($overwrite) {
            $query = EmployeeSchedule::query()->whereBetween('schedule_date', [$start, $end]);

            if ($jobType) {
                $query->whereHas('employee', fn ($q) => $q->where('job_type', $jobType));
            }

            $query->delete();
        }

        $jobTypes = $jobType
            ? [$jobType]
            : Employee::query()->where('is_active', true)->distinct()->orderBy('job_type')->pluck('job_type')->all();

        if (! $jobTypes) {
            return [
                'generated_dates' => 0,
                'generated_rows' => 0,
                'skipped_dates' => 0,
            ];
        }

        $shifts = EmployeeShift::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $shiftCount = $shifts->count();

        $epoch = Carbon::parse(self::ROTATION_EPOCH);

        // --- Fase 1: bangun peta libur per tanggal per jenis pekerjaan (per pekan) ---
        $config = \App\Models\EmployeeScheduleConfig::rule();
        $blocked = $config->blockedDays();
        $quota = (int) $config->day_off_per_week;

        $offPlan = [];

        $weekStartCursor = $start->copy()->startOfWeek(Carbon::MONDAY);

        while ($weekStartCursor->lte($end)) {
            $weekStartDate = $weekStartCursor->copy();
            $weekEndDate = $weekStartCursor->copy()->addDays(6);
            $loopStartDate = $start->copy()->max($weekStartDate);
            $loopEndDate = $end->copy()->min($weekEndDate);
            $weekIndex = abs(intdiv($weekStartDate->diffInDays($epoch), 7));

            // Aturan libur hanya diberlakukan untuk pekan penuh (Senin s/d Minggu
            // seluruhnya masuk rentang). Pekan parsial (awal/akhir) tidak memaksa libur.
            $isFullWeek = $loopStartDate->eq($weekStartDate) && $loopEndDate->eq($weekEndDate);

            foreach ($jobTypes as $type) {
                $employees = Employee::query()
                    ->where('job_type', $type)
                    ->where('is_active', true)
                    ->orderBy('rotation_order')
                    ->orderBy('name')
                    ->get();

                $count = $employees->count();

                if ($count === 0) {
                    continue;
                }

                $allowedDates = [];

                for ($d = $loopStartDate; $d->lte($loopEndDate); $d = $d->addDay()) {
                    if (! in_array($d->dayOfWeek, $blocked, true)) {
                        $allowedDates[] = $d->toDateString();
                    }
                }

                $allowedCount = count($allowedDates);
                $quotaEffective = ($isFullWeek && $allowedCount > 0)
                    ? min(max($quota, 0), $allowedCount)
                    : 0;
                $cursorIndex = $count > 0 ? $weekIndex % $count : 0;

                foreach ($this->buildOffPattern($allowedDates, $count, $quotaEffective, $cursorIndex) as $dateKey => $indices) {
                    $offPlan[$dateKey][$type] = array_map(
                        fn ($index) => $employees[$index]->id,
                        $indices
                    );
                }
            }

            $weekStartCursor = $weekStartCursor->addDays(7);
        }

        // --- Fase 2: terapkan jadwal per tanggal ---
        for ($date = $start; $date->lte($end); $date = $date->addDay()) {
            $dateKey = $date->toDateString();
            $dayNumber = abs($date->diffInDays($epoch));
            $rowsForDate = 0;
            $sawExisting = false;

            foreach ($jobTypes as $type) {
                $employees = Employee::query()
                    ->where('job_type', $type)
                    ->where('is_active', true)
                    ->orderBy('rotation_order')
                    ->orderBy('name')
                    ->get();

                $count = $employees->count();

                if ($count === 0) {
                    continue;
                }

                $existing = EmployeeSchedule::query()
                    ->whereDate('schedule_date', $dateKey)
                    ->whereIn('employee_id', $employees->pluck('id'))
                    ->get()
                    ->keyBy('employee_id');

                if ($existing->isNotEmpty()) {
                    $sawExisting = true;
                }

                if ($existing->count() >= $count) {
                    continue;
                }

                $offEmployeeIds = array_map('intval', $offPlan[$dateKey][$type] ?? []);

                $newWorkers = [];

                for ($step = 0; $step < $count; $step++) {
                    $employee = $employees[($dayNumber + $step) % $count];

                    if ($existing->has($employee->id)) {
                        continue;
                    }

                    if (in_array($employee->id, $offEmployeeIds, true)) {
                        EmployeeSchedule::create([
                            'schedule_date' => $dateKey,
                            'employee_id' => $employee->id,
                            'shift_id' => null,
                            'status' => \App\Models\EmployeeSchedule::STATUS_LIBUR,
                        ]);

                        $rowsForDate++;

                        continue;
                    }

                    $newWorkers[] = $employee->id;
                }

                $occupiedShifts = $existing->pluck('shift_id')->filter();

                foreach (array_unique($newWorkers) as $workerId) {
                    $shift = null;

                    for ($slot = 0; $slot < $shiftCount; $slot++) {
                        $candidate = ($slot + $dayNumber) % $shiftCount;

                        if (! $occupiedShifts->contains($shifts[$candidate]->id)) {
                            $shift = $shifts[$candidate];
                            break;
                        }
                    }

                    // Bila semua shift terpakai (pegawai > shift), duplikasi shift.
                    $shift ??= $shiftCount > 0 ? $shifts[$dayNumber % $shiftCount] : null;

                    if ($shift) {
                        $occupiedShifts->push($shift->id);
                    }

                    EmployeeSchedule::create([
                        'schedule_date' => $dateKey,
                        'employee_id' => $workerId,
                        'shift_id' => $shift?->id,
                        'status' => \App\Models\EmployeeSchedule::STATUS_MASUK,
                    ]);

                    $rowsForDate++;
                }
            }

            if ($rowsForDate > 0) {
                $generatedDates++;
                $generatedRows += $rowsForDate;
            } elseif ($sawExisting) {
                $skippedDates++;
            }
        }

        return [
            'generated_dates' => $generatedDates,
            'generated_rows' => $generatedRows,
            'skipped_dates' => $skippedDates,
        ];
    }

    /**
     * Sebar jatah libur secara merata di antara hari yang diizinkan.
     *
     * Setiap pegawai (indeks 0..count-1) mendapat tepat `$quota` hari libur,
     * tersebar ke hari-hari `$allowedDates` secara bergilir berkat `$cursor`.
     *
     * @param  string[]  $allowedDates  daftar tanggal (Y-m-d) yang boleh libur
     * @return array<string, int[]> peta tanggal -> indeks pegawai yang libur
     */
    private function buildOffPattern(array $allowedDates, int $count, int $quota, int $cursor): array
    {
        $map = [];
        foreach ($allowedDates as $date) {
            $map[$date] = [];
        }

        if ($quota <= 0 || count($allowedDates) === 0 || $count === 0) {
            return $map;
        }

        $slots = array_fill(0, count($allowedDates), 0);
        $usedPerEmployee = array_fill(0, $count, []);
        $totalOffs = $count * $quota;

        for ($turn = 0; $turn < $totalOffs; $turn++) {
            $employee = ($turn + $cursor) % $count;
            $best = null;
            $bestScore = PHP_INT_MAX;

            for ($j = 0, $m = count($allowedDates); $j < $m; $j++) {
                if (in_array($j, $usedPerEmployee[$employee], true)) {
                    continue;
                }

                $score = $slots[$j] * 1000 + $j;

                if ($score < $bestScore) {
                    $bestScore = $score;
                    $best = $j;
                }
            }

            if ($best === null) {
                continue;
            }

            $usedPerEmployee[$employee][] = $best;
            $slots[$best]++;
            $map[$allowedDates[$best]][] = $employee;
        }

        return $map;
    }

    /**
     * Bangun payload papan jadwal (grup per jenis pekerjaan + shift) untuk rentang tanggal.
     *
     * Dipakai oleh halaman dashboard maupun halaman public agar bentuk data konsisten.
     *
     * @return array{groups: array, shifts: \Illuminate\Support\Collection}
     */
    public function boardPayload(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $employees = Employee::query()
            ->where(function ($query) use ($start, $end) {
                $query->where('is_active', true)
                    ->orWhereHas('schedules', fn ($s) => $s->whereBetween('schedule_date', [$start, $end]));
            })
            ->with(['schedules' => fn ($s) => $s->whereBetween('schedule_date', [$start, $end])->with('shift:id,name,start_time,end_time')])
            ->orderBy('job_type')
            ->orderBy('rotation_order')
            ->orderBy('name')
            ->get();

        $groups = $employees
            ->groupBy('job_type')
            ->map(function ($emps) {
                return [
                    'job_type' => $emps->first()->job_type,
                    'employees' => $emps->map(fn (Employee $e) => [
                        'id' => $e->id,
                        'name' => $e->name,
                        'phone' => $e->phone,
                        'rotation_order' => $e->rotation_order,
                        'is_active' => $e->is_active,
                        'schedules' => $e->schedules->mapWithKeys(fn ($s) => [
                            $s->schedule_date->toDateString() => [
                                'id' => $s->id,
                                'shift_id' => $s->shift_id,
                                'status' => $s->status,
                                'name' => $s->shift?->name,
                                'start_time' => $s->shift?->start_time,
                                'end_time' => $s->shift?->end_time,
                            ],
                        ])->all(),
                    ])->values()->all(),
                ];
            })
            ->values()
            ->all();

        $shifts = EmployeeShift::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'name', 'start_time', 'end_time', 'sort_order', 'is_active']);

        return [
            'groups' => $groups,
            'shifts' => $shifts,
        ];
    }
}
