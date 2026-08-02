<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\Transaction;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Services\OutletResolver;
use App\Support\ReportTimezone;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OutletAnalyticsController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $accessibleOutletsQuery = $user?->accessibleOutletsQuery()->active()->ordered();
        $accessibleOutletIds = $accessibleOutletsQuery
            ? (clone $accessibleOutletsQuery)->pluck('outlets.id')->map(fn ($id) => (int) $id)->values()
            : collect();

        abort_if(
            (string) ($activeOutlet?->outlet_type ?? '') === 'tenant',
            403,
            'Laporan statistik outlet tidak tersedia untuk workspace tenant.'
        );

        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'outlet_id' => $request->input('outlet_id'),
        ];

        $selectedOutlet = null;
        if (filled($filters['outlet_id'])) {
            $selectedOutlet = ($accessibleOutletsQuery ? (clone $accessibleOutletsQuery) : Outlet::query())
                ->where('outlets.id', $filters['outlet_id'])
                ->first();
        }

        $transactionQuery = Transaction::query()
            ->when(
                $accessibleOutletIds->isNotEmpty() && ! $user?->isSuperAdmin(),
                fn ($query) => $query->whereIn('outlet_id', $accessibleOutletIds->all())
            )
            ->when($selectedOutlet, fn ($query) => $query->where('outlet_id', $selectedOutlet->id));
        $allocationQuery = TransactionTenantAllocation::query()
            ->with(['tenantOutlet:id,name,code'])
            ->select('transaction_tenant_allocations.*')
            ->selectSub(
                TransactionTenantAllocationItem::query()
                    ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0)')
                    ->whereColumn('transaction_tenant_allocation_id', 'transaction_tenant_allocations.id'),
                'cost_total'
            )
            ->when(
                $accessibleOutletIds->isNotEmpty() && ! $user?->isSuperAdmin(),
                function ($query) use ($accessibleOutletIds) {
                    $query->where(function ($innerQuery) use ($accessibleOutletIds) {
                        $innerQuery
                            ->whereIn('outlet_id', $accessibleOutletIds->all())
                            ->orWhereIn('tenant_outlet_id', $accessibleOutletIds->all());
                    });
                }
            )
            ->when($selectedOutlet, function ($query) use ($selectedOutlet) {
                $query->where(function ($innerQuery) use ($selectedOutlet) {
                    $innerQuery
                        ->where('outlet_id', $selectedOutlet->id)
                        ->orWhere('tenant_outlet_id', $selectedOutlet->id);
                });
            });

        if ($filters['start_date'] || $filters['end_date']) {
            ReportTimezone::applySourceDateRange($transactionQuery, 'created_at', $filters);
            $allocationQuery->whereHas('transaction', function ($query) use ($filters) {
                ReportTimezone::applySourceDateRange($query, 'created_at', $filters);
            });
        }

        $outletStats = Outlet::query()
            ->when(
                $accessibleOutletIds->isNotEmpty() && ! $user?->isSuperAdmin(),
                fn ($query) => $query->whereIn('id', $accessibleOutletIds->all())
            )
            ->when($selectedOutlet, fn ($query) => $query->whereKey($selectedOutlet->id))
            ->withCount([
                'transactions as transactions_count' => fn ($query) => $this->applyDateRange($query, $filters),
                'cashierShifts as shifts_count' => fn ($query) => $this->applyDateRange($query, $filters, 'opened_at'),
                'kitchenStations as stations_count',
            ])
            ->with(['users:id,name,email'])
            ->withSum([
                'transactions as revenue_total' => fn ($query) => $this->applyDateRange($query, $filters),
            ], 'grand_total')
            ->ordered()
            ->get()
            ->map(function (Outlet $outlet) {
                return [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                    'code' => $outlet->code,
                    'city' => $outlet->city,
                    'is_active' => (bool) $outlet->is_active,
                    'transactions_count' => (int) ($outlet->transactions_count ?? 0),
                    'shifts_count' => (int) ($outlet->shifts_count ?? 0),
                    'stations_count' => (int) ($outlet->stations_count ?? 0),
                    'revenue_total' => (int) ($outlet->revenue_total ?? 0),
                    'users' => $outlet->users
                        ->map(fn ($user) => [
                            'id' => $user->id,
                            'name' => $user->name,
                            'email' => $user->email,
                            'is_primary' => (bool) ($user->pivot?->is_primary ?? false),
                        ])
                        ->values(),
                ];
            });

        $tenantStats = $allocationQuery
            ->get()
            ->map(function ($allocation) {
                $revenue = (int) ($allocation->grand_total ?? 0);
                $cost = (int) ($allocation->cost_total ?? 0);
                $profit = $revenue - $cost;
                $commissionRate = (float) ($allocation->tenantOutlet?->commission_rate_percent ?? 0);
                $managementFee = (int) round(max(0, $profit) * ($commissionRate / 100));

                return [
                    'tenant_outlet_id' => $allocation->tenant_outlet_id,
                    'tenant_name' => $allocation->tenantOutlet?->name ?? 'Tenant',
                    'tenant_code' => $allocation->tenantOutlet?->code ?? '-',
                    'revenue_total' => $revenue,
                    'cost_total' => $cost,
                    'profit_total' => $profit,
                    'management_fee_total' => $managementFee,
                    'payout_total' => $profit - $managementFee,
                ];
            })
            ->groupBy('tenant_outlet_id')
            ->map(function ($rows) {
                $first = $rows->first();

                return [
                    'tenant_outlet_id' => $first['tenant_outlet_id'],
                    'tenant_name' => $first['tenant_name'],
                    'tenant_code' => $first['tenant_code'],
                    'orders_count' => $rows->count(),
                    'revenue_total' => $rows->sum('revenue_total'),
                    'cost_total' => $rows->sum('cost_total'),
                    'profit_total' => $rows->sum('profit_total'),
                    'management_fee_total' => $rows->sum('management_fee_total'),
                    'payout_total' => $rows->sum('payout_total'),
                ];
            })
            ->sortByDesc('revenue_total')
            ->values();

        $summary = [
            'outlets_total' => $selectedOutlet
                ? 1
                : ($accessibleOutletIds->isNotEmpty() && ! $user?->isSuperAdmin()
                    ? $accessibleOutletIds->count()
                    : Outlet::count()),
            'active_outlets_total' => $selectedOutlet
                ? ((bool) $selectedOutlet->is_active ? 1 : 0)
                : ($accessibleOutletIds->isNotEmpty() && ! $user?->isSuperAdmin()
                    ? Outlet::whereIn('id', $accessibleOutletIds->all())->where('is_active', true)->count()
                    : Outlet::where('is_active', true)->count()),
            'transactions_total' => (clone $transactionQuery)->count(),
            'revenue_total' => (int) ((clone $transactionQuery)->sum('grand_total') ?? 0),
            'tenant_revenue_total' => (int) $tenantStats->sum('revenue_total'),
            'tenant_payout_total' => (int) $tenantStats->sum('payout_total'),
        ];

        return Inertia::render('Dashboard/Reports/OutletAnalytics', [
            'filters' => $filters,
            'summary' => $summary,
            'outletStats' => $outletStats,
            'tenantStats' => $tenantStats,
            'outlets' => ($accessibleOutletsQuery ? (clone $accessibleOutletsQuery) : Outlet::query()->ordered())
                ->get(['outlets.id', 'outlets.name', 'outlets.code']),
            'selectedOutlet' => $selectedOutlet?->only(['id', 'name', 'code', 'outlet_type']),
        ]);
    }

    private function applyDateRange($query, array $filters, string $column = 'created_at')
    {
        return ReportTimezone::applySourceDateRange($query, $column, $filters);
    }
}
