<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeSchedule;
use App\Models\EmployeeScheduleConfig;
use App\Models\EmployeeShift;
use App\Models\PublicScheduleShare;
use App\Services\EmployeeAttendanceReportService;
use App\Services\EmployeeScheduleService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class EmployeeScheduleController extends Controller
{
    public function __construct(private readonly EmployeeScheduleService $service) {}

    public function report(Request $request)
    {
        $today = now();

        $start = $request->filled('start_date')
            ? Carbon::parse($request->input('start_date'))->startOfDay()
            : $today->copy()->startOfWeek()->startOfDay();
        $end = $request->filled('end_date')
            ? Carbon::parse($request->input('end_date'))->startOfDay()
            : $today->copy()->endOfWeek()->startOfDay();

        if ($start->gt($end)) {
            [$start, $end] = [$end, $start];
        }

        $interval = $request->input('interval');
        if (! in_array($interval, ['all', 'day', 'weekly', 'monthly'], true)) {
            $interval = 'all';
        }

        $summary = (new EmployeeAttendanceReportService)->summary(
            CarbonImmutable::instance($start),
            CarbonImmutable::instance($end),
            $request->input('job_type') ?: null,
            $request->input('employee_id') ? (int) $request->input('employee_id') : null,
        );

        $breakdown = $interval !== 'all'
            ? (new EmployeeAttendanceReportService)->breakdown(
                CarbonImmutable::instance($start),
                CarbonImmutable::instance($end),
                $interval,
                $request->input('job_type') ?: null,
                $request->input('employee_id') ? (int) $request->input('employee_id') : null,
            )
            : [];

        return Inertia::render('Dashboard/EmployeeSchedules/Report', [
            'summary' => $summary['employees'],
            'totals' => $summary['totals'],
            'totalDaysInRange' => $summary['total_days_in_range'],
            'breakdown' => $breakdown,
            'interval' => $interval,
            'period' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],
            'jobTypes' => Employee::query()->distinct()->orderBy('job_type')->pluck('job_type')->all(),
            'employees' => Employee::query()->orderBy('job_type')->orderBy('name')->get(['id', 'name', 'job_type']),
        ]);
    }

    public function index(Request $request)
    {
        $view = in_array($request->input('view', 'week'), ['week', 'month'], true)
            ? $request->input('view')
            : 'week';

        if ($view === 'month') {
            $start = $this->resolveMonthStart($request);
            $end = $start->copy()->endOfMonth();
        } else {
            $start = $this->resolveWeekStart($request);
            $end = $start->copy()->addDays(6);
        }

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

        $prev = $view === 'month'
            ? $start->copy()->subMonthNoOverflow()->toDateString()
            : $start->copy()->subDays(7)->toDateString();

        $next = $view === 'month'
            ? $start->copy()->addMonthNoOverflow()->toDateString()
            : $start->copy()->addDays(7)->toDateString();

        return Inertia::render('Dashboard/EmployeeSchedules/Index', [
            'groups' => $groups,
            'shifts' => $shifts,
            'jobTypes' => Employee::query()->distinct()->orderBy('job_type')->pluck('job_type')->all(),
            'view' => $view,
            'period' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'prev' => $prev,
                'next' => $next,
                'label' => $view === 'month'
                    ? $start->format('F Y')
                    : $start->format('d M Y').' - '.$end->format('d M Y'),
            ],
            'share' => $this->sharePayload(),
            'config' => $this->configPayload(),
        ]);
    }

    public function updateConfig(Request $request)
    {
        $validated = $request->validate([
            'day_off_per_week' => ['required', 'integer', 'min:0', 'max:7'],
            'blocked_weekdays' => ['present', 'array'],
            'blocked_weekdays.*' => ['integer', 'between:1,7'],
        ], [
            'day_off_per_week.required' => 'Jatah libur per pekan wajib diisi.',
            'blocked_weekdays.array' => 'Format hari terlarang libur tidak valid.',
        ]);

        $config = EmployeeScheduleConfig::rule();

        $config->day_off_per_week = (int) $validated['day_off_per_week'];
        $config->blocked_weekdays = array_values(array_map('intval', array_unique($validated['blocked_weekdays'])));
        $config->save();

        return back()->with('success', 'Peraturan libur diperbarui.');
    }

    private function configPayload(): array
    {
        $config = EmployeeScheduleConfig::rule();

        return [
            'day_off_per_week' => (int) $config->day_off_per_week,
            'blocked_weekdays' => array_map('intval', $config->blockedDays()),
        ];
    }

    public function toggleShare(Request $request)
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $enabled = $request->boolean('enabled');
        $share = PublicScheduleShare::query()->orderBy('id')->first();

        if ($enabled) {
            if (! $share) {
                $share = PublicScheduleShare::create([
                    'token' => Str::uuid()->toString(),
                    'is_active' => false,
                ]);
            }

            $share->is_active = true;
            $share->save();

            return back()->with('success', 'Tautan jadwal publik berhasil diaktifkan.');
        }

        if ($share) {
            $share->is_active = false;
            $share->save();
        }

        return back()->with('success', 'Tautan jadwal publik nonaktif.');
    }

    public function generate(Request $request)
    {
        $validated = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'job_type' => ['nullable', 'string', 'max:100'],
            'overwrite' => ['nullable', 'boolean'],
        ], [
            'start_date.required' => 'Tanggal mulai wajib diisi.',
            'end_date.required' => 'Tanggal selesai wajib diisi.',
            'end_date.after_or_equal' => 'Tanggal selesai tidak boleh sebelum tanggal mulai.',
        ]);

        try {
            $result = app(EmployeeScheduleService::class)->generate(
                CarbonImmutable::parse($validated['start_date']),
                CarbonImmutable::parse($validated['end_date']),
                $validated['job_type'] ?? null,
                $request->boolean('overwrite')
            );
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        }

        $message = "Jadwal dibuat untuk {$result['generated_dates']} hari ({$result['generated_rows']} baris).";

        if ($result['skipped_dates'] > 0) {
            $message .= " {$result['skipped_dates']} hari dilewati karena sudah ada jadwal.";
        }

        return back()->with('success', $message);
    }

    public function set(Request $request)
    {
        $validated = $request->validate([
            'schedule_date' => ['required', 'date'],
            'employee_id' => ['required', 'exists:employees,id'],
            'status' => ['sometimes', Rule::in(EmployeeSchedule::STATUSES)],
            'shift_id' => ['nullable', 'required_if:status,masuk', 'exists:employee_shifts,id'],
        ], [
            'schedule_date.required' => 'Tanggal wajib diisi.',
            'employee_id.required' => 'Karyawan wajib diisi.',
        ]);

        $status = $validated['status'] ?? (isset($validated['shift_id'])
            ? EmployeeSchedule::STATUS_MASUK
            : EmployeeSchedule::STATUS_LIBUR);
        $shiftId = $status === EmployeeSchedule::STATUS_MASUK ? ($validated['shift_id'] ?? null) : null;

        EmployeeSchedule::updateOrCreate(
            ['schedule_date' => $validated['schedule_date'], 'employee_id' => $validated['employee_id']],
            ['shift_id' => $shiftId, 'status' => $status]
        );

        return back()->with('success', 'Jadwal diperbarui.');
    }

    public function destroy(EmployeeSchedule $employeeSchedule)
    {
        $employeeSchedule->delete();

        return back()->with('success', 'Jadwal dikosongkan.');
    }

    private function sharePayload(): ?array
    {
        $share = PublicScheduleShare::query()->orderBy('id')->first();

        if (! $share) {
            return null;
        }

        return [
            'token' => $share->token,
            'is_active' => (bool) $share->is_active,
            'url' => route('public.schedule.show', $share->token),
        ];
    }

    private function resolveWeekStart(Request $request): Carbon
    {
        $week = $request->input('period');

        if ($week) {
            try {
                return Carbon::parse($week)->startOfWeek(Carbon::MONDAY);
            } catch (\Throwable $e) {
                // fallback ke minggu berjalan
            }
        }

        return Carbon::now()->startOfWeek(Carbon::MONDAY);
    }

    private function resolveMonthStart(Request $request): Carbon
    {
        $period = $request->input('period');

        if ($period) {
            try {
                return Carbon::parse($period)->copy()->startOfMonth();
            } catch (\Throwable $e) {
                // fallback ke bulan berjalan
            }
        }

        return Carbon::now()->startOfMonth();
    }
}
