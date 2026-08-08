<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeSchedule;
use App\Models\EmployeeShift;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;

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
     * Peraturan kru shift malam:
     *  - shift malam adalah shift terakhir (sort_order tertinggi);
     *  - bila pegawai > shift, kelebihan pegawai jatuh ke shift malam;
     *  - setelah libur, pegawai wajib masuk shift malam di hari kerja berikutnya
     *    (dapat dimatikan via `night_after_off`);
     *  - setiap pegawai maksimal `max_night_per_week` shift malam per pekan.
     *
     * Shift prioritas:
     *  - saat pegawai > shift, pegawai berlebih ditempatkan di `priority_shift_id`
     *    (default: shift terakhir / malam).
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
        $nightAfterOff = (bool) $config->night_after_off;
        $maxNightPerWeek = (int) $config->max_night_per_week;
        $priorityShiftId = $config->priority_shift_id ? (int) $config->priority_shift_id : null;

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

                $workers = [];

                for ($step = 0; $step < $count; $step++) {
                    $index = ($dayNumber + $step) % $count;
                    $employee = $employees[$index];

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

                    $workers[$index] = $employee;
                }

                // Urutkan pekerja menurut indeks asli (rotation_order) agar rotasi
                // penugasan shift TIDAK sinkron dengan rotasi urutan pekerja harian.
                // Bila keduanya berputar bersama, karyawan yang sama bisa terus
                // mendapat shift yang sama (mis. selalu Pagi / selalu Malam).
                ksort($workers);
                $workerList = array_values($workers);
                $workerCount = count($workerList);

                // Peraturan kru: shift malam = shift terakhir (sort_order tertinggi).
                $nightShift = $shiftCount > 0 ? $shifts->last() : null;
                $nightShiftId = $nightShift?->id;

                // Hitung jumlah shift malam per karyawan pada pekan berjalan
                // (termasuk jadwal lama) agar batas `max_night_per_week` konsisten.
                $nightCountByEmployee = [];
                if ($nightShiftId && $maxNightPerWeek > 0) {
                    $weekStartDate = $date->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
                    $weekEndDate = $date->copy()->startOfWeek(Carbon::MONDAY)->addDays(6)->toDateString();

                    $nightCountByEmployee = EmployeeSchedule::query()
                        ->whereBetween('schedule_date', [$weekStartDate, $weekEndDate])
                        ->where('shift_id', $nightShiftId)
                        ->whereIn('employee_id', $employees->pluck('id'))
                        ->selectRaw('employee_id, COUNT(*) as total')
                        ->groupBy('employee_id')
                        ->pluck('total', 'employee_id')
                        ->all();
                }

                // Peraturan kru: setelah libur, wajib masuk shift malam hari berikutnya.
                $offYesterdayIds = [];
                if ($nightAfterOff && $nightShiftId) {
                    $offYesterdayIds = EmployeeSchedule::query()
                        ->whereDate('schedule_date', $date->copy()->subDay()->toDateString())
                        ->whereIn('employee_id', $employees->pluck('id'))
                        ->whereNull('shift_id')
                        ->pluck('employee_id')
                        ->map(fn ($id) => (int) $id)
                        ->all();
                }

                $occupiedShifts = $existing->pluck('shift_id')->filter();

                // Prioritas: karyawan yang kemarin libur ditempatkan ke shift malam
                // (selama belum melebihi batas malam per pekan).
                $assignments = [];
                $remainingWorkers = [];

                foreach ($workerList as $index => $employee) {
                    $isOffYesterday = in_array((int) $employee->id, $offYesterdayIds, true);
                    $nightCount = (int) ($nightCountByEmployee[$employee->id] ?? 0);
                    $canNight = $nightShiftId !== null
                        && ($maxNightPerWeek <= 0 || $nightCount < $maxNightPerWeek);

                    if ($isOffYesterday && $canNight) {
                        $assignments[$employee->id] = $nightShiftId;
                        $occupiedShifts->push($nightShiftId);
                        $nightCountByEmployee[$employee->id] = $nightCount + 1;

                        continue;
                    }

                    $remainingWorkers[$index] = $employee;
                }

                // Sisa pekerja disebar ke shift yang tersisa. Contoh:
                // 2 pekerja dengan 3 shift → shift 1 dan shift 3, bukan 1 & 2.
                // Kelebihan pekerja (pegawai > shift) ditempatkan di shift prioritas
                // (konfigurasi `priority_shift_id`; default shift terakhir),
                // tetapi shift malam TIDAK diberikan bila batas per pekan tercapai.
                $priorityIndex = $this->resolvePriorityShiftIndex($shifts, $priorityShiftId);

                $remainingCount = count($remainingWorkers);
                $normalCount = min($remainingCount, $shiftCount);
                $overflowCount = $remainingCount - $normalCount;
                $i = 0;

                foreach ($remainingWorkers as $employee) {
                    $shift = null;
                    $nightCount = (int) ($nightCountByEmployee[$employee->id] ?? 0);

                    if ($shiftCount <= 0) {
                        $assignments[$employee->id] = null;
                        $i++;

                        continue;
                    }

                    // Pegawai "normal" disebar merata ke daftar shift terlebih dahulu.
                    if ($i < $normalCount) {
                        $base = (int) round($i * $shiftCount / max($normalCount, 1));
                        $offset = $dayNumber % $shiftCount;

                        for ($t = 0; $t < $shiftCount; $t++) {
                            $candidate = ($base + $offset + $t) % $shiftCount;
                            $candidateShift = $shifts[$candidate];

                            if ($candidateShift->id === $nightShiftId
                                && $maxNightPerWeek > 0
                                && $nightCount >= $maxNightPerWeek) {
                                continue;
                            }

                            if (! $occupiedShifts->contains($candidateShift->id)) {
                                $shift = $candidateShift;
                                break;
                            }
                        }

                        // Bila semua shift terpakai (pegawai > shift), duplikasi shift.
                        if (! $shift) {
                            for ($t = 0; $t < $shiftCount; $t++) {
                                $candidate = ($base + $offset + $t) % $shiftCount;
                                $candidateShift = $shifts[$candidate];

                                if ($candidateShift->id === $nightShiftId
                                    && $maxNightPerWeek > 0
                                    && $nightCount >= $maxNightPerWeek) {
                                    continue;
                                }

                                $shift = $candidateShift;
                                break;
                            }
                        }
                    }

                    // Kelebihan pegawai ditempatkan di shift prioritas.
                    if ($i >= $normalCount && $overflowCount > 0) {
                        $priorityShift = $shifts[$priorityIndex];

                        if ($priorityShift->id === $nightShiftId
                            && $maxNightPerWeek > 0
                            && $nightCount >= $maxNightPerWeek) {
                            // Shift prioritas adalah shift malam dan batas sudah penuh:
                            // cari shift lain yang masih mungkin dipakai.
                            for ($t = 0; $t < $shiftCount; $t++) {
                                $candidate = ($priorityIndex + $t) % $shiftCount;
                                $candidateShift = $shifts[$candidate];

                                if ($candidateShift->id === $nightShiftId
                                    && $maxNightPerWeek > 0
                                    && $nightCount >= $maxNightPerWeek) {
                                    continue;
                                }

                                $shift = $candidateShift;
                                break;
                            }

                            $shift ??= $priorityShift;
                        } else {
                            $shift = $priorityShift;
                        }
                    }

                    if ($shift) {
                        $occupiedShifts->push($shift->id);

                        if ($nightShiftId && $shift->id === $nightShiftId) {
                            $nightCountByEmployee[$employee->id] = $nightCount + 1;
                        }

                        $assignments[$employee->id] = $shift->id;
                    } else {
                        $assignments[$employee->id] = null;
                    }

                    $i++;
                }

                foreach ($assignments as $employeeId => $shiftId) {
                    EmployeeSchedule::create([
                        'schedule_date' => $dateKey,
                        'employee_id' => $employeeId,
                        'shift_id' => $shiftId,
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
     * Tentukan indeks shift prioritas (shift yang menampung kelebihan pegawai).
     *
     * Bila `priority_shift_id` terisi dan shift tersebut ada, indeksnya dipakai.
     * Default: shift terakhir (sort_order tertinggi) — e.g. shift malam.
     */
    private function resolvePriorityShiftIndex(Collection $shifts, ?int $priorityShiftId): int
    {
        if ($priorityShiftId !== null && $priorityShiftId > 0) {
            $index = $shifts->search(fn ($shift) => (int) $shift->id === $priorityShiftId);

            if ($index !== false) {
                return $index;
            }
        }

        return $shifts->count() - 1;
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
