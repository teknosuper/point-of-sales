<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditLogService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function index(Request $request): Response
    {
        $filters = [
            'user_id' => $request->input('user_id'),
            'module' => $request->input('module'),
            'event' => $request->input('event'),
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
            'search' => $request->input('search'),
        ];

        $baseQuery = AuditLog::query()
            ->when($filters['user_id'], fn (Builder $query, $userId) => $query->where('user_id', $userId))
            ->when($filters['module'], fn (Builder $query, $module) => $query->where('module', $module))
            ->when($filters['event'], fn (Builder $query, $event) => $query->where('event', $event))
            ->when($filters['date_from'], fn (Builder $query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'], fn (Builder $query, $date) => $query->whereDate('created_at', '<=', $date))
            ->when($filters['search'], function (Builder $query, $search) {
                $query->where(function (Builder $builder) use ($search) {
                    $builder
                        ->where('target_label', 'like', '%'.$search.'%')
                        ->orWhere('description', 'like', '%'.$search.'%')
                        ->orWhereHas('user', fn (Builder $userQuery) => $userQuery
                            ->where('name', 'like', '%'.$search.'%')
                            ->orWhere('email', 'like', '%'.$search.'%'));
                });
            });

        $stats = [
            'total' => (clone $baseQuery)->count(),
            'today' => (clone $baseQuery)->whereDate('created_at', Carbon::today())->count(),
            'this_week' => (clone $baseQuery)->whereBetween('created_at', [now()->startOfWeek(), now()])->count(),
            'this_month' => (clone $baseQuery)->whereBetween('created_at', [now()->startOfMonth(), now()])->count(),
            'unique_users' => (clone $baseQuery)->whereNotNull('user_id')->distinct()->count('user_id'),
            'by_module' => AuditLog::query()
                ->select('module')
                ->selectRaw('count(*) as total')
                ->groupBy('module')
                ->orderByDesc('total')
                ->limit(5)
                ->get()
                ->map(fn ($row) => ['module' => $row->module, 'total' => (int) $row->total]),
            'by_event' => AuditLog::query()
                ->select('event')
                ->selectRaw('count(*) as total')
                ->groupBy('event')
                ->orderByDesc('total')
                ->limit(5)
                ->get()
                ->map(fn ($row) => ['event' => $row->event, 'total' => (int) $row->total]),
            'oldest_date' => optional(AuditLog::query()->min('created_at'))?->toISOString(),
        ];

        $auditLogs = (clone $baseQuery)
            ->with('user:id,name,email')
            ->latest('created_at')
            ->paginate(15)
            ->withQueryString();

        $auditLogs->through(fn (AuditLog $log) => $this->transformSummary($log));

        return Inertia::render('Dashboard/AuditLogs/Index', [
            'auditLogs' => $auditLogs,
            'filters' => $filters,
            'stats' => $stats,
            'users' => User::query()->select('id', 'name')->orderBy('name')->get(),
            'modules' => AuditLog::query()->select('module')->distinct()->orderBy('module')->pluck('module'),
            'events' => AuditLog::query()->select('event')->distinct()->orderBy('event')->pluck('event'),
        ]);
    }

    public function cleanup(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'keep_months' => ['required', 'integer', 'min:1', 'max:36'],
        ]);

        $keepMonths = (int) $validated['keep_months'];
        $cutoff = now()->subMonths($keepMonths);

        $count = AuditLog::query()->where('created_at', '<', $cutoff)->count();

        if ($count <= 0) {
            return back()->with('info', 'Tidak ada log yang perlu dibersihkan.');
        }

        AuditLog::query()->where('created_at', '<', $cutoff)->delete();

        $this->auditLogService->log(
            event: 'audit.cleaned',
            module: 'audit_logs',
            description: "Bulk cleanup: {$count} log lebih lama dari {$keepMonths} bulan dihapus.",
            after: ['deleted_count' => $count, 'keep_months' => $keepMonths, 'cutoff' => $cutoff->toISOString()],
            meta: ['keep_months' => $keepMonths, 'deleted_count' => $count],
        );

        return back()->with('success', "{$count} log berhasil dibersihkan. Log yang lebih lama dari {$keepMonths} bulan telah dihapus.");
    }

    public function show(AuditLog $auditLog): Response
    {
        $auditLog->load('user:id,name,email');

        return Inertia::render('Dashboard/AuditLogs/Show', [
            'auditLog' => [
                ...$this->transformSummary($auditLog),
                'auditable_type' => $auditLog->auditable_type,
                'auditable_id' => $auditLog->auditable_id,
                'before' => $auditLog->before,
                'after' => $auditLog->after,
                'meta' => $auditLog->meta,
                'ip_address' => $auditLog->ip_address,
                'user_agent' => $auditLog->user_agent,
            ],
        ]);
    }

    private function transformSummary(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'event' => $log->event,
            'module' => $log->module,
            'target_label' => $log->target_label,
            'description' => $log->description,
            'created_at' => optional($log->created_at)?->toISOString(),
            'user' => $log->user ? [
                'id' => $log->user->id,
                'name' => $log->user->name,
                'email' => $log->user->email,
            ] : null,
        ];
    }
}
