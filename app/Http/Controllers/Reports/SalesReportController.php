<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Outlet;
use App\Models\Profit;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use Carbon\Carbon;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SalesReportController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    /**
     * Display the sales report.
     */
    public function index(Request $request)
    {
        $outletId = $this->outletResolver->resolve($request, $request->user())?->id;
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'invoice' => $request->input('invoice'),
            'cashier_id' => $request->input('cashier_id'),
            'customer_id' => $request->input('customer_id'),
            'tenant_outlet_id' => $request->input('tenant_outlet_id'),
            'settlement_status' => $request->input('settlement_status'),
            'outlet_id' => $outletId,
        ];

        $baseListQuery = $this->applyFilters(
            Transaction::query()
                ->with(['cashier:id,name', 'customer:id,name'])
                ->withSum('details as total_items', 'qty')
                ->withSum('profits as total_profit', 'total'),
            $filters
        )->orderByDesc('created_at');

        $transactions = (clone $baseListQuery)
            ->paginate(10)
            ->withQueryString();

        $aggregateQuery = $this->applyFilters(Transaction::query(), $filters);

        $totals = (clone $aggregateQuery)
            ->selectRaw('
                COUNT(*) as orders_count,
                COALESCE(SUM(grand_total), 0) as revenue_total,
                COALESCE(SUM(discount), 0) as discount_total
            ')
            ->first();

        $transactionIds = (clone $aggregateQuery)->pluck('id');

        $itemsSold = $transactionIds->isNotEmpty()
            ? TransactionDetail::whereIn('transaction_id', $transactionIds)->sum('qty')
            : 0;

        $profitTotal = $transactionIds->isNotEmpty()
            ? Profit::whereIn('transaction_id', $transactionIds)->sum('total')
            : 0;

        $tenantAllocationBaseQuery = $this->applyAllocationFilters(
            TransactionTenantAllocation::query()
                ->with(['tenantOutlet:id,name,code,commission_rate_percent', 'transaction:id,invoice,created_at,payment_status'])
                ->select('transaction_tenant_allocations.*')
                ->selectSub(
                    TransactionTenantAllocationItem::query()
                        ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0)')
                        ->whereColumn('transaction_tenant_allocation_id', 'transaction_tenant_allocations.id'),
                    'cost_total'
                )
                ->withSum('items as total_items', 'qty'),
            $filters
        );

        $tenantMetricAllocations = (clone $tenantAllocationBaseQuery)
            ->get();
        $tenantMetricAllocations = $this->appendAllocationMetrics($tenantMetricAllocations);

        $tenantAllocations = (clone $tenantAllocationBaseQuery)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get();
        $tenantAllocations = $this->appendAllocationMetrics($tenantAllocations);

        $tenantSummary = [
            'allocation_count' => $tenantMetricAllocations->count(),
            'tenant_count' => $tenantMetricAllocations->pluck('tenant_outlet_id')->filter()->unique()->count(),
            'revenue_total' => (int) $tenantMetricAllocations->sum('grand_total'),
            'settled_total' => (int) $tenantMetricAllocations->filter(fn ($allocation) => filled($allocation->settled_at))->sum('grand_total'),
            'cost_total' => (int) $tenantMetricAllocations->sum('cost_total'),
        ];
        $tenantSummary['profit_total'] = $tenantSummary['revenue_total'] - $tenantSummary['cost_total'];
        $tenantSummary['margin_percentage'] = $tenantSummary['revenue_total'] > 0
            ? round(($tenantSummary['profit_total'] / $tenantSummary['revenue_total']) * 100, 2)
            : 0.0;
        $tenantSummary['outstanding_total'] = max(
            0,
            $tenantSummary['revenue_total'] - $tenantSummary['settled_total']
        );

        $topTenants = $tenantMetricAllocations
            ->groupBy('tenant_outlet_id')
            ->map(function ($allocations) {
                $first = $allocations->first();
                $revenueTotal = (int) $allocations->sum('grand_total');
                $costTotal = (int) $allocations->sum('cost_total');
                $profitTotal = $revenueTotal - $costTotal;
                $managementFeeTotal = (int) round($allocations->sum('management_fee_total'));
                $tenantPayoutTotal = $profitTotal - $managementFeeTotal;

                return (object) [
                    'tenant_outlet_id' => $first->tenant_outlet_id,
                    'tenant_outlet' => $first->tenantOutlet,
                    'orders_count' => $allocations->count(),
                    'revenue_total' => $revenueTotal,
                    'cost_total' => $costTotal,
                    'profit_total' => $profitTotal,
                    'management_fee_total' => $managementFeeTotal,
                    'tenant_payout_total' => $tenantPayoutTotal,
                    'margin_percentage' => $revenueTotal > 0
                        ? round(($profitTotal / $revenueTotal) * 100, 2)
                        : 0.0,
                ];
            })
            ->sortByDesc('revenue_total')
            ->take(5)
            ->values();

        $summary = [
            'orders_count' => (int) ($totals->orders_count ?? 0),
            'revenue_total' => (int) ($totals->revenue_total ?? 0),
            'discount_total' => (int) ($totals->discount_total ?? 0),
            'items_sold' => (int) $itemsSold,
            'profit_total' => (int) $profitTotal,
            'average_order' => ($totals->orders_count ?? 0) > 0
                ? (int) round($totals->revenue_total / $totals->orders_count)
                : 0,
        ];
        $tenantSummary['management_fee_total'] = (int) round($tenantMetricAllocations->sum('management_fee_total'));
        $tenantSummary['tenant_payout_total'] = (int) round($tenantMetricAllocations->sum('tenant_payout_total'));

        return Inertia::render('Dashboard/Reports/Sales', [
            'transactions' => $transactions,
            'summary' => $summary,
            'tenantSettlement' => [
                'summary' => [
                    'allocation_count' => (int) $tenantSummary['allocation_count'],
                    'tenant_count' => (int) $tenantSummary['tenant_count'],
                    'revenue_total' => (int) $tenantSummary['revenue_total'],
                    'settled_total' => (int) $tenantSummary['settled_total'],
                    'cost_total' => (int) $tenantSummary['cost_total'],
                    'profit_total' => (int) $tenantSummary['profit_total'],
                    'management_fee_total' => (int) $tenantSummary['management_fee_total'],
                    'tenant_payout_total' => (int) $tenantSummary['tenant_payout_total'],
                    'margin_percentage' => (float) $tenantSummary['margin_percentage'],
                    'outstanding_total' => (int) $tenantSummary['outstanding_total'],
                ],
                'top_tenants' => $topTenants,
                'allocations' => $tenantAllocations,
            ],
            'filters' => $filters,
            'cashiers' => User::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::select('id', 'name')->orderBy('name')->get(),
            'tenantOutlets' => Outlet::query()
                ->active()
                ->ordered()
                ->get(['id', 'name', 'code']),
        ]);
    }

    /**
     * Apply table filters.
     */
    protected function applyFilters($query, array $filters)
    {
        return $query
            ->when($filters['outlet_id'] ?? null, fn ($q, $outletId) => $q->where('outlet_id', $outletId))
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->where('invoice', 'like', '%'.$invoice.'%'))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashier) => $q->where('cashier_id', $cashier))
            ->when($filters['customer_id'] ?? null, fn ($q, $customer) => $q->where('customer_id', $customer))
            ->when($filters['start_date'] ?? null, fn ($q, $start) => $q->whereDate('created_at', '>=', $start))
            ->when($filters['end_date'] ?? null, fn ($q, $end) => $q->whereDate('created_at', '<=', $end));
    }

    protected function applyAllocationFilters($query, array $filters)
    {
        return $query
            ->when($filters['outlet_id'] ?? null, fn ($q, $outletId) => $q->where('outlet_id', $outletId))
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->whereHas('transaction', fn ($transactionQuery) => $transactionQuery->where('invoice', 'like', '%'.$invoice.'%')))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashierId) => $q->where('cashier_id', $cashierId))
            ->when($filters['customer_id'] ?? null, fn ($q, $customerId) => $q->whereHas('transaction', fn ($transactionQuery) => $transactionQuery->where('customer_id', $customerId)))
            ->when($filters['tenant_outlet_id'] ?? null, fn ($q, $tenantOutletId) => $q->where('tenant_outlet_id', $tenantOutletId))
            ->when($filters['settlement_status'] ?? null, function ($q, $status) {
                return match ($status) {
                    'settled' => $q->whereNotNull('settled_at'),
                    'outstanding' => $q->whereNull('settled_at'),
                    default => $q,
                };
            })
            ->when($filters['start_date'] ?? null, fn ($q, $start) => $q->whereHas('transaction', fn ($transactionQuery) => $transactionQuery->whereDate('created_at', '>=', $start)))
            ->when($filters['end_date'] ?? null, fn ($q, $end) => $q->whereHas('transaction', fn ($transactionQuery) => $transactionQuery->whereDate('created_at', '<=', $end)));
    }

    public function exportTenantSettlement(Request $request)
    {
        $outletId = $this->outletResolver->resolve($request, $request->user())?->id;
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'invoice' => $request->input('invoice'),
            'cashier_id' => $request->input('cashier_id'),
            'customer_id' => $request->input('customer_id'),
            'tenant_outlet_id' => $request->input('tenant_outlet_id'),
            'settlement_status' => $request->input('settlement_status'),
            'outlet_id' => $outletId,
        ];

        $allocations = $this->applyAllocationFilters(
            TransactionTenantAllocation::query()
                ->with(['tenantOutlet:id,name,code,commission_rate_percent', 'transaction:id,invoice,created_at,payment_status'])
                ->select('transaction_tenant_allocations.*')
                ->selectSub(
                    TransactionTenantAllocationItem::query()
                        ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0)')
                        ->whereColumn('transaction_tenant_allocation_id', 'transaction_tenant_allocations.id'),
                    'cost_total'
                )
                ->withSum('items as total_items', 'qty')
                ->orderByDesc('created_at'),
            $filters
        )->get();
        $allocations = $this->appendAllocationMetrics($allocations);

        $filename = 'tenant-settlement-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($allocations) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'allocation_number',
                'invoice',
                'transaction_date',
                'tenant_code',
                'tenant_name',
                'items_count',
                'subtotal',
                'promo_discount_total',
                'voucher_discount_total',
                'loyalty_discount_total',
                'manual_discount_total',
                'cost_total',
                'profit_total',
                'commission_rate_percent',
                'management_fee_total',
                'tenant_payout_total',
                'margin_percentage',
                'grand_total',
                'payment_status',
                'settlement_status',
                'settled_at',
                'payout_reference',
                'payout_paid_at',
                'payout_notes',
            ]);

            foreach ($allocations as $allocation) {
                fputcsv($handle, [
                    $allocation->allocation_number,
                    $allocation->transaction?->invoice,
                    $allocation->transaction?->created_at,
                    $allocation->tenantOutlet?->code,
                    $allocation->tenantOutlet?->name,
                    (int) ($allocation->total_items ?? 0),
                    (int) ($allocation->subtotal ?? 0),
                    (int) ($allocation->promo_discount_total ?? 0),
                    (int) ($allocation->voucher_discount_total ?? 0),
                    (int) ($allocation->loyalty_discount_total ?? 0),
                    (int) ($allocation->manual_discount_total ?? 0),
                    (int) ($allocation->cost_total ?? 0),
                    (int) ($allocation->profit_total ?? 0),
                    (float) ($allocation->commission_rate_percent ?? 0),
                    (int) ($allocation->management_fee_total ?? 0),
                    (int) ($allocation->tenant_payout_total ?? 0),
                    (float) ($allocation->margin_percentage ?? 0),
                    (int) ($allocation->grand_total ?? 0),
                    (string) ($allocation->payment_status ?? ''),
                    $allocation->settled_at ? 'settled' : 'outstanding',
                    optional($allocation->settled_at)?->format('Y-m-d H:i:s'),
                    (string) ($allocation->payout_reference ?? ''),
                    optional($allocation->payout_paid_at)?->format('Y-m-d H:i:s'),
                    (string) ($allocation->payout_notes ?? ''),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function tenantStatement(Request $request, Outlet $tenantOutlet)
    {
        $outletId = $this->outletResolver->resolve($request, $request->user())?->id;
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'settlement_status' => $request->input('settlement_status'),
            'outlet_id' => $outletId,
            'tenant_outlet_id' => $tenantOutlet->id,
        ];

        $baseQuery = $this->applyAllocationFilters(
            TransactionTenantAllocation::query()
                ->with(['transaction:id,invoice,created_at,payment_status', 'tenantOutlet:id,name,code,commission_rate_percent'])
                ->select('transaction_tenant_allocations.*')
                ->selectSub(
                    TransactionTenantAllocationItem::query()
                        ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0)')
                        ->whereColumn('transaction_tenant_allocation_id', 'transaction_tenant_allocations.id'),
                    'cost_total'
                )
                ->withSum('items as total_items', 'qty'),
            $filters
        );

        $metricAllocations = $this->appendAllocationMetrics((clone $baseQuery)->get());
        $allocations = $this->appendAllocationMetrics(
            (clone $baseQuery)->orderByDesc('created_at')->paginate(20)->withQueryString()
        );

        $summary = [
            'allocation_count' => $metricAllocations->count(),
            'revenue_total' => (int) $metricAllocations->sum('grand_total'),
            'settled_total' => (int) $metricAllocations->filter(fn ($allocation) => filled($allocation->settled_at))->sum('grand_total'),
            'cost_total' => (int) $metricAllocations->sum('cost_total'),
            'profit_total' => (int) $metricAllocations->sum('profit_total'),
            'management_fee_total' => (int) round($metricAllocations->sum('management_fee_total')),
            'tenant_payout_total' => (int) round($metricAllocations->sum('tenant_payout_total')),
        ];
        $summary['outstanding_total'] = max(0, $summary['revenue_total'] - $summary['settled_total']);
        $summary['margin_percentage'] = $summary['revenue_total'] > 0
            ? round(($summary['profit_total'] / $summary['revenue_total']) * 100, 2)
            : 0.0;

        return Inertia::render('Dashboard/Reports/TenantStatement', [
            'tenantOutlet' => [
                'id' => $tenantOutlet->id,
                'name' => $tenantOutlet->name,
                'code' => $tenantOutlet->code,
                'commission_rate_percent' => (float) ($tenantOutlet->commission_rate_percent ?? 0),
            ],
            'summary' => $summary,
            'allocations' => $allocations,
            'filters' => [
                'start_date' => $filters['start_date'],
                'end_date' => $filters['end_date'],
                'settlement_status' => $filters['settlement_status'],
            ],
        ]);
    }

    public function exportTenantStatement(Request $request, Outlet $tenantOutlet)
    {
        $outletId = $this->outletResolver->resolve($request, $request->user())?->id;
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'settlement_status' => $request->input('settlement_status'),
            'outlet_id' => $outletId,
            'tenant_outlet_id' => $tenantOutlet->id,
        ];

        $allocations = $this->applyAllocationFilters(
            TransactionTenantAllocation::query()
                ->with(['transaction:id,invoice,created_at,payment_status', 'tenantOutlet:id,name,code,commission_rate_percent'])
                ->select('transaction_tenant_allocations.*')
                ->selectSub(
                    TransactionTenantAllocationItem::query()
                        ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0)')
                        ->whereColumn('transaction_tenant_allocation_id', 'transaction_tenant_allocations.id'),
                    'cost_total'
                )
                ->withSum('items as total_items', 'qty')
                ->orderByDesc('created_at'),
            $filters
        )->get();
        $allocations = $this->appendAllocationMetrics($allocations);

        $tenantSlug = str($tenantOutlet->code ?: $tenantOutlet->name ?: 'tenant')
            ->slug()
            ->value();
        $filename = "tenant-statement-{$tenantSlug}-".now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($allocations) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'allocation_number',
                'invoice',
                'transaction_date',
                'items_count',
                'revenue_total',
                'cost_total',
                'profit_total',
                'commission_rate_percent',
                'management_fee_total',
                'tenant_payout_total',
                'settlement_status',
                'settled_at',
                'payout_reference',
                'payout_paid_at',
                'payout_notes',
            ]);

            foreach ($allocations as $allocation) {
                fputcsv($handle, [
                    (string) ($allocation->allocation_number ?? ''),
                    (string) ($allocation->transaction?->invoice ?? ''),
                    optional($allocation->transaction?->created_at)?->format('Y-m-d H:i:s'),
                    (int) ($allocation->total_items ?? 0),
                    (int) ($allocation->grand_total ?? 0),
                    (int) ($allocation->cost_total ?? 0),
                    (int) ($allocation->profit_total ?? 0),
                    (float) ($allocation->commission_rate_percent ?? 0),
                    (int) ($allocation->management_fee_total ?? 0),
                    (int) ($allocation->tenant_payout_total ?? 0),
                    $allocation->settled_at ? 'settled' : 'outstanding',
                    optional($allocation->settled_at)?->format('Y-m-d H:i:s'),
                    (string) ($allocation->payout_reference ?? ''),
                    optional($allocation->payout_paid_at)?->format('Y-m-d H:i:s'),
                    (string) ($allocation->payout_notes ?? ''),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function settleTenantAllocation(Request $request, TransactionTenantAllocation $allocation)
    {
        $activeOutletId = $this->outletResolver->resolve($request, $request->user())?->id;

        if ($activeOutletId && (int) $allocation->outlet_id !== (int) $activeOutletId) {
            abort(404);
        }

        $validated = $request->validate([
            'payout_reference' => ['nullable', 'string', 'max:100'],
            'payout_notes' => ['nullable', 'string', 'max:500'],
            'payout_paid_at' => ['nullable', 'date'],
        ]);

        $allocation->forceFill([
            'settled_at' => Carbon::now(),
            'payout_reference' => $validated['payout_reference'] ?? null,
            'payout_notes' => $validated['payout_notes'] ?? null,
            'payout_paid_at' => isset($validated['payout_paid_at'])
                ? Carbon::parse($validated['payout_paid_at'])
                : Carbon::now(),
        ])->save();

        return back()->with('success', "Settlement tenant {$allocation->allocation_number} ditandai selesai.");
    }

    public function unsettleTenantAllocation(Request $request, TransactionTenantAllocation $allocation)
    {
        $activeOutletId = $this->outletResolver->resolve($request, $request->user())?->id;

        if ($activeOutletId && (int) $allocation->outlet_id !== (int) $activeOutletId) {
            abort(404);
        }

        $allocation->forceFill([
            'settled_at' => null,
            'payout_reference' => null,
            'payout_notes' => null,
            'payout_paid_at' => null,
        ])->save();

        return back()->with('success', "Settlement tenant {$allocation->allocation_number} dibuka kembali.");
    }

    protected function appendAllocationMetrics($allocations)
    {
        if ($allocations instanceof \Illuminate\Contracts\Pagination\LengthAwarePaginator) {
            $allocations->setCollection($this->appendAllocationMetrics($allocations->getCollection()));

            return $allocations;
        }

        return $allocations->map(function ($allocation) {
            $revenueTotal = (int) ($allocation->grand_total ?? 0);
            $costTotal = (int) ($allocation->cost_total ?? 0);
            $profitTotal = $revenueTotal - $costTotal;
            $commissionRate = (float) ($allocation->tenantOutlet?->commission_rate_percent ?? 0);
            $managementFeeTotal = (int) round(max(0, $profitTotal) * ($commissionRate / 100));
            $tenantPayoutTotal = $profitTotal - $managementFeeTotal;

            $allocation->setAttribute('cost_total', $costTotal);
            $allocation->setAttribute('profit_total', $profitTotal);
            $allocation->setAttribute('commission_rate_percent', $commissionRate);
            $allocation->setAttribute('management_fee_total', $managementFeeTotal);
            $allocation->setAttribute('tenant_payout_total', $tenantPayoutTotal);
            $allocation->setAttribute('margin_percentage', $revenueTotal > 0
                ? round(($profitTotal / $revenueTotal) * 100, 2)
                : 0.0);

            return $allocation;
        });
    }
}
