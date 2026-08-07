<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeSchedule;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class EmployeeAttendanceReportService
{
    /**
     * Ringkasan kehadiran per karyawan dalam rentang tanggal.
     *
     * @return array{employees: array, totals: array, total_days_in_range: int}
     */
    public function summary(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?string $jobType = null,
        ?int $employeeId = null
    ): array {
        $totalDays = (int) $start->diffInDays($end) + 1;

        $employees = $this->employees($jobType, $employeeId);
        $ids = $employees->pluck('id');

        $schedules = $ids->isEmpty()
            ? collect()
            : EmployeeSchedule::query()
                ->with('shift')
                ->whereBetween('schedule_date', [$start->toDateString(), $end->toDateString()])
                ->whereIn('employee_id', $ids)
                ->get()
                ->groupBy('employee_id');

        $grand = $this->emptyTotals();

        $employeeData = $employees->map(function ($employee) use ($schedules, $totalDays, &$grand) {
            $metrics = $this->metricsFor($schedules->get($employee->id) ?? collect(), $totalDays);
            $metrics['not_scheduled_days'] = max(0, $totalDays - $metrics['scheduled_days']);

            foreach ($metrics as $key => $value) {
                $grand[$key] += $value;
            }

            return [
                'id' => $employee->id,
                'name' => $employee->name,
                'job_type' => $employee->job_type,
                ...$metrics,
            ];
        })->values()->all();

        return [
            'employees' => $employeeData,
            'totals' => $grand,
            'total_days_in_range' => $totalDays,
        ];
    }

    /**
     * Rincian per interval (day/week/month) untuk seluruh karyawan terpilih.
     *
     * @return array<int, array{period_start: string, period_end: string, label: string, employees: array, totals: array}>
     */
    public function breakdown(
        CarbonImmutable $start,
        CarbonImmutable $end,
        string $interval,
        ?string $jobType = null,
        ?int $employeeId = null
    ): array {
        $users = $this->employees($jobType, $employeeId);
        $ids = $users->pluck('id');

        $buckets = $this->buildBuckets($start, $end, $interval);
        $result = [];

        foreach ($buckets as $bucket) {
            $schedules = $ids->isEmpty()
                ? collect()
                : EmployeeSchedule::query()
                    ->with('shift')
                    ->whereBetween('schedule_date', [$bucket['period_start'], $bucket['period_end']])
                    ->whereIn('employee_id', $ids)
                    ->get()
                    ->groupBy('employee_id');

            $grand = $this->emptyTotals();
            $bucketDays = (int) CarbonImmutable::parse($bucket['period_start'])->startOfDay()
                ->diffInDays(CarbonImmutable::parse($bucket['period_end'])->startOfDay()) + 1;

            $employeeData = $users->map(function ($employee) use ($schedules, $bucketDays, &$grand) {
                $metrics = $this->metricsFor($schedules->get($employee->id) ?? collect(), $bucketDays);

                foreach ($metrics as $key => $value) {
                    $grand[$key] += $value;
                }

                return [
                    'employee_id' => $employee->id,
                    'name' => $employee->name,
                    'job_type' => $employee->job_type,
                    ...$metrics,
                ];
            })->values()->all();

            $result[] = [
                'period_start' => $bucket['period_start'],
                'period_end' => $bucket['period_end'],
                'label' => $bucket['label'],
                'employees' => $employeeData,
                'totals' => $grand,
            ];
        }

        return $result;
    }

    private function employees(?string $jobType, ?int $employeeId): Collection
    {
        return Employee::query()
            ->where('is_active', true)
            ->when($jobType, fn ($q) => $q->where('job_type', $jobType))
            ->when($employeeId, fn ($q) => $q->where('id', $employeeId))
            ->orderBy('job_type')
            ->orderBy('rotation_order')
            ->orderBy('name')
            ->get(['id', 'name', 'job_type']);
    }

    private function metricsFor(Collection $rows, ?int $totalDays = null): array
    {
        $m = $this->emptyMetrics();

        foreach ($rows as $row) {
            $status = $row->status ?? ($row->shift_id ? EmployeeSchedule::STATUS_MASUK : EmployeeSchedule::STATUS_LIBUR);

            switch ($status) {
                case EmployeeSchedule::STATUS_MASUK:
                    $m['working_days']++;
                    $m['work_minutes'] += $row->shift?->durationMinutes() ?? 0;
                    break;
                case EmployeeSchedule::STATUS_LIBUR:
                    $m['libur']++;
                    break;
                case EmployeeSchedule::STATUS_CUTI:
                    $m['cuti']++;
                    break;
                case EmployeeSchedule::STATUS_IZIN:
                    $m['izin']++;
                    break;
                case EmployeeSchedule::STATUS_SAKIT:
                    $m['sakit']++;
                    break;
            }

            $m['scheduled_days']++;
        }

        if ($totalDays !== null) {
            $m['not_scheduled_days'] = max(0, $totalDays - $m['scheduled_days']);
        }

        return $m;
    }

    private function emptyMetrics(): array
    {
        return [
            'working_days' => 0,
            'work_minutes' => 0,
            'libur' => 0,
            'cuti' => 0,
            'izin' => 0,
            'sakit' => 0,
            'scheduled_days' => 0,
        ];
    }

    private function emptyTotals(): array
    {
        return array_merge($this->emptyMetrics(), ['not_scheduled_days' => 0]);
    }

    private function buildBuckets(CarbonImmutable $start, CarbonImmutable $end, string $interval): array
    {
        if ($interval === 'day') {
            $buckets = [];

            for ($d = $start; $d->lte($end); $d = $d->addDay()) {
                $buckets[] = [
                    'period_start' => $d->toDateString(),
                    'period_end' => $d->toDateString(),
                    'label' => $d->format('d M Y'),
                ];
            }

            return $buckets;
        }

        if ($interval === 'month') {
            $buckets = [];
            $d = $start->copy()->startOfMonth();

            while ($d->lte($end)) {
                $dayStart = $d->copy()->max($start);
                $dayEnd = $d->copy()->endOfMonth()->min($end);
                $buckets[] = [
                    'period_start' => $dayStart->toDateString(),
                    'period_end' => $dayEnd->toDateString(),
                    'label' => $d->format('F Y'),
                ];
                $d = $d->addMonthNoOverflow()->startOfMonth();
            }

            return $buckets;
        }

        // week (default)
        $buckets = [];
        $d = $start->copy()->startOfWeek(CarbonImmutable::MONDAY);

        while ($d->lte($end)) {
            $dayStart = $d->copy()->max($start);
            $dayEnd = $d->copy()->addDays(6)->min($end);
            $buckets[] = [
                'period_start' => $dayStart->toDateString(),
                'period_end' => $dayEnd->toDateString(),
                'label' => $dayStart->format('d M').' - '.$dayEnd->format('d M Y'),
            ];
            $d = $d->addDays(7)->startOfDay();
        }

        return $buckets;
    }
}
