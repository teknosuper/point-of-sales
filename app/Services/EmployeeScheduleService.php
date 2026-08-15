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
        $rangeStartWeek = $weekStartCursor->copy();

        while ($weekStartCursor->lte($end)) {
            $weekStartDate = $weekStartCursor->copy();
            $weekEndDate = $weekStartCursor->copy()->addDays(6);
            $loopStartDate = $start->copy()->max($weekStartDate);
            $loopEndDate = $end->copy()->min($weekEndDate);
            $weekIndex = abs(intdiv($weekStartDate->diffInDays($epoch), 7));

            // Aturan libur hanya diberlakukan untuk pekan penuh (Senin s/d Minggu
            // seluruhnya masuk rentang). Pekan parsial (awal/akhir) tidak memaksa libur.
            $isFullWeek = $loopStartDate->eq($weekStartDate) && $loopEndDate->eq($weekEndDate);

            // Bila rentang mulai di tengah pekan (mis. Jumat), off-plan pekan
            // tersebut tetap dihitung untuk Senin s/d Minggu penuh. Hari Senin-Kamis
            // sebelum `$start` ikut diperhitungkan (libur + beban shift malam)
            // walau barisnya tidak ditulis ke database.
            $startsMidWeek = $weekStartDate->eq($rangeStartWeek) && $loopStartDate->gt($weekStartDate);
            $planStartDate = $startsMidWeek ? $weekStartDate : $loopStartDate;

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

                for ($d = $planStartDate; $d->lte($loopEndDate); $d = $d->addDay()) {
                    if (! in_array($d->dayOfWeek, $blocked, true)) {
                        $allowedDates[] = $d->toDateString();
                    }
                }

                $allowedCount = count($allowedDates);
                $quotaEffective = (($isFullWeek || $startsMidWeek) && $allowedCount > 0)
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
        // Iterasi dimulai dari Senin pekan `$start` (bukan dari `$start`) agar
        // hari Senin-Kamis sebelum `$start` ikut dihitung sebagai konteks libur
        // dan beban shift malam. Baris hanya ditulis untuk tanggal >= `$start`.
        $computedByDate = [];
        $effectiveStart = $start->copy()->startOfWeek(Carbon::MONDAY);

        for ($date = $effectiveStart; $date->lte($end); $date = $date->addDay()) {
            $dateKey = $date->toDateString();
            $writeDate = $date->gte($start);
            $yesterdayKey = $date->copy()->subDay()->toDateString();
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

                $ledgerDay = [];
                foreach ($existing as $row) {
                    $ledgerDay[(int) $row->employee_id] = $row->shift_id !== null ? (int) $row->shift_id : null;
                }
                $computedByDate[$dateKey] = ($computedByDate[$dateKey] ?? []) + $ledgerDay;

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
                        if ($writeDate) {
                            EmployeeSchedule::create([
                                'schedule_date' => $dateKey,
                                'employee_id' => $employee->id,
                                'shift_id' => null,
                                'status' => \App\Models\EmployeeSchedule::STATUS_LIBUR,
                            ]);

                            $rowsForDate++;
                        }

                        $ledgerDay[$employee->id] = null;

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
                // (termasuk jadwal lama + hari virtual sebelum `$start`) agar
                // batas `max_night_per_week` konsisten.
                $nightCountByEmployee = [];
                if ($nightShiftId && $maxNightPerWeek > 0) {
                    $weekStartDate = $date->copy()->startOfWeek(Carbon::MONDAY);
                    $employeeIds = $employees->pluck('id')->all();

                    foreach (range(0, 6) as $offset) {
                        $dayOfWeek = $weekStartDate->copy()->addDays($offset);
                        $dayKey = $dayOfWeek->toDateString();

                        if (isset($computedByDate[$dayKey])) {
                            foreach ($computedByDate[$dayKey] as $employeeId => $shiftId) {
                                if ((int) $shiftId === $nightShiftId && in_array($employeeId, $employeeIds, true)) {
                                    $nightCountByEmployee[$employeeId] = ((int) ($nightCountByEmployee[$employeeId] ?? 0)) + 1;
                                }
                            }

                            continue;
                        }

                        $dayNights = EmployeeSchedule::query()
                            ->whereDate('schedule_date', $dayKey)
                            ->where('shift_id', $nightShiftId)
                            ->whereIn('employee_id', $employeeIds)
                            ->pluck('employee_id');

                        foreach ($dayNights as $employeeId) {
                            $employeeId = (int) $employeeId;
                            $nightCountByEmployee[$employeeId] = ((int) ($nightCountByEmployee[$employeeId] ?? 0)) + 1;
                        }
                    }
                }

                // Peraturan kru: setelah libur, wajib masuk shift malam hari berikutnya.
                $offYesterdayIds = [];
                if ($nightAfterOff && $nightShiftId) {
                    if (isset($computedByDate[$yesterdayKey])) {
                        $offYesterdayIds = array_map('intval', array_keys(array_filter(
                            $computedByDate[$yesterdayKey],
                            fn ($shiftId) => $shiftId === null
                        )));
                    } else {
                        $offYesterdayIds = EmployeeSchedule::query()
                            ->whereDate('schedule_date', $yesterdayKey)
                            ->whereIn('employee_id', $employees->pluck('id'))
                            ->whereNull('shift_id')
                            ->pluck('employee_id')
                            ->map(fn ($id) => (int) $id)
                            ->all();
                    }
                }

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
                        $nightCountByEmployee[$employee->id] = $nightCount + 1;

                        continue;
                    }

                    $remainingWorkers[$index] = $employee;
                }

                // Shift yang sudah terpakai hari ini (jadwal lama + setoran after-libur).
                $occupiedShiftIds = $existing->pluck('shift_id')->filter()->unique();
                foreach ($assignments as $assignedShiftId) {
                    if ($assignedShiftId !== null) {
                        $occupiedShiftIds->push((int) $assignedShiftId);
                    }
                }
                $occupiedShiftIds = $occupiedShiftIds->unique();

                $nightShiftIndex = ($nightShiftId !== null && $shiftCount > 0) ? ($shiftCount - 1) : null;
                $nightTaken = $nightShiftIndex !== null && $occupiedShiftIds->contains($nightShiftId);

                // Shift kemarin per karyawan (untuk menghindari shift malam beruntun).
                $lastShiftByEmployee = [];
                if ($nightShiftId) {
                    if (isset($computedByDate[$yesterdayKey])) {
                        $employeeIds = $employees->pluck('id')->all();

                        foreach ($computedByDate[$yesterdayKey] as $employeeId => $shiftId) {
                            if ($shiftId !== null && in_array($employeeId, $employeeIds, true)) {
                                $lastShiftByEmployee[(int) $employeeId] = (int) $shiftId;
                            }
                        }
                    } else {
                        $lastShiftByEmployee = EmployeeSchedule::query()
                            ->whereDate('schedule_date', $yesterdayKey)
                            ->whereIn('employee_id', $employees->pluck('id'))
                            ->whereNotNull('shift_id')
                            ->pluck('shift_id', 'employee_id')
                            ->map(fn ($shiftId) => (int) $shiftId)
                            ->all();
                    }
                }

                // Urutkan sisa pekerja sehingga pembagian "normal" vs "kelebihan"
                // ikut bergilir antar hari. Bila rotasi berlangsung stabil,
                // pekerja yang selalu jadi kelebihan (shift prioritas) tidak akan
                // selalu karyawan yang sama.
                $remainingList = array_values($remainingWorkers);
                $remainingCount = count($remainingList);

                // Bila shift malam sudah terpakai (after-libur / jadwal lama), slot
                // non-malam yang tersedia tinggal (shiftCount - 1). Kelebihan pekerja
                // di luar slot tersebut otomatis menjadi "kelebihan" dan diplot ke
                // shift prioritas, bukan diduplikasi ke shift non-malam.
                $availableSlots = ($nightTaken && $nightShiftIndex !== null) ? ($shiftCount - 1) : $shiftCount;
                $normalCount = min($remainingCount, $availableSlots);
                $overflowCount = $remainingCount - $normalCount;

                $rotate = $remainingCount > 0 ? ($dayNumber % $remainingCount) : 0;
                $rotatedList = array_fill(0, $remainingCount, null);
                foreach ($remainingList as $index => $employee) {
                    $rotatedList[($index + $rotate) % $remainingCount] = $employee;
                }

                $normalList = array_slice($rotatedList, 0, $normalCount);
                $overflowList = array_slice($rotatedList, $normalCount);

                // ---- Isi shift untuk pekerja "normal" dengan rotasi slot harian ----
                // Shift malam dibuka untuk kru dengan jumlah malam paling sedikit
                // (dan sebaiknya bukan shift malam kemarin) agar bebannya merata.
                $slotOrder = [];
                for ($k = 0; $k < $shiftCount; $k++) {
                    $slotOrder[] = ($k + ($dayNumber % $shiftCount)) % $shiftCount;
                }

                $normalAssignments = [];
                $nightWorkerForNormal = null;

                if (! $nightTaken && $nightShiftIndex !== null && $normalCount > 0) {
                    $nightCandidates = array_values(array_filter(
                        $normalList,
                        fn ($employee) => $maxNightPerWeek <= 0
                            || (int) ($nightCountByEmployee[$employee->id] ?? 0) < $maxNightPerWeek
                    ));

                    usort($nightCandidates, function ($a, $b) use (
                        $nightShiftId,
                        $lastShiftByEmployee,
                        $nightCountByEmployee,
                        $dayNumber
                    ) {
                        $countA = (int) ($nightCountByEmployee[$a->id] ?? 0);
                        $countB = (int) ($nightCountByEmployee[$b->id] ?? 0);

                        if ($countA !== $countB) {
                            return $countA <=> $countB;
                        }

                        $yesterdayNightA = (int) ($lastShiftByEmployee[$a->id] ?? -1) === $nightShiftId ? 1 : 0;
                        $yesterdayNightB = (int) ($lastShiftByEmployee[$b->id] ?? -1) === $nightShiftId ? 1 : 0;

                        if ($yesterdayNightA !== $yesterdayNightB) {
                            return $yesterdayNightA <=> $yesterdayNightB;
                        }

                        return (($dayNumber + $a->id) % 100) <=> (($dayNumber + $b->id) % 100);
                    });

                    if ($nightCandidates) {
                        $nightWorkerForNormal = $nightCandidates[0];

                        // Reservasi slot malam segera agar pekerja normal lain yang
                        // di-loop lebih dulu tidak mengambil shift malam lebih dulu.
                        $occupiedShiftIds->push($nightShiftId);
                    }
                }

                $slotCursor = 0;
                foreach ($normalList as $employee) {
                    if ($shiftCount <= 0) {
                        $assignments[$employee->id] = null;

                        continue;
                    }

                    if ($nightWorkerForNormal !== null && $employee->id === $nightWorkerForNormal->id) {
                        $normalAssignments[$employee->id] = $shifts[$nightShiftIndex];
                        $occupiedShiftIds->push($nightShiftId);
                        $nightCountByEmployee[$employee->id] = ((int) ($nightCountByEmployee[$employee->id] ?? 0)) + 1;

                        continue;
                    }

                    $employeeNightCount = (int) ($nightCountByEmployee[$employee->id] ?? 0);
                    $shift = null;

                    for ($t = 0; $t < $shiftCount; $t++) {
                        $candidateShift = $shifts[$slotOrder[($slotCursor + $t) % $shiftCount]];

                        if ($candidateShift->id === $nightShiftId
                            && $maxNightPerWeek > 0
                            && $employeeNightCount >= $maxNightPerWeek) {
                            continue;
                        }

                        if (! $occupiedShiftIds->contains($candidateShift->id)) {
                            $shift = $candidateShift;
                            break;
                        }
                    }

                    if (! $shift) {
                        $shift = $shifts[$slotOrder[$slotCursor % $shiftCount]];
                    }

                    $normalAssignments[$employee->id] = $shift;
                    $occupiedShiftIds->push($shift->id);
                    $slotCursor++;
                }

                // ---- Kelebihan pegawai ditempatkan di shift prioritas ----
                // Bila shift prioritas adalah shift malam, berikan ke kru yang malam-nya
                // paling sedikit agar beban shift malam tetap merata.
                if ($shiftCount > 0 && $overflowCount > 0) {
                    $priorityIndex = $this->resolvePriorityShiftIndex($shifts, $priorityShiftId);
                    $priorityShift = $shifts[$priorityIndex];

                    if ($priorityShift->id === $nightShiftId) {
                        usort($overflowList, function ($a, $b) use ($nightCountByEmployee) {
                            $countA = (int) ($nightCountByEmployee[$a->id] ?? 0);
                            $countB = (int) ($nightCountByEmployee[$b->id] ?? 0);

                            if ($countA !== $countB) {
                                return $countA <=> $countB;
                            }

                            return $a->id <=> $b->id;
                        });
                    }

                    foreach ($overflowList as $employee) {
                        $employeeNightCount = (int) ($nightCountByEmployee[$employee->id] ?? 0);
                        $shift = $priorityShift;

                        if ($priorityShift->id === $nightShiftId
                            && $maxNightPerWeek > 0
                            && $employeeNightCount >= $maxNightPerWeek) {
                            // Shift prioritas adalah shift malam dan batas sudah penuh:
                            // cari shift lain yang masih mungkin dipakai.
                            $shift = null;

                            for ($t = 0; $t < $shiftCount; $t++) {
                                $candidateShift = $shifts[($priorityIndex + $t) % $shiftCount];

                                if ($candidateShift->id === $nightShiftId
                                    && $maxNightPerWeek > 0
                                    && $employeeNightCount >= $maxNightPerWeek) {
                                    continue;
                                }

                                $shift = $candidateShift;
                                break;
                            }

                            $shift ??= $priorityShift;
                        }

                        if ($shift) {
                            $occupiedShiftIds->push($shift->id);

                            if ($nightShiftId && $shift->id === $nightShiftId) {
                                $nightCountByEmployee[$employee->id] = $employeeNightCount + 1;
                            }

                            $assignments[$employee->id] = $shift->id;
                        } else {
                            $assignments[$employee->id] = null;
                        }
                    }
                }

                foreach ($normalAssignments as $employeeId => $shift) {
                    $assignments[$employeeId] = $shift->id;
                }

                foreach ($assignments as $employeeId => $shiftId) {
                    $ledgerDay[$employeeId] = $shiftId !== null ? (int) $shiftId : null;

                    if ($writeDate) {
                        EmployeeSchedule::create([
                            'schedule_date' => $dateKey,
                            'employee_id' => $employeeId,
                            'shift_id' => $shiftId,
                            'status' => \App\Models\EmployeeSchedule::STATUS_MASUK,
                        ]);

                        $rowsForDate++;
                    }
                }

                $computedByDate[$dateKey] = ($computedByDate[$dateKey] ?? []) + $ledgerDay;
            }

            if ($writeDate && $rowsForDate > 0) {
                $generatedDates++;
                $generatedRows += $rowsForDate;
            } elseif ($writeDate && $sawExisting) {
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
