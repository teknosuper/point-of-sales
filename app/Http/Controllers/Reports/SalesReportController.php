<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Outlet;
use App\Models\Profit;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use Carbon\Carbon;
use App\Services\OutletResolver;
use App\Services\SalesAnalyticsService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class SalesReportController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver,
        private readonly SalesAnalyticsService $analyticsService
    ) {}

    /**
     * Display the sales report.
     */
    public function index(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $outletId = $activeOutlet?->id;
        $isTenantOutlet = (string) ($activeOutlet?->outlet_type ?? '') === 'tenant';
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'invoice' => $request->input('invoice'),
            'cashier_id' => $request->input('cashier_id'),
            'customer_id' => $request->input('customer_id'),
            'tenant_outlet_id' => $isTenantOutlet ? $outletId : $request->input('tenant_outlet_id'),
            'settlement_status' => $request->input('settlement_status'),
            'outlet_id' => $isTenantOutlet ? null : $outletId,
        ];

        if ($isTenantOutlet) {
            return $this->renderTenantSalesReport($request, $filters, $outletId);
        }

        $baseListQuery = $this->applyFilters(
            Transaction::query()
                ->with(['cashier:id,name', 'customer:id,name'])
                ->withSum('details as total_items', 'qty')
                ->withSum('profits as total_profit', 'total'),
            $filters
        )->orderByDesc('created_at');

        $detailColumns = $this->transactionDetailSelectColumns();

        $transactions = (clone $baseListQuery)
            ->with(['details' => fn ($query) => $query
                ->select($detailColumns)
                ->with(['product:id,title'])])
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Transaction $transaction) => $this->transformTransactionRow($transaction));

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
        $discountSplit = $transactionIds->isNotEmpty()
            && Schema::hasColumn('transaction_details', 'tenant_discount_total')
            && Schema::hasColumn('transaction_details', 'owner_discount_total')
            ? TransactionDetail::query()
                ->whereIn('transaction_id', $transactionIds)
                ->selectRaw('COALESCE(SUM(tenant_discount_total), 0) as tenant_discount_total')
                ->selectRaw('COALESCE(SUM(owner_discount_total), 0) as owner_discount_total')
                ->first()
            : null;

        $profitTotal = $transactionIds->isNotEmpty()
            ? Profit::whereIn('transaction_id', $transactionIds)->sum('total')
            : 0;

        $tenantAllocationBaseQuery = $this->applyAllocationFilters(
            $this->withAllocationDiscountSplit(TransactionTenantAllocation::query())
                ->with(['tenantOutlet:id,name,code,commission_rate_percent', 'transaction:id,invoice,created_at,payment_status', 'validatedBy:id,name'])
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
            'tenant_discount_total' => (int) ($discountSplit->tenant_discount_total ?? 0),
            'owner_discount_total' => (int) ($discountSplit->owner_discount_total ?? 0),
            'items_sold' => (int) $itemsSold,
            'profit_total' => (int) $profitTotal,
            'average_order' => ($totals->orders_count ?? 0) > 0
                ? (int) round($totals->revenue_total / $totals->orders_count)
                : 0,
        ];
        $summary['walk_in_count'] = (clone $aggregateQuery)->whereNull('customer_id')->count();
        $summary['registered_customer_count'] = max(0, $summary['orders_count'] - $summary['walk_in_count']);
        $tenantSummary['management_fee_total'] = (int) round($tenantMetricAllocations->sum('management_fee_total'));
        $tenantSummary['tenant_payout_total'] = (int) round($tenantMetricAllocations->sum('tenant_payout_total'));
        $dailyRecap = $this->buildAllocationDailyRecap($tenantMetricAllocations);
        $targets = $this->targetSummary($summary, $outletId, $filters);

        // Build enhanced analytics using service
        $analytics = [
            'hourly_breakdown' => $this->analyticsService->buildHourlyBreakdown($aggregateQuery),
            'daily_breakdown' => $this->analyticsService->buildDailyBreakdown($aggregateQuery),
            'top_products' => $this->analyticsService->buildTopProducts($transactionIds, 10),
            'slow_moving_products' => $this->analyticsService->buildSlowMovingProducts($transactionIds, 10),
            'category_breakdown' => $this->analyticsService->buildCategoryBreakdown($transactionIds),
            'payment_method_breakdown' => $this->analyticsService->buildPaymentMethodBreakdown($aggregateQuery),
        ];

        return Inertia::render('Dashboard/Reports/Sales', [
            'transactions' => $transactions,
            'summary' => $summary,
            'targets' => $targets,
            'analytics' => $analytics,
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
                'daily_recap' => $dailyRecap,
            ],
            'filters' => $filters,
            'cashiers' => User::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::select('id', 'name')->orderBy('name')->get(),
            'tenantOutlets' => $this->accessibleTenantOutlets($request)
                ->get(['outlets.id', 'outlets.name', 'outlets.code']),
            'workspace' => [
                'is_tenant_workspace' => false,
                'active_outlet' => $activeOutlet ? [
                    'id' => $activeOutlet->id,
                    'name' => $activeOutlet->name,
                    'code' => $activeOutlet->code,
                    'outlet_type' => $activeOutlet->outlet_type,
                ] : null,
            ],
        ]);
    }

    protected function renderTenantSalesReport(Request $request, array $filters, int $tenantOutletId)
    {
        $tenantBaseQuery = $this->applyAllocationFilters(
            $this->withAllocationDiscountSplit(TransactionTenantAllocation::query())
                ->with([
                    'transaction.customer:id,name',
                    'transaction.cashier:id,name',
                    'items.product:id,title,tenant_hpp_price,buy_price',
                    'tenantOutlet:id,name,code,commission_rate_percent',
                    'validatedBy:id,name',
                ])
                ->select('transaction_tenant_allocations.*')
                ->selectSub(
                    TransactionTenantAllocationItem::query()
                        ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0)')
                        ->whereColumn('transaction_tenant_allocation_id', 'transaction_tenant_allocations.id'),
                    'cost_total'
                )
                ->withSum('items as total_items', 'qty'),
            $filters
        )->orderByDesc('created_at');

        $tenantMetricAllocations = $this->appendTenantWorkspaceAllocationMetrics((clone $tenantBaseQuery)->get());
        $transactions = $this->appendTenantWorkspaceAllocationMetrics(
            (clone $tenantBaseQuery)->paginate(10)->withQueryString()
        )->through(fn (TransactionTenantAllocation $allocation) => $this->transformTenantAllocationTransactionRow($allocation));

        $summary = [
            'orders_count' => (int) $tenantMetricAllocations->count(),
            'revenue_total' => (int) $tenantMetricAllocations->sum('grand_total'),
            'discount_total' => (int) $tenantMetricAllocations->sum('total_discount_total'),
            'tenant_discount_total' => (int) $tenantMetricAllocations->sum('tenant_discount_total'),
            'owner_discount_total' => 0,
            'items_sold' => (int) $tenantMetricAllocations->sum('total_items'),
            'profit_total' => (int) $tenantMetricAllocations->sum('profit_total'),
        ];
        $summary['average_order'] = $summary['orders_count'] > 0
            ? (int) round($summary['revenue_total'] / $summary['orders_count'])
            : 0;
        $summary['walk_in_count'] = (int) $tenantMetricAllocations
            ->filter(fn ($allocation) => blank($allocation->transaction?->customer_id))
            ->count();
        $summary['registered_customer_count'] = max(0, $summary['orders_count'] - $summary['walk_in_count']);

        $tenantAllocations = $this->appendTenantWorkspaceAllocationMetrics(
            (clone $tenantBaseQuery)->limit(20)->get()
        );

        $tenantSummary = [
            'allocation_count' => (int) $tenantMetricAllocations->count(),
            'tenant_count' => 1,
            'revenue_total' => (int) $tenantMetricAllocations->sum('grand_total'),
            'settled_total' => (int) $tenantMetricAllocations->filter(fn ($allocation) => filled($allocation->settled_at))->sum('grand_total'),
            'cost_total' => (int) $tenantMetricAllocations->sum('cost_total'),
            'profit_total' => (int) $tenantMetricAllocations->sum('profit_total'),
            'management_fee_total' => (int) round($tenantMetricAllocations->sum('management_fee_total')),
            'tenant_payout_total' => (int) round($tenantMetricAllocations->sum('tenant_payout_total')),
            'margin_percentage' => $summary['revenue_total'] > 0
                ? round(($summary['profit_total'] / $summary['revenue_total']) * 100, 2)
                : 0.0,
        ];
        $tenantSummary['outstanding_total'] = max(0, $tenantSummary['revenue_total'] - $tenantSummary['settled_total']);

        $topTenantOutlet = $tenantMetricAllocations->first()?->tenantOutlet;
        $topTenants = collect();
        if ($topTenantOutlet) {
            $topTenants = collect([[
                'tenant_outlet_id' => $topTenantOutlet->id,
                'tenant_outlet' => [
                    'id' => $topTenantOutlet->id,
                    'name' => $topTenantOutlet->name,
                    'code' => $topTenantOutlet->code,
                ],
                'orders_count' => $tenantSummary['allocation_count'],
                'revenue_total' => $tenantSummary['revenue_total'],
                'cost_total' => $tenantSummary['cost_total'],
                'profit_total' => $tenantSummary['profit_total'],
                'management_fee_total' => $tenantSummary['management_fee_total'],
                'tenant_payout_total' => $tenantSummary['tenant_payout_total'],
                'margin_percentage' => $tenantSummary['margin_percentage'],
            ]]);
        }

        $targets = $this->targetSummary($summary, $tenantOutletId, $filters);

        // Build analytics for tenant workspace - query from transaction (has discount column)
        $tenantAnalyticsQuery = Transaction::query()
            ->whereHas('tenantAllocations', fn ($q) => $q->where('tenant_outlet_id', $tenantOutletId))
            ->when($filters['start_date'] ?? null, fn ($q, $start) => $q->whereDate('created_at', '>=', $start))
            ->when($filters['end_date'] ?? null, fn ($q, $end) => $q->whereDate('created_at', '<=', $end));

        $analytics = [
            'hourly_breakdown' => $this->analyticsService->buildHourlyBreakdown((clone $tenantAnalyticsQuery)),
            'daily_breakdown' => $this->analyticsService->buildDailyBreakdown((clone $tenantAnalyticsQuery)),
            'top_products' => [],
            'slow_moving_products' => [],
            'category_breakdown' => [],
            'payment_method_breakdown' => $this->analyticsService->buildPaymentMethodBreakdown((clone $tenantAnalyticsQuery)),
        ];

        return Inertia::render('Dashboard/Reports/Sales', [
            'transactions' => $transactions,
            'summary' => $summary,
            'targets' => $targets,
            'analytics' => $analytics,
            'tenantSettlement' => [
                'summary' => $tenantSummary,
                'top_tenants' => $topTenants,
                'allocations' => $tenantAllocations,
                'daily_recap' => $this->buildAllocationDailyRecap($tenantMetricAllocations),
            ],
            'filters' => $filters,
            'cashiers' => User::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::select('id', 'name')->orderBy('name')->get(),
            'tenantOutlets' => $this->accessibleTenantOutlets($request)
                ->where('outlets.id', $tenantOutletId)
                ->get(['outlets.id', 'outlets.name', 'outlets.code']),
            'workspace' => [
                'is_tenant_workspace' => true,
                'active_outlet' => $topTenantOutlet ? [
                    'id' => $topTenantOutlet->id,
                    'name' => $topTenantOutlet->name,
                    'code' => $topTenantOutlet->code,
                    'outlet_type' => 'tenant',
                ] : null,
            ],
        ]);
    }

    private function accessibleTenantOutlets(Request $request)
    {
        $user = $request->user();

        if (! $user) {
            return Outlet::query()->whereRaw('1 = 0');
        }

        return $user->accessibleOutletsQuery()
            ->active()
            ->where('outlet_type', 'tenant')
            ->ordered();
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
            ->when($filters['customer_id'] ?? null, function ($q, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $q->whereNull('customer_id'),
                    default => $q->where('customer_id', $customer),
                };
            })
            ->when($filters['start_date'] ?? null, fn ($q, $start) => $q->whereDate('created_at', '>=', $start))
            ->when($filters['end_date'] ?? null, fn ($q, $end) => $q->whereDate('created_at', '<=', $end));
    }

    protected function transactionDetailSelectColumns(): array
    {
        $columns = [
            'id',
            'transaction_id',
            'product_id',
            'qty',
            'price',
            'unit_price',
            'discount_total',
        ];

        foreach ([
            'customer_base_unit_price',
            'tenant_discount_total',
            'owner_discount_total',
            'tenant_net_total',
            'owner_net_total',
            'pricing_rule_name',
            'pricing_rule_kind',
        ] as $column) {
            if (Schema::hasColumn('transaction_details', $column)) {
                $columns[] = $column;
            }
        }

        return $columns;
    }

    protected function transformTransactionRow(Transaction $transaction): array
    {
        $prePromoSubtotal = (int) $transaction->details->sum(function (TransactionDetail $detail) {
            $baseUnitPrice = (int) ($detail->customer_base_unit_price ?? $detail->unit_price ?? 0);

            return $baseUnitPrice * (int) $detail->qty;
        });

        return [
            ...$transaction->toArray(),
            'pre_promo_subtotal' => $prePromoSubtotal,
            'tenant_discount_total' => (int) $transaction->details->sum(
                fn (TransactionDetail $detail) => (int) ($detail->tenant_discount_total ?? 0)
            ),
            'owner_discount_total' => (int) $transaction->details->sum(
                fn (TransactionDetail $detail) => (int) ($detail->owner_discount_total ?? 0)
            ),
            'tenant_net_total' => (int) $transaction->details->sum(
                fn (TransactionDetail $detail) => (int) ($detail->tenant_net_total ?? 0)
            ),
            'owner_net_total' => (int) $transaction->details->sum(
                fn (TransactionDetail $detail) => (int) ($detail->owner_net_total ?? 0)
            ),
            'detail_items' => $transaction->details
                ->map(fn (TransactionDetail $detail) => [
                    'id' => $detail->id,
                    'product_name' => $detail->product?->title ?? 'Produk',
                    'qty' => (int) $detail->qty,
                    'line_total' => (int) $detail->price,
                    'pre_promo_total' => (int) ($detail->customer_base_unit_price ?? $detail->unit_price ?? 0) * (int) $detail->qty,
                    'tenant_discount_total' => (int) ($detail->tenant_discount_total ?? 0),
                    'owner_discount_total' => (int) ($detail->owner_discount_total ?? 0),
                    'tenant_net_total' => (int) ($detail->tenant_net_total ?? 0),
                    'owner_net_total' => (int) ($detail->owner_net_total ?? 0),
                    'pricing_rule_name' => $detail->pricing_rule_name,
                    'pricing_rule_kind' => $detail->pricing_rule_kind,
                ])
                ->values()
                ->all(),
        ];
    }

    protected function transformTenantAllocationTransactionRow(TransactionTenantAllocation $allocation): array
    {
        $transaction = $allocation->transaction;

        return [
            'id' => $allocation->id,
            'invoice' => $transaction?->invoice ?? $allocation->allocation_number,
            'created_at' => optional($transaction?->created_at)?->format('Y-m-d H:i:s'),
            'customer' => $transaction?->customer ? [
                'name' => $transaction->customer->name,
            ] : null,
            'cashier' => $transaction?->cashier ? [
                'name' => $transaction->cashier->name,
            ] : null,
            'total_items' => (int) ($allocation->total_items ?? 0),
            'grand_total' => (int) ($allocation->grand_total ?? 0),
            'pre_promo_subtotal' => (int) ($allocation->pre_promo_subtotal ?? 0),
            'base_cost_total' => (int) ($allocation->cost_total ?? 0),
            'tenant_discount_total' => (int) ($allocation->tenant_discount_total ?? 0),
            'owner_discount_total' => (int) ($allocation->owner_discount_total ?? 0),
            'tenant_net_total' => (int) ($allocation->grand_total ?? 0),
            'owner_net_total' => 0,
            'total_profit' => (int) ($allocation->profit_total ?? 0),
            'detail_items' => $allocation->items->map(function (TransactionTenantAllocationItem $item) {
                $prePromoTotal = (int) ($item->line_total ?? 0) + (int) ($item->discount_total ?? 0);

                return [
                    'id' => $item->id,
                    'product_name' => $item->product?->title ?? 'Produk',
                    'qty' => (int) ($item->qty ?? 0),
                    'line_total' => (int) ($item->line_total ?? 0),
                    'base_cost_total' => (int) ($item->product?->tenant_hpp_price ?? $item->base_unit_price ?? 0) * (int) ($item->qty ?? 0),
                    'pre_promo_total' => $prePromoTotal,
                    'tenant_discount_total' => (int) ($item->discount_total ?? 0),
                    'owner_discount_total' => 0,
                    'tenant_net_total' => (int) ($item->line_total ?? 0),
                    'owner_net_total' => 0,
                    'pricing_rule_name' => null,
                    'pricing_rule_kind' => null,
                ];
            })->values()->all(),
        ];
    }

    protected function targetSummary(array $summary, ?int $outletId, array $filters): array
    {
        $salesTarget = Setting::getInt('monthly_sales_target', 0, $outletId);
        $profitTarget = Setting::getInt('monthly_profit_target', 0, $outletId);

        $salesActual = (int) ($summary['revenue_total'] ?? 0);
        $profitActual = (int) ($summary['profit_total'] ?? 0);

        return [
            'period_label' => $this->resolvePeriodLabel($filters),
            'sales_target' => $salesTarget,
            'sales_actual' => $salesActual,
            'sales_gap' => $salesTarget > 0 ? $salesActual - $salesTarget : 0,
            'sales_progress_percent' => $salesTarget > 0
                ? round(($salesActual / $salesTarget) * 100, 2)
                : null,
            'sales_met' => $salesTarget > 0 ? $salesActual >= $salesTarget : null,
            'profit_target' => $profitTarget,
            'profit_actual' => $profitActual,
            'profit_gap' => $profitTarget > 0 ? $profitActual - $profitTarget : 0,
            'profit_progress_percent' => $profitTarget > 0
                ? round(($profitActual / $profitTarget) * 100, 2)
                : null,
            'profit_met' => $profitTarget > 0 ? $profitActual >= $profitTarget : null,
        ];
    }

    protected function resolvePeriodLabel(array $filters): string
    {
        if (! empty($filters['start_date']) && ! empty($filters['end_date'])) {
            return Carbon::parse($filters['start_date'])->format('d M Y').' - '.Carbon::parse($filters['end_date'])->format('d M Y');
        }

        if (! empty($filters['start_date'])) {
            return 'Sejak '.Carbon::parse($filters['start_date'])->format('d M Y');
        }

        if (! empty($filters['end_date'])) {
            return 'Sampai '.Carbon::parse($filters['end_date'])->format('d M Y');
        }

        return 'Periode berjalan';
    }

    protected function applyAllocationFilters($query, array $filters)
    {
        return $query
            ->when($filters['outlet_id'] ?? null, fn ($q, $outletId) => $q->where('outlet_id', $outletId))
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->whereHas('transaction', fn ($transactionQuery) => $transactionQuery->where('invoice', 'like', '%'.$invoice.'%')))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashierId) => $q->where('cashier_id', $cashierId))
            ->when($filters['customer_id'] ?? null, function ($q, $customerId) {
                return match ((string) $customerId) {
                    'walk_in' => $q->whereHas('transaction', fn ($transactionQuery) => $transactionQuery->whereNull('customer_id')),
                    default => $q->whereHas('transaction', fn ($transactionQuery) => $transactionQuery->where('customer_id', $customerId)),
                };
            })
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
            $this->withAllocationDiscountSplit(TransactionTenantAllocation::query())
                ->with(['tenantOutlet:id,name,code,commission_rate_percent', 'transaction:id,invoice,created_at,payment_status', 'validatedBy:id,name'])
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
                'pre_promo_subtotal',
                'subtotal',
                'total_discount_total',
                'tenant_discount_total',
                'owner_discount_total',
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
                'validated_by',
                'validated_at',
                'payout_reference',
                'payout_paid_at',
                'payout_cash_amount',
                'payout_transfer_amount',
                'payout_other_amount',
                'payout_other_label',
                'payout_recipient_name',
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
                    (int) ($allocation->pre_promo_subtotal ?? 0),
                    (int) ($allocation->subtotal ?? 0),
                    (int) ($allocation->total_discount_total ?? 0),
                    (int) ($allocation->tenant_discount_total ?? 0),
                    (int) ($allocation->owner_discount_total ?? 0),
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
                    (string) ($allocation->validatedBy?->name ?? ''),
                    optional($allocation->validated_at)?->format('Y-m-d H:i:s'),
                    (string) ($allocation->payout_reference ?? ''),
                    optional($allocation->payout_paid_at)?->format('Y-m-d H:i:s'),
                    (int) ($allocation->payout_cash_amount ?? 0),
                    (int) ($allocation->payout_transfer_amount ?? 0),
                    (int) ($allocation->payout_other_amount ?? 0),
                    (string) ($allocation->payout_other_label ?? ''),
                    (string) ($allocation->payout_recipient_name ?? ''),
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
            $this->withAllocationDiscountSplit(TransactionTenantAllocation::query())
                ->with(['transaction:id,invoice,created_at,payment_status', 'tenantOutlet:id,name,code,commission_rate_percent', 'validatedBy:id,name'])
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
        $dailyRecap = $this->buildAllocationDailyRecap($metricAllocations);

        return Inertia::render('Dashboard/Reports/TenantStatement', [
            'tenantOutlet' => [
                'id' => $tenantOutlet->id,
                'name' => $tenantOutlet->name,
                'code' => $tenantOutlet->code,
                'commission_rate_percent' => (float) ($tenantOutlet->commission_rate_percent ?? 0),
            ],
            'summary' => $summary,
            'allocations' => $allocations,
            'dailyRecap' => $dailyRecap,
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
            $this->withAllocationDiscountSplit(TransactionTenantAllocation::query())
                ->with(['transaction:id,invoice,created_at,payment_status', 'tenantOutlet:id,name,code,commission_rate_percent', 'validatedBy:id,name'])
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
                'pre_promo_subtotal',
                'subtotal_after_item_promo',
                'total_discount_total',
                'tenant_discount_total',
                'owner_discount_total',
                'promo_discount_total',
                'voucher_discount_total',
                'loyalty_discount_total',
                'manual_discount_total',
                'revenue_total',
                'cost_total',
                'profit_total',
                'commission_rate_percent',
                'management_fee_total',
                'tenant_payout_total',
                'settlement_status',
                'settled_at',
                'validated_by',
                'validated_at',
                'payout_reference',
                'payout_paid_at',
                'payout_cash_amount',
                'payout_transfer_amount',
                'payout_other_amount',
                'payout_other_label',
                'payout_recipient_name',
                'payout_notes',
            ]);

            foreach ($allocations as $allocation) {
                fputcsv($handle, [
                    (string) ($allocation->allocation_number ?? ''),
                    (string) ($allocation->transaction?->invoice ?? ''),
                    optional($allocation->transaction?->created_at)?->format('Y-m-d H:i:s'),
                    (int) ($allocation->total_items ?? 0),
                    (int) ($allocation->pre_promo_subtotal ?? 0),
                    (int) ($allocation->subtotal ?? 0),
                    (int) ($allocation->total_discount_total ?? 0),
                    (int) ($allocation->tenant_discount_total ?? 0),
                    (int) ($allocation->owner_discount_total ?? 0),
                    (int) ($allocation->promo_discount_total ?? 0),
                    (int) ($allocation->voucher_discount_total ?? 0),
                    (int) ($allocation->loyalty_discount_total ?? 0),
                    (int) ($allocation->manual_discount_total ?? 0),
                    (int) ($allocation->grand_total ?? 0),
                    (int) ($allocation->cost_total ?? 0),
                    (int) ($allocation->profit_total ?? 0),
                    (float) ($allocation->commission_rate_percent ?? 0),
                    (int) ($allocation->management_fee_total ?? 0),
                    (int) ($allocation->tenant_payout_total ?? 0),
                    $allocation->settled_at ? 'settled' : 'outstanding',
                    optional($allocation->settled_at)?->format('Y-m-d H:i:s'),
                    (string) ($allocation->validatedBy?->name ?? ''),
                    optional($allocation->validated_at)?->format('Y-m-d H:i:s'),
                    (string) ($allocation->payout_reference ?? ''),
                    optional($allocation->payout_paid_at)?->format('Y-m-d H:i:s'),
                    (int) ($allocation->payout_cash_amount ?? 0),
                    (int) ($allocation->payout_transfer_amount ?? 0),
                    (int) ($allocation->payout_other_amount ?? 0),
                    (string) ($allocation->payout_other_label ?? ''),
                    (string) ($allocation->payout_recipient_name ?? ''),
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
        $allocation = $this->resolveAllocationForSettlement($request, $allocation);

        $validated = $request->validate([
            'payout_reference' => ['nullable', 'string', 'max:100'],
            'payout_notes' => ['nullable', 'string', 'max:500'],
            'payout_paid_at' => ['nullable', 'date'],
            'payout_cash_amount' => ['nullable', 'numeric', 'min:0'],
            'payout_transfer_amount' => ['nullable', 'numeric', 'min:0'],
            'payout_other_amount' => ['nullable', 'numeric', 'min:0'],
            'payout_other_label' => ['nullable', 'string', 'max:60'],
            'payout_recipient_name' => ['required', 'string', 'max:120'],
        ]);

        $cashAmount = (int) round((float) ($validated['payout_cash_amount'] ?? 0));
        $transferAmount = (int) round((float) ($validated['payout_transfer_amount'] ?? 0));
        $otherAmount = (int) round((float) ($validated['payout_other_amount'] ?? 0));
        $totalPayoutBreakdown = $cashAmount + $transferAmount + $otherAmount;
        $expectedPayout = (int) ($allocation->tenant_payout_total ?? 0);

        if ($totalPayoutBreakdown !== $expectedPayout) {
            return back()->withErrors([
                'payout_cash_amount' => 'Total payout cash/transfer/lainnya harus sama dengan payout tenant.',
            ]);
        }

        if ($otherAmount > 0 && blank($validated['payout_other_label'] ?? null)) {
            return back()->withErrors([
                'payout_other_label' => 'Isi keterangan metode lainnya bila nominal lainnya dipakai.',
            ]);
        }

        $allocation->forceFill([
            'settled_at' => Carbon::now(),
            'validated_by' => $request->user()?->id,
            'validated_at' => Carbon::now(),
            'payout_reference' => $validated['payout_reference'] ?? null,
            'payout_notes' => $validated['payout_notes'] ?? null,
            'payout_paid_at' => isset($validated['payout_paid_at'])
                ? Carbon::parse($validated['payout_paid_at'])
                : Carbon::now(),
            'payout_cash_amount' => $cashAmount,
            'payout_transfer_amount' => $transferAmount,
            'payout_other_amount' => $otherAmount,
            'payout_other_label' => $validated['payout_other_label'] ?? null,
            'payout_recipient_name' => trim((string) $validated['payout_recipient_name']),
        ])->save();

        return back()->with('success', "Settlement tenant {$allocation->allocation_number} berhasil divalidasi.");
    }

    public function unsettleTenantAllocation(Request $request, TransactionTenantAllocation $allocation)
    {
        $allocation = $this->resolveAllocationForSettlement($request, $allocation);

        $allocation->forceFill([
            'settled_at' => null,
            'validated_by' => null,
            'validated_at' => null,
            'payout_reference' => null,
            'payout_notes' => null,
            'payout_paid_at' => null,
            'payout_cash_amount' => 0,
            'payout_transfer_amount' => 0,
            'payout_other_amount' => 0,
            'payout_other_label' => null,
            'payout_recipient_name' => null,
        ])->save();

        return back()->with('success', "Settlement tenant {$allocation->allocation_number} dibuka kembali.");
    }

    public function printTenantAllocationReceipt(Request $request, TransactionTenantAllocation $allocation)
    {
        $allocation = $this->resolveAllocationForSettlement($request, $allocation);
        abort_if(! $allocation->settled_at, 404, 'Settlement tenant belum divalidasi.');

        return response()->view('print.tenant_settlement_receipt', [
            'allocation' => $allocation,
            'autoprint' => $request->boolean('autoprint'),
        ]);
    }

    public function printTenantSettlementBatch(Request $request)
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
            $this->withAllocationDiscountSplit(TransactionTenantAllocation::query())
                ->with([
                    'tenantOutlet:id,name,code,commission_rate_percent',
                    'transaction:id,invoice,created_at,payment_status',
                    'validatedBy:id,name',
                ])
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

        $summary = [
            'allocation_count' => $allocations->count(),
            'tenant_count' => $allocations->pluck('tenant_outlet_id')->filter()->unique()->count(),
            'revenue_total' => (int) $allocations->sum('grand_total'),
            'cost_total' => (int) $allocations->sum('cost_total'),
            'profit_total' => (int) $allocations->sum('profit_total'),
            'tenant_discount_total' => (int) $allocations->sum('tenant_discount_total'),
            'owner_discount_total' => (int) $allocations->sum('owner_discount_total'),
            'management_fee_total' => (int) round($allocations->sum('management_fee_total')),
            'tenant_payout_total' => (int) round($allocations->sum('tenant_payout_total')),
            'settled_total' => (int) $allocations->filter(fn ($allocation) => filled($allocation->settled_at))->sum('tenant_payout_total'),
            'outstanding_total' => (int) $allocations->filter(fn ($allocation) => blank($allocation->settled_at))->sum('tenant_payout_total'),
        ];

        return response()->view('print.tenant_settlement_batch', [
            'allocations' => $allocations,
            'summary' => $summary,
            'filters' => $filters,
            'autoprint' => $request->boolean('autoprint'),
        ]);
    }

    protected function resolveAllocationForSettlement(Request $request, TransactionTenantAllocation $allocation): TransactionTenantAllocation
    {
        $activeOutletId = $this->outletResolver->resolve($request, $request->user())?->id;

        $query = $this->withAllocationDiscountSplit(TransactionTenantAllocation::query())
            ->with([
                'tenantOutlet:id,name,code,commission_rate_percent',
                'transaction:id,invoice,created_at,payment_status,payment_method',
                'validatedBy:id,name',
            ])
            ->select('transaction_tenant_allocations.*')
            ->selectSub(
                TransactionTenantAllocationItem::query()
                    ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0)')
                    ->whereColumn('transaction_tenant_allocation_id', 'transaction_tenant_allocations.id'),
                'cost_total'
            )
            ->withSum('items as total_items', 'qty')
            ->whereKey($allocation->id);

        if ($activeOutletId) {
            $query->where('outlet_id', $activeOutletId);
        }

        $resolved = $query->firstOrFail();

        return $this->appendAllocationMetrics(collect([$resolved]))->first();
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
            $promoDiscountTotal = (int) ($allocation->promo_discount_total ?? 0);
            $subtotal = (int) ($allocation->subtotal ?? 0);
            $prePromoSubtotal = $subtotal + $promoDiscountTotal;
            $totalDiscountTotal = $promoDiscountTotal
                + (int) ($allocation->voucher_discount_total ?? 0)
                + (int) ($allocation->loyalty_discount_total ?? 0)
                + (int) ($allocation->manual_discount_total ?? 0);

            $allocation->setAttribute('cost_total', $costTotal);
            $allocation->setAttribute('profit_total', $profitTotal);
            $allocation->setAttribute('commission_rate_percent', $commissionRate);
            $allocation->setAttribute('management_fee_total', $managementFeeTotal);
            $allocation->setAttribute('tenant_payout_total', $tenantPayoutTotal);
            $allocation->setAttribute('pricing_reference_total', $subtotal);
            $allocation->setAttribute('pre_promo_subtotal', $prePromoSubtotal);
            $allocation->setAttribute('total_discount_total', $totalDiscountTotal);
            $allocation->setAttribute('margin_percentage', $revenueTotal > 0
                ? round(($profitTotal / $revenueTotal) * 100, 2)
                : 0.0);
            $allocation->setAttribute(
                'payout_breakdown_total',
                (int) ($allocation->payout_cash_amount ?? 0)
                + (int) ($allocation->payout_transfer_amount ?? 0)
                + (int) ($allocation->payout_other_amount ?? 0)
            );
            $allocation->setAttribute('tenant_discount_total', (int) ($allocation->tenant_discount_total ?? 0));
            $allocation->setAttribute('owner_discount_total', (int) ($allocation->owner_discount_total ?? 0));

            return $allocation;
        });
    }

    protected function appendTenantWorkspaceAllocationMetrics($allocations)
    {
        if ($allocations instanceof \Illuminate\Contracts\Pagination\LengthAwarePaginator) {
            $allocations->setCollection($this->appendTenantWorkspaceAllocationMetrics($allocations->getCollection()));

            return $allocations;
        }

        return $allocations->map(function ($allocation) {
            $revenueTotal = (int) ($allocation->grand_total ?? 0);
            $hppTotal = (int) $allocation->items->sum(function (TransactionTenantAllocationItem $item) {
                $tenantHppPrice = (int) ($item->product?->tenant_hpp_price ?? $item->base_unit_price ?? 0);

                return $tenantHppPrice * (int) ($item->qty ?? 0);
            });
            $profitTotal = $revenueTotal - $hppTotal;
            $commissionRate = (float) ($allocation->tenantOutlet?->commission_rate_percent ?? 0);
            $managementFeeTotal = (int) round(max(0, $profitTotal) * ($commissionRate / 100));
            $tenantPayoutTotal = $profitTotal - $managementFeeTotal;
            $promoDiscountTotal = (int) ($allocation->promo_discount_total ?? 0);
            $subtotal = (int) ($allocation->subtotal ?? 0);
            $prePromoSubtotal = $subtotal + $promoDiscountTotal;
            $totalDiscountTotal = $promoDiscountTotal
                + (int) ($allocation->voucher_discount_total ?? 0)
                + (int) ($allocation->loyalty_discount_total ?? 0)
                + (int) ($allocation->manual_discount_total ?? 0);

            $allocation->setAttribute('cost_total', $hppTotal);
            $allocation->setAttribute('profit_total', $profitTotal);
            $allocation->setAttribute('commission_rate_percent', $commissionRate);
            $allocation->setAttribute('management_fee_total', $managementFeeTotal);
            $allocation->setAttribute('tenant_payout_total', $tenantPayoutTotal);
            $allocation->setAttribute('pricing_reference_total', $subtotal);
            $allocation->setAttribute('pre_promo_subtotal', $prePromoSubtotal);
            $allocation->setAttribute('total_discount_total', $totalDiscountTotal);
            $allocation->setAttribute('margin_percentage', $revenueTotal > 0
                ? round(($profitTotal / $revenueTotal) * 100, 2)
                : 0.0);
            $allocation->setAttribute(
                'payout_breakdown_total',
                (int) ($allocation->payout_cash_amount ?? 0)
                + (int) ($allocation->payout_transfer_amount ?? 0)
                + (int) ($allocation->payout_other_amount ?? 0)
            );
            $allocation->setAttribute('tenant_discount_total', $totalDiscountTotal);
            $allocation->setAttribute('owner_discount_total', 0);

            return $allocation;
        });
    }

    protected function withAllocationDiscountSplit($query)
    {
        if (
            ! Schema::hasColumn('transaction_details', 'tenant_outlet_id')
            || ! Schema::hasColumn('transaction_details', 'tenant_discount_total')
            || ! Schema::hasColumn('transaction_details', 'owner_discount_total')
        ) {
            return $query;
        }

        return $query
            ->selectSub(
                TransactionDetail::query()
                    ->selectRaw('COALESCE(SUM(tenant_discount_total), 0)')
                    ->whereColumn('transaction_id', 'transaction_tenant_allocations.transaction_id')
                    ->whereColumn('tenant_outlet_id', 'transaction_tenant_allocations.tenant_outlet_id'),
                'tenant_discount_total'
            )
            ->selectSub(
                TransactionDetail::query()
                    ->selectRaw('COALESCE(SUM(owner_discount_total), 0)')
                    ->whereColumn('transaction_id', 'transaction_tenant_allocations.transaction_id')
                    ->whereColumn('tenant_outlet_id', 'transaction_tenant_allocations.tenant_outlet_id'),
                'owner_discount_total'
            );
    }

    protected function buildAllocationDailyRecap(Collection $allocations): Collection
    {
        return $allocations
            ->groupBy(function ($allocation) {
                return optional($allocation->transaction?->created_at)->format('Y-m-d') ?: 'tanpa-tanggal';
            })
            ->map(function ($rows, $date) {
                $settledRows = $rows->filter(fn ($allocation) => filled($allocation->settled_at));
                $outstandingRows = $rows->filter(fn ($allocation) => blank($allocation->settled_at));

                return [
                    'date' => $date,
                    'label' => $date !== 'tanpa-tanggal'
                        ? Carbon::parse($date)->translatedFormat('d M Y')
                        : 'Tanpa tanggal',
                    'allocations_count' => $rows->count(),
                    'tenant_count' => $rows->pluck('tenant_outlet_id')->filter()->unique()->count(),
                    'revenue_total' => (int) $rows->sum('grand_total'),
                    'profit_total' => (int) $rows->sum('profit_total'),
                    'management_fee_total' => (int) round($rows->sum('management_fee_total')),
                    'tenant_payout_total' => (int) round($rows->sum('tenant_payout_total')),
                    'settled_payout_total' => (int) round($settledRows->sum('tenant_payout_total')),
                    'outstanding_payout_total' => (int) round($outstandingRows->sum('tenant_payout_total')),
                ];
            })
            ->sortByDesc('date')
            ->values();
    }
}
