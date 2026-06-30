<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\CashierSettlementRequest;
use App\Models\Customer;
use App\Models\Outlet;
use App\Models\Profit;
use App\Models\SalesReturn;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use Carbon\Carbon;
use App\Services\OutletResolver;
use App\Services\SalesAnalyticsService;
use App\Services\TransactionReturnImpactService;
use App\Support\ReportOwnerTenantSplit;
use App\Support\ReportTargetSummary;
use App\Support\ReportTenantSalesMetrics;
use App\Support\ReportTimezone;
use App\Support\TenantWalletMetrics;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class SalesReportController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver,
        private readonly SalesAnalyticsService $analyticsService,
        private readonly TransactionReturnImpactService $transactionReturnImpactService
    ) {}

    /**
     * Display the sales report.
     */
    public function index(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $outletId = $activeOutlet?->id;
        $isTenantOutlet = (string) ($activeOutlet?->outlet_type ?? '') === 'tenant';
        $activeTab = $this->resolveActiveTab($request);
        $settlementView = $this->resolveSettlementView($request);
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'invoice' => $request->input('invoice'),
            'cashier_id' => $request->input('cashier_id'),
            'customer_id' => $request->input('customer_id'),
            'tenant_outlet_id' => $isTenantOutlet ? $outletId : $request->input('tenant_outlet_id'),
            'settlement_status' => $request->input('settlement_status'),
            'mutation_q' => $request->input('mutation_q'),
            'outlet_id' => $isTenantOutlet ? null : $outletId,
        ];

        if ($isTenantOutlet) {
            return $this->renderTenantSalesReport($request, $filters, $outletId, $activeTab);
        }

        $baseListQuery = $this->applyFilters(
            Transaction::query()
                ->with(['cashier:id,name', 'customer:id,name'])
                ->withSum('details as total_items', 'qty')
                ->withSum('profits as total_profit', 'total'),
            $filters
        )->orderByDesc('created_at');

        // Filter by tenant_outlet_id if owner selected a specific tenant
        if (! $isTenantOutlet && ($filters['tenant_outlet_id'] ?? null)) {
            $baseListQuery->whereHas('details', fn ($q) => $q->where('tenant_outlet_id', $filters['tenant_outlet_id']));
        }

        $detailColumns = $this->transactionDetailSelectColumns();

        $transactions = null;
        if ($activeTab === 'transactions') {
            $transactions = (clone $baseListQuery)
                ->with(['details' => fn ($query) => $query
                    ->select($detailColumns)
                    ->with(['product:id,title', 'modifiers' => fn ($modifierQuery) => $modifierQuery->select(ReportOwnerTenantSplit::modifierSelectColumns())])])
                ->paginate(10, ['*'], 'transactions_page')
                ->withQueryString();
            $transactions->setCollection(
                $this->transactionReturnImpactService->enrichTransactions($transactions->getCollection())
            );
            $transactions->through(fn (Transaction $transaction) => $this->transformTransactionRow($transaction));
        }

        $aggregateQuery = $this->applyFilters(Transaction::query(), $filters);
        $transactionMetricRows = $this->transactionReturnImpactService->enrichTransactions(
            (clone $aggregateQuery)->get(['id', 'grand_total', 'discount', 'customer_id', 'created_at'])
        );
        $metricSummary = $this->transactionReturnImpactService->summarizeTransactionRows($transactionMetricRows);

        $transactionIds = (clone $aggregateQuery)->pluck('id');
        $transactionIdQuery = Transaction::query()
            ->when($filters['outlet_id'] ?? null, fn ($q, $outletId) => $q->where('outlet_id', $outletId))
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->where('invoice', 'like', '%'.$invoice.'%'))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashier) => $q->where('cashier_id', $cashier))
            ->when($filters['customer_id'] ?? null, function ($q, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $q->whereNull('customer_id'),
                    default => $q->where('customer_id', $customer),
                };
            });
        $transactionIdQuery = ReportTimezone::applySourceDateRange($transactionIdQuery->select('id'), 'created_at', $filters);
        if (! $isTenantOutlet && ($filters['tenant_outlet_id'] ?? null)) {
            $transactionIdQuery->whereHas('details', fn ($q) => $q->where('tenant_outlet_id', $filters['tenant_outlet_id']));
        }

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
        $ownerSplitSummary = ! $isTenantOutlet
            ? ReportOwnerTenantSplit::aggregateForTransactionIds($transactionIdQuery)
            : [
                'owner_product_markup_total' => 0,
                'owner_topping_markup_total' => 0,
                'owner_net_total' => 0,
            ];

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

        $tenantMetricAllocations = collect();
        $tenantAllocations = null;
        $settlementRequests = null;
        $settlementMutations = null;
        $settlementSummary = [
            'pending_count' => 0,
            'approved_count' => 0,
            'rejected_count' => 0,
            'requested_total' => 0,
            'approved_total' => 0,
            'pending_total' => 0,
            'outstanding_total' => 0,
            'balance_total' => 0,
        ];
        if ($activeTab === 'settlement') {
            $tenantMetricAllocations = (clone $tenantAllocationBaseQuery)
                ->get();
            $tenantMetricAllocations = $this->appendAllocationMetrics($tenantMetricAllocations);

            $tenantAllocations = (clone $tenantAllocationBaseQuery)
                ->orderByDesc('created_at')
                ->paginate(10, ['*'], 'settlement_page')
                ->withQueryString();
            $tenantAllocations = $this->appendAllocationMetrics($tenantAllocations);
            $tenantAllocations = $this->formatAllocationReportRows($tenantAllocations);

            $settlementRequests = $this->buildSettlementRequestPaginator($filters, false);
            $settlementSummary = $this->buildSettlementRequestSummary($filters, false);
            $settlementMutations = $this->buildSettlementMutationReport($filters, false);
        }

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

        $topTenants = $activeTab === 'settlement'
            ? $tenantMetricAllocations
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
                ->values()
            : collect();

        $summary = [
            'orders_count' => (int) $metricSummary['orders_count'],
            'revenue_total' => (int) $metricSummary['revenue_total'],
            'discount_total' => (int) $metricSummary['discount_total'],
            'tenant_discount_total' => (int) ($discountSplit->tenant_discount_total ?? 0),
            'owner_discount_total' => (int) ($discountSplit->owner_discount_total ?? 0),
            'items_sold' => (int) $itemsSold,
            'profit_total' => (int) $profitTotal,
            'owner_product_markup_total' => (int) ($ownerSplitSummary['owner_product_markup_total'] ?? 0),
            'owner_topping_markup_total' => (int) ($ownerSplitSummary['owner_topping_markup_total'] ?? 0),
            'owner_net_total' => (int) ($ownerSplitSummary['owner_net_total'] ?? 0),
            'average_order' => (int) $metricSummary['average_order'],
        ];
        $summary['walk_in_count'] = (int) $metricSummary['walk_in_count'];
        $summary['registered_customer_count'] = (int) $metricSummary['registered_customer_count'];
        $tenantSummary['management_fee_total'] = (int) round($tenantMetricAllocations->sum('management_fee_total'));
        $tenantSummary['tenant_payout_total'] = (int) round($tenantMetricAllocations->sum('tenant_payout_total'));
        $dailyRecap = $activeTab === 'settlement'
            ? $this->buildAllocationDailyRecap($tenantMetricAllocations)
            : collect();

        // Build analytics - filter by tenant_outlet_id if owner selected a specific tenant
        $analytics = [];
        if ($activeTab === 'analytics') {
            if (! $isTenantOutlet && ($filters['tenant_outlet_id'] ?? null)) {
                $tenantDetailIds = TransactionDetail::query()
                    ->where('tenant_outlet_id', $filters['tenant_outlet_id'])
                    ->whereIn('transaction_id', $transactionIds)
                    ->pluck('transaction_id')
                    ->unique();

                $tenantFilteredIds = $tenantDetailIds->isNotEmpty() ? $tenantDetailIds : collect([-1]);
                $tenantFilteredQuery = Transaction::query()->whereIn('id', $tenantFilteredIds);

                $analytics = [
                    'hourly_breakdown' => $this->analyticsService->buildHourlyBreakdown((clone $tenantFilteredQuery)),
                    'daily_breakdown' => $this->analyticsService->buildDailyBreakdown((clone $tenantFilteredQuery)),
                    'top_products' => $this->analyticsService->buildTopProducts($tenantFilteredIds, 10, $filters['tenant_outlet_id']),
                    'full_products' => $this->analyticsService->buildProductPerformance($tenantFilteredIds, null, $filters['tenant_outlet_id']),
                    'slow_moving_products' => $this->analyticsService->buildSlowMovingProducts($tenantFilteredIds, 10, $filters['tenant_outlet_id']),
                    'category_breakdown' => $this->analyticsService->buildCategoryBreakdown($tenantFilteredIds, $filters['tenant_outlet_id']),
                    'payment_method_breakdown' => $this->analyticsService->buildPaymentMethodBreakdown((clone $tenantFilteredQuery)),
                ];
            } else {
                $analytics = [
                    'hourly_breakdown' => $this->analyticsService->buildHourlyBreakdown($aggregateQuery),
                    'daily_breakdown' => $this->analyticsService->buildDailyBreakdown($aggregateQuery),
                    'top_products' => $this->analyticsService->buildTopProducts($transactionIds, 10),
                    'full_products' => $this->analyticsService->buildProductPerformance($transactionIds),
                    'slow_moving_products' => $this->analyticsService->buildSlowMovingProducts($transactionIds, 10),
                    'category_breakdown' => $this->analyticsService->buildCategoryBreakdown($transactionIds),
                    'payment_method_breakdown' => $this->analyticsService->buildPaymentMethodBreakdown($aggregateQuery),
                ];
            }
        }
        $targets = $this->targetSummary(
            $summary,
            $outletId,
            $filters,
            $this->buildOwnerTargetBreakdownRows(
                $transactionMetricRows,
                $transactionIds,
                $filters['tenant_outlet_id'] ?? null
            )
        );
        $ownerToppingBreakdown = ! $isTenantOutlet
            ? ReportOwnerTenantSplit::toppingBreakdownForTransactionIds(
                $transactionIdQuery,
                $filters['tenant_outlet_id'] ?? null
            )
            : [];

        return Inertia::render('Dashboard/Reports/Sales', [
            'transactions' => $transactions,
            'summary' => $summary,
            'targets' => $targets,
            'analytics' => $analytics,
            'ownerToppingBreakdown' => $ownerToppingBreakdown,
            'activeTab' => $activeTab,
            'settlementView' => $settlementView,
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
                    'outstanding_total' => (int) ($settlementSummary['outstanding_total'] ?? 0),
                    'request_pending_count' => (int) ($settlementSummary['pending_count'] ?? 0),
                    'request_approved_count' => (int) ($settlementSummary['approved_count'] ?? 0),
                    'request_rejected_count' => (int) ($settlementSummary['rejected_count'] ?? 0),
                    'request_pending_total' => (int) ($settlementSummary['pending_total'] ?? 0),
                    'request_approved_total' => (int) ($settlementSummary['approved_total'] ?? 0),
                    'request_balance_total' => (int) ($settlementSummary['balance_total'] ?? 0),
                ],
                'top_tenants' => $topTenants,
                'allocations' => $tenantAllocations,
                'requests' => $settlementRequests,
                'mutations' => $settlementMutations,
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
            'reportMeta' => [
                'timezone' => ReportTimezone::timezone(),
                'timezone_label' => ReportTimezone::timezoneLabel(),
            ],
        ]);
    }

    protected function renderTenantSalesReport(Request $request, array $filters, int $tenantOutletId, string $activeTab)
    {
        $settlementView = $this->resolveSettlementView($request);

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
        $activeTenantMetricAllocations = $this->excludeReturnedAllocations($tenantMetricAllocations);
        $transactions = null;
        if ($activeTab === 'transactions') {
            $transactions = $this->appendTenantWorkspaceAllocationMetrics(
                (clone $tenantBaseQuery)->paginate(10, ['*'], 'transactions_page')->withQueryString()
            )->through(fn (TransactionTenantAllocation $allocation) => $this->transformTenantAllocationTransactionRow($allocation));
        }

        $summary = ReportTenantSalesMetrics::summary($activeTenantMetricAllocations);

        $tenantAllocations = null;
        $settlementRequests = null;
        $settlementMutations = null;
        $settlementSummary = [
            'pending_count' => 0,
            'approved_count' => 0,
            'rejected_count' => 0,
            'requested_total' => 0,
            'approved_total' => 0,
            'pending_total' => 0,
            'outstanding_total' => 0,
            'balance_total' => 0,
        ];
        if ($activeTab === 'settlement') {
            $tenantAllocations = $this->appendTenantWorkspaceAllocationMetrics(
                (clone $tenantBaseQuery)->paginate(10, ['*'], 'settlement_page')->withQueryString()
            );
            $tenantAllocations = $this->formatAllocationReportRows($tenantAllocations);
            $settlementRequests = $this->buildSettlementRequestPaginator($filters, true);
            $settlementSummary = $this->buildSettlementRequestSummary($filters, true);
            $settlementMutations = $this->buildSettlementMutationReport($filters, true);
        }

        $tenantSummary = [
            'allocation_count' => (int) $activeTenantMetricAllocations->count(),
            'tenant_count' => 1,
            'revenue_total' => (int) $activeTenantMetricAllocations->sum('grand_total'),
            'settled_total' => (int) $activeTenantMetricAllocations->filter(fn ($allocation) => filled($allocation->settled_at))->sum('grand_total'),
            'cost_total' => (int) $activeTenantMetricAllocations->sum('cost_total'),
            'profit_total' => (int) $activeTenantMetricAllocations->sum('profit_total'),
            'management_fee_total' => (int) round($activeTenantMetricAllocations->sum('management_fee_total')),
            'tenant_payout_total' => (int) round($activeTenantMetricAllocations->sum('tenant_payout_total')),
            'margin_percentage' => $summary['revenue_total'] > 0
                ? round(($summary['profit_total'] / $summary['revenue_total']) * 100, 2)
                : 0.0,
        ];
        $tenantSummary['outstanding_total'] = max(0, $tenantSummary['revenue_total'] - $tenantSummary['settled_total']);

        $topTenantOutlet = $tenantMetricAllocations->first()?->tenantOutlet;
        $topTenants = collect();
        if ($activeTab === 'settlement' && $topTenantOutlet) {
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

        $tenantTransactionIds = $activeTenantMetricAllocations
            ->pluck('transaction_id')
            ->filter()
            ->unique()
            ->values();

        $topProducts = [];
        $fullProducts = [];
        $slowMovingProducts = [];
        $categoryBreakdown = [];
        $hourlyBreakdown = [];
        $dailyBreakdown = [];
        $paymentMethodBreakdown = [];

        if ($activeTab === 'analytics' && $tenantTransactionIds->isNotEmpty()) {
            $topProducts = $this->analyticsService->buildTopProducts($tenantTransactionIds, 10, $tenantOutletId);
            $fullProducts = $this->analyticsService->buildProductPerformance($tenantTransactionIds, null, $tenantOutletId);
            $slowMovingProducts = $this->analyticsService->buildSlowMovingProducts($tenantTransactionIds, 10, $tenantOutletId);
            $categoryBreakdown = $this->analyticsService->buildCategoryBreakdown($tenantTransactionIds, $tenantOutletId);
        }

        if ($activeTab === 'analytics') {
            $hourlyBreakdown = ReportTenantSalesMetrics::hourlyBreakdown($activeTenantMetricAllocations);
            $dailyBreakdown = ReportTenantSalesMetrics::dailyBreakdown($activeTenantMetricAllocations);
            $paymentMethodBreakdown = ReportTenantSalesMetrics::paymentMethodBreakdown($activeTenantMetricAllocations);
        }

        $analytics = [
            'hourly_breakdown' => $hourlyBreakdown,
            'daily_breakdown' => $dailyBreakdown,
            'top_products' => $topProducts,
            'full_products' => $fullProducts,
            'slow_moving_products' => $slowMovingProducts,
            'category_breakdown' => $categoryBreakdown,
            'payment_method_breakdown' => $paymentMethodBreakdown,
        ];
        $targets = $this->targetSummary(
            $summary,
            $tenantOutletId,
            $filters,
            $this->buildTenantTargetBreakdownRows($activeTenantMetricAllocations)
        );

        return Inertia::render('Dashboard/Reports/Sales', [
            'transactions' => $transactions,
            'summary' => $summary,
            'targets' => $targets,
            'analytics' => $analytics,
            'activeTab' => $activeTab,
            'settlementView' => $settlementView,
            'tenantSettlement' => [
                'summary' => [
                    ...$tenantSummary,
                    'request_pending_count' => (int) ($settlementSummary['pending_count'] ?? 0),
                    'request_approved_count' => (int) ($settlementSummary['approved_count'] ?? 0),
                    'request_rejected_count' => (int) ($settlementSummary['rejected_count'] ?? 0),
                    'request_pending_total' => (int) ($settlementSummary['pending_total'] ?? 0),
                    'request_approved_total' => (int) ($settlementSummary['approved_total'] ?? 0),
                    'request_balance_total' => (int) ($settlementSummary['balance_total'] ?? 0),
                    'outstanding_total' => (int) ($settlementSummary['outstanding_total'] ?? 0),
                ],
                'top_tenants' => $topTenants,
                'allocations' => $tenantAllocations,
                'requests' => $settlementRequests,
                'mutations' => $settlementMutations,
                'daily_recap' => $activeTab === 'settlement'
                    ? $this->buildAllocationDailyRecap($tenantMetricAllocations)
                    : collect(),
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
            'reportMeta' => [
                'timezone' => ReportTimezone::timezone(),
                'timezone_label' => ReportTimezone::timezoneLabel(),
            ],
        ]);
    }

    private function accessibleTenantOutlets(Request $request)
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);

        if (! $user) {
            return Outlet::query()->whereRaw('1 = 0');
        }

        $query = $user->accessibleOutletsQuery()
            ->active()
            ->where('outlet_type', 'tenant')
            ->ordered();

        if (($activeOutlet?->outlet_type ?? 'main') === 'main' && $activeOutlet?->id) {
            $query->where('parent_outlet_id', (int) $activeOutlet->id);
        }

        if (($activeOutlet?->outlet_type ?? '') === 'tenant' && $activeOutlet?->id) {
            $query->where('outlets.id', (int) $activeOutlet->id);
        }

        return $query;
    }

    /**
     * Apply table filters.
     */
    protected function applyFilters($query, array $filters)
    {
        $query = $query
            ->when($filters['outlet_id'] ?? null, fn ($q, $outletId) => $q->where('outlet_id', $outletId))
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->where('invoice', 'like', '%'.$invoice.'%'))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashier) => $q->where('cashier_id', $cashier))
            ->when($filters['customer_id'] ?? null, function ($q, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $q->whereNull('customer_id'),
                    default => $q->where('customer_id', $customer),
                };
            });

        return ReportTimezone::applySourceDateRange($query, 'created_at', $filters);
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
            'owner_markup_unit_price',
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

        $ownerSplit = ReportOwnerTenantSplit::summarizeDetails($transaction->details);

        return [
            ...$transaction->toArray(),
            'created_at' => $transaction->created_at
                ? ReportTimezone::formatSourceDateTime($transaction->getRawOriginal('created_at'), 'd M Y H:i')
                : null,
            'gross_grand_total' => (int) ($transaction->grand_total ?? 0),
            'returned_amount_total' => (int) ($transaction->returned_amount_total ?? 0),
            'grand_total' => (int) ($transaction->net_grand_total ?? $transaction->grand_total ?? 0),
            'is_fully_returned' => (bool) ($transaction->is_fully_returned ?? false),
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
            'owner_net_total' => (int) ($ownerSplit['owner_net_total'] ?? 0),
            'owner_product_markup_total' => (int) ($ownerSplit['owner_product_markup_total'] ?? 0),
            'owner_topping_markup_total' => (int) ($ownerSplit['owner_topping_markup_total'] ?? 0),
            'detail_items' => $transaction->details
                ->map(function (TransactionDetail $detail) {
                    $ownerSplit = ReportOwnerTenantSplit::detailOwnerSplit($detail);

                    return [
                        'id' => $detail->id,
                        'product_name' => $detail->product?->title ?? 'Produk',
                        'qty' => (int) $detail->qty,
                        'line_total' => $this->detailRevenueTotal($detail),
                        'pre_promo_total' => (int) ($detail->customer_base_unit_price ?? $detail->unit_price ?? 0) * (int) $detail->qty,
                        'tenant_discount_total' => (int) ($detail->tenant_discount_total ?? 0),
                        'owner_discount_total' => (int) ($detail->owner_discount_total ?? 0),
                        'tenant_net_total' => (int) ($detail->tenant_net_total ?? 0),
                        'owner_net_total' => (int) ($ownerSplit['owner_net_total'] ?? 0),
                        'owner_product_markup_total' => (int) ($ownerSplit['owner_product_markup_total'] ?? 0),
                        'owner_topping_markup_total' => (int) ($ownerSplit['owner_topping_markup_total'] ?? 0),
                        'pricing_rule_name' => $detail->pricing_rule_name,
                        'pricing_rule_kind' => $detail->pricing_rule_kind,
                        'modifier_items' => $detail->modifiers->map(fn ($modifier) => [
                            'id' => $modifier->id,
                            'name' => $modifier->name,
                            'qty' => (int) ($modifier->qty ?? 0),
                            'total_price' => (int) ($modifier->total_price ?? 0),
                            'base_total' => max(0, (int) ($modifier->base_price ?? 0)) * max(1, (int) ($modifier->qty ?? 0)),
                            'owner_markup_total' => max(0, (int) ($modifier->markup_price ?? 0)) * max(1, (int) ($modifier->qty ?? 0)),
                        ])->values()->all(),
                    ];
                })
                ->values()
                ->all(),
        ];
    }

    protected function detailRevenueTotal(TransactionDetail $detail): int
    {
        return (int) $detail->price + $this->detailModifierTotal($detail);
    }

    protected function detailModifierTotal(TransactionDetail $detail): int
    {
        if (! $detail->relationLoaded('modifiers')) {
            return 0;
        }

        return (int) $detail->modifiers->sum(fn ($modifier) => (int) ($modifier->total_price ?? 0));
    }

    protected function transformTenantAllocationTransactionRow(TransactionTenantAllocation $allocation): array
    {
        $transaction = $allocation->transaction;

        return [
            'id' => $allocation->id,
            'invoice' => $transaction?->invoice ?? $allocation->allocation_number,
            'created_at' => $transaction?->created_at
                ? ReportTimezone::formatSourceDateTime($transaction->getRawOriginal('created_at'), 'd M Y H:i')
                : null,
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

    protected function targetSummary(array $summary, ?int $outletId, array $filters, array $dailyMetrics = []): array
    {
        return ReportTargetSummary::build($summary, $outletId, $filters, $dailyMetrics);
    }

    protected function buildOwnerTargetBreakdownRows(Collection $transactionRows, Collection $transactionIds, mixed $tenantOutletId = null): array
    {
        if ($transactionRows->isEmpty() || $transactionIds->isEmpty()) {
            return [];
        }

        $itemsByTransaction = TransactionDetail::query()
            ->selectRaw('transaction_id, COALESCE(SUM(qty), 0) as total_items')
            ->whereIn('transaction_id', $transactionIds)
            ->when($tenantOutletId, fn ($query, $tenantId) => $query->where('tenant_outlet_id', $tenantId))
            ->groupBy('transaction_id')
            ->pluck('total_items', 'transaction_id');

        $profitByTransaction = Profit::query()
            ->selectRaw('transaction_id, COALESCE(SUM(total), 0) as total_profit')
            ->whereIn('transaction_id', $transactionIds)
            ->groupBy('transaction_id')
            ->pluck('total_profit', 'transaction_id');

        return $transactionRows
            ->groupBy(fn ($row) => ReportTimezone::sourceDateKey(
                method_exists($row, 'getRawOriginal') ? $row->getRawOriginal('created_at') : $row->created_at
            ))
            ->map(function (Collection $rows, $date) use ($itemsByTransaction, $profitByTransaction) {
                return [
                    'date' => $date,
                    'revenue_total' => (int) $rows->sum(fn ($row) => (int) data_get($row, 'net_grand_total', $row->grand_total ?? 0)),
                    'profit_total' => (int) $rows->sum(fn ($row) => (int) ($profitByTransaction->get($row->id) ?? 0)),
                    'items_sold' => (int) $rows->sum(fn ($row) => (int) ($itemsByTransaction->get($row->id) ?? 0)),
                ];
            })
            ->sortKeys()
            ->values()
            ->all();
    }

    protected function buildTenantTargetBreakdownRows(Collection $allocations): array
    {
        if ($allocations->isEmpty()) {
            return [];
        }

        return $allocations
            ->groupBy(fn ($allocation) => ReportTimezone::sourceDateKey(
                $allocation->transaction?->getRawOriginal('created_at') ?? $allocation->transaction?->created_at
            ))
            ->map(function (Collection $rows, $date) {
                return [
                    'date' => $date,
                    'revenue_total' => (int) $rows->sum('grand_total'),
                    'profit_total' => (int) $rows->sum('profit_total'),
                    'items_sold' => (int) $rows->sum('total_items'),
                ];
            })
            ->sortKeys()
            ->values()
            ->all();
    }

    protected function resolvePeriodLabel(array $filters): string
    {
        if (! empty($filters['start_date']) && ! empty($filters['end_date'])) {
            return Carbon::parse($filters['start_date'], ReportTimezone::timezone())->format('d M Y').' - '.Carbon::parse($filters['end_date'], ReportTimezone::timezone())->format('d M Y').' ('.ReportTimezone::timezoneLabel().')';
        }

        if (! empty($filters['start_date'])) {
            return 'Sejak '.Carbon::parse($filters['start_date'], ReportTimezone::timezone())->format('d M Y').' ('.ReportTimezone::timezoneLabel().')';
        }

        if (! empty($filters['end_date'])) {
            return 'Sampai '.Carbon::parse($filters['end_date'], ReportTimezone::timezone())->format('d M Y').' ('.ReportTimezone::timezoneLabel().')';
        }

        return 'Periode berjalan ('.ReportTimezone::timezoneLabel().')';
    }

    protected function applyAllocationFilters($query, array $filters)
    {
        $query = $query
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
            });

        if (! empty($filters['start_date']) || ! empty($filters['end_date'])) {
            $query->whereHas('transaction', fn ($transactionQuery) => ReportTimezone::applySourceDateRange($transactionQuery, 'created_at', $filters));
        }

        return $query;
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
        $activeMetricAllocations = $this->excludeReturnedAllocations($metricAllocations);
        $allocations = $this->appendAllocationMetrics(
            (clone $baseQuery)->orderByDesc('created_at')->paginate(20)->withQueryString()
        );

        $summary = [
            'allocation_count' => $activeMetricAllocations->count(),
            'revenue_total' => (int) $activeMetricAllocations->sum('grand_total'),
            'settled_total' => (int) $activeMetricAllocations->filter(fn ($allocation) => filled($allocation->settled_at))->sum('grand_total'),
            'cost_total' => (int) $activeMetricAllocations->sum('cost_total'),
            'profit_total' => (int) $activeMetricAllocations->sum('profit_total'),
            'management_fee_total' => (int) round($activeMetricAllocations->sum('management_fee_total')),
            'tenant_payout_total' => (int) round($activeMetricAllocations->sum('tenant_payout_total')),
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
            'settled_at' => Carbon::now(ReportTimezone::sourceTimezone()),
            'validated_by' => $request->user()?->id,
            'validated_at' => Carbon::now(ReportTimezone::sourceTimezone()),
            'payout_reference' => $validated['payout_reference'] ?? null,
            'payout_notes' => $validated['payout_notes'] ?? null,
            'payout_paid_at' => isset($validated['payout_paid_at'])
                ? Carbon::parse($validated['payout_paid_at'], ReportTimezone::timezone())->setTimezone(ReportTimezone::sourceTimezone())
                : Carbon::now(ReportTimezone::sourceTimezone()),
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
        $activeAllocations = $this->excludeReturnedAllocations($allocations);

        $summary = [
            'allocation_count' => $activeAllocations->count(),
            'tenant_count' => $activeAllocations->pluck('tenant_outlet_id')->filter()->unique()->count(),
            'revenue_total' => (int) $activeAllocations->sum('grand_total'),
            'cost_total' => (int) $activeAllocations->sum('cost_total'),
            'profit_total' => (int) $activeAllocations->sum('profit_total'),
            'tenant_discount_total' => (int) $activeAllocations->sum('tenant_discount_total'),
            'owner_discount_total' => (int) $activeAllocations->sum('owner_discount_total'),
            'management_fee_total' => (int) round($activeAllocations->sum('management_fee_total')),
            'tenant_payout_total' => (int) round($activeAllocations->sum('tenant_payout_total')),
            'settled_total' => (int) $activeAllocations->filter(fn ($allocation) => filled($allocation->settled_at))->sum('tenant_payout_total'),
            'outstanding_total' => (int) $activeAllocations->filter(fn ($allocation) => blank($allocation->settled_at))->sum('tenant_payout_total'),
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
                $createdAt = $allocation->transaction?->created_at;

                return $createdAt
                    ? ReportTimezone::sourceDateKey($allocation->transaction?->getRawOriginal('created_at'))
                    : 'tanpa-tanggal';
            })
            ->map(function ($rows, $date) {
                $activeRows = $this->excludeReturnedAllocations($rows);
                $returnedRows = $rows->filter(fn ($allocation) => $this->isReturnedAllocation($allocation));
                $settledRows = $activeRows->filter(fn ($allocation) => filled($allocation->settled_at));
                $outstandingRows = $activeRows->filter(fn ($allocation) => blank($allocation->settled_at));

                return [
                    'date' => $date,
                    'label' => $date !== 'tanpa-tanggal'
                        ? Carbon::parse($date, ReportTimezone::timezone())->translatedFormat('d M Y')
                        : 'Tanpa tanggal',
                    'allocations_count' => $activeRows->count(),
                    'returned_count' => $returnedRows->count(),
                    'tenant_count' => $activeRows->pluck('tenant_outlet_id')->filter()->unique()->count(),
                    'revenue_total' => (int) $activeRows->sum('grand_total'),
                    'profit_total' => (int) $activeRows->sum('profit_total'),
                    'management_fee_total' => (int) round($activeRows->sum('management_fee_total')),
                    'tenant_payout_total' => (int) round($activeRows->sum('tenant_payout_total')),
                    'settled_payout_total' => (int) round($settledRows->sum('tenant_payout_total')),
                    'outstanding_payout_total' => (int) round($outstandingRows->sum('tenant_payout_total')),
                ];
            })
            ->sortByDesc('date')
            ->values();
    }

    protected function excludeReturnedAllocations(Collection $allocations): Collection
    {
        return $allocations
            ->filter(fn ($allocation) => ! $this->isReturnedAllocation($allocation))
            ->values();
    }

    protected function isReturnedAllocation(mixed $allocation): bool
    {
        return (string) data_get($allocation, 'payment_status', '') === 'returned'
            || (
                (int) data_get($allocation, 'grand_total', 0) <= 0
                && (int) data_get($allocation, 'total_items', 0) <= 0
            );
    }

    protected function formatAllocationReportRows($allocations)
    {
        if ($allocations instanceof \Illuminate\Contracts\Pagination\LengthAwarePaginator) {
            $allocations->setCollection($this->formatAllocationReportRows($allocations->getCollection()));

            return $allocations;
        }

        return collect($allocations)->map(function ($allocation) {
            $row = $allocation->toArray();
            $row['is_returned'] = $this->isReturnedAllocation($allocation);

            if (isset($row['transaction']['created_at'])) {
                $row['transaction']['created_at'] = $allocation->transaction?->created_at
                    ? ReportTimezone::formatSourceDateTime($allocation->transaction->getRawOriginal('created_at'), 'd M Y H:i')
                    : null;
            }

            if (array_key_exists('settled_at', $row)) {
                $row['settled_at'] = $allocation->settled_at
                    ? ReportTimezone::formatSourceDateTime($allocation->getRawOriginal('settled_at'), 'd M Y H:i')
                    : null;
            }

            if (array_key_exists('validated_at', $row)) {
                $row['validated_at'] = $allocation->validated_at
                    ? ReportTimezone::formatSourceDateTime($allocation->getRawOriginal('validated_at'), 'd M Y H:i')
                    : null;
            }

            if (array_key_exists('payout_paid_at', $row)) {
                $row['payout_paid_at'] = $allocation->payout_paid_at
                    ? ReportTimezone::formatSourceDateTime($allocation->getRawOriginal('payout_paid_at'), 'd M Y H:i')
                    : null;
            }

            return $row;
        })->values();
    }

    protected function resolveActiveTab(Request $request): string
    {
        $allowedTabs = ['overview', 'analytics', 'transactions', 'settlement'];
        $activeTab = (string) $request->query('tab', 'overview');

        return in_array($activeTab, $allowedTabs, true) ? $activeTab : 'overview';
    }

    protected function buildSettlementRequestPaginator(array $filters, bool $tenantWorkspace)
    {
        $rangeFilters = ['start_date' => null, 'end_date' => $filters['end_date'] ?? null];
        $tenantOutletIds = $this->resolveSettlementTenantOutletIds($filters);
        $query = CashierSettlementRequest::query()
            ->with(['cashier:id,name', 'approvedBy:id,name', 'rejectedBy:id,name'])
            ->whereNull('cashier_shift_id')
            ->whereIn('outlet_id', $tenantOutletIds->all())
            ->when(($filters['settlement_status'] ?? '') === 'outstanding', fn ($builder) => $builder->where('status', CashierSettlementRequest::STATUS_PENDING))
            ->when(($filters['settlement_status'] ?? '') === 'settled', fn ($builder) => $builder->where('status', CashierSettlementRequest::STATUS_APPROVED))
            ->latest('created_at');

        $query = ReportTimezone::applySourceDateRange($query, 'created_at', $rangeFilters);

        return $query
            ->paginate(10, ['*'], 'settlement_requests_page')
            ->withQueryString()
            ->through(fn (CashierSettlementRequest $request) => $this->transformSettlementRequestRow($request));
    }

    protected function buildSettlementRequestSummary(array $filters, bool $tenantWorkspace): array
    {
        $balanceTotal = 0;
        $balanceFilters = [...$filters, 'start_date' => null];
        $tenantOutletIds = $this->resolveSettlementTenantOutletIds($filters);
        $balanceTransactionQuery = $this->applyFilters(
            Transaction::query()->select('transactions.id'),
            $balanceFilters
        );

        if ($this->hasTable('transaction_tenant_allocations')) {
            $allocationIds = TransactionTenantAllocation::query()
                ->whereIn('transaction_id', $balanceTransactionQuery->select('transactions.id'))
                ->when($filters['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
                ->whereIn('tenant_outlet_id', $tenantOutletIds->all())
                ->where('waiter_status', 'delivered')
                ->whereNotNull('delivered_at')
                ->pluck('id');

            $balanceTotal = TenantWalletMetrics::sumTenantNetValueForAllocationIds($allocationIds);
        }

        $query = CashierSettlementRequest::query()
            ->whereNull('cashier_shift_id')
            ->whereIn('outlet_id', $tenantOutletIds->all());

        $cumulativeFilters = ['start_date' => null, 'end_date' => $filters['end_date'] ?? null];
        $filteredQuery = ReportTimezone::applySourceDateRange(clone $query, 'created_at', $cumulativeFilters);
        $pendingTotal = (int) round((clone $filteredQuery)->where('status', CashierSettlementRequest::STATUS_PENDING)->sum('requested_amount'));
        $approvedTotal = (int) round(
            ReportTimezone::applySourceDateRange(
                (clone $query)->where('status', CashierSettlementRequest::STATUS_APPROVED),
                'paid_at',
                ['start_date' => null, 'end_date' => $filters['end_date'] ?? null]
            )->sum('approved_amount')
        );

        return [
            'pending_count' => (int) ((clone $filteredQuery)->where('status', CashierSettlementRequest::STATUS_PENDING)->count()),
            'approved_count' => (int) ((clone $filteredQuery)->where('status', CashierSettlementRequest::STATUS_APPROVED)->count()),
            'rejected_count' => (int) ((clone $filteredQuery)->where('status', CashierSettlementRequest::STATUS_REJECTED)->count()),
            'requested_total' => (int) round((clone $filteredQuery)->sum('requested_amount')),
            'approved_total' => $approvedTotal,
            'pending_total' => $pendingTotal,
            'balance_total' => $balanceTotal,
            'outstanding_total' => max(0, $balanceTotal - $approvedTotal),
        ];
    }

    protected function buildSettlementMutationReport(array $filters, bool $tenantWorkspace): array
    {
        $rows = $this->buildSettlementMutationRows($filters, $tenantWorkspace)
            ->sortByDesc('activity_ts')
            ->values();

        $groupedRows = $rows
            ->groupBy(fn ($row) => $row['date_key'])
            ->map(function (Collection $items, string $dateKey) {
                return [
                    'date_key' => $dateKey,
                    'date_label' => ReportTimezone::formatSourceDateLabel($dateKey, 'd M Y') ?? $dateKey,
                    'tenant_total' => (int) $items->sum('mutation_total'),
                    'owner_markup_total' => (int) $items->sum('owner_markup_total'),
                    'gross_total' => (int) $items->sum('gross_total'),
                    'discount_total' => (int) $items->sum('discount_total'),
                    'transactions_count' => (int) $items->where('entry_type', 'allocation')->count(),
                    'returns_count' => (int) $items->where('entry_type', 'return')->count(),
                    'entries_count' => (int) $items->count(),
                ];
            })
            ->sortByDesc('date_key')
            ->values();

        $daysCurrentPage = max(1, (int) request()->integer('mutations_page', 1));
        $daysPerPage = 7;
        $daysPageRows = $groupedRows->slice(($daysCurrentPage - 1) * $daysPerPage, $daysPerPage)->values();
        $daysPaginator = new LengthAwarePaginator(
            $daysPageRows,
            $groupedRows->count(),
            $daysPerPage,
            $daysCurrentPage,
            [
                'path' => request()->url(),
                'pageName' => 'mutations_page',
                'query' => request()->query(),
            ]
        );

        $selectedDay = (string) request()->query('mutation_day', '');
        $selectedDay = $groupedRows->firstWhere('date_key', $selectedDay)['date_key']
            ?? ($daysPageRows->first()['date_key'] ?? ($groupedRows->first()['date_key'] ?? ''));

        $selectedDayRows = $selectedDay !== ''
            ? $rows->filter(fn ($row) => $row['date_key'] === $selectedDay)->values()
            : collect();
        $selectedDaySummary = $groupedRows->firstWhere('date_key', $selectedDay) ?? null;

        $detailCurrentPage = max(1, (int) request()->integer('mutation_detail_page', 1));
        $detailPerPage = 10;
        $detailPageRows = $selectedDayRows->slice(($detailCurrentPage - 1) * $detailPerPage, $detailPerPage)->values();
        $detailPaginator = new LengthAwarePaginator(
            $detailPageRows,
            $selectedDayRows->count(),
            $detailPerPage,
            $detailCurrentPage,
            [
                'path' => request()->url(),
                'pageName' => 'mutation_detail_page',
                'query' => request()->query(),
            ]
        );

        return [
            'days' => $daysPaginator,
            'selected_day' => $selectedDay,
            'selected_day_label' => $selectedDay !== '' ? (ReportTimezone::formatSourceDateLabel($selectedDay, 'd M Y') ?? $selectedDay) : null,
            'selected_day_summary' => $selectedDaySummary,
            'details' => $detailPaginator,
        ];
    }

    protected function resolveSettlementView(Request $request): string
    {
        return $request->input('settlement_view') === 'mutations'
            ? 'mutations'
            : 'withdraw';
    }

    protected function buildSettlementMutationRows(array $filters, bool $tenantWorkspace): Collection
    {
        $rangeFilters = ['start_date' => null, 'end_date' => $filters['end_date'] ?? null];
        $tenantOutletIds = $this->resolveSettlementTenantOutletIds($filters);
        $mutationQuery = trim((string) ($filters['mutation_q'] ?? ''));

        $allocationQuery = TransactionTenantAllocation::query()
            ->with(['transaction.customer:id,name', 'transaction.cashier:id,name', 'tenantOutlet:id,name,code'])
            ->when($filters['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->whereIn('tenant_outlet_id', $tenantOutletIds->all())
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when($filters['cashier_id'] ?? null, fn ($query, $cashierId) => $query->where('cashier_id', $cashierId))
            ->when($filters['customer_id'] ?? null, function ($query, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $query->whereHas('transaction', fn ($trx) => $trx->whereNull('customer_id')),
                    default => $query->whereHas('transaction', fn ($trx) => $trx->where('customer_id', $customer)),
                };
            })
            ->when($mutationQuery !== '', function ($query) use ($mutationQuery) {
                $query->where(function ($nested) use ($mutationQuery) {
                    $nested
                        ->where('allocation_number', 'like', '%'.$mutationQuery.'%')
                        ->orWhereHas('transaction', function ($trx) use ($mutationQuery) {
                            $trx->where('invoice', 'like', '%'.$mutationQuery.'%')
                                ->orWhereHas('customer', fn ($customer) => $customer->where('name', 'like', '%'.$mutationQuery.'%'))
                                ->orWhereHas('cashier', fn ($cashier) => $cashier->where('name', 'like', '%'.$mutationQuery.'%'));
                        });
                });
            });

        $allocationQuery = ReportTimezone::applySourceDateRange($allocationQuery, 'delivered_at', $rangeFilters);
        $allocations = $allocationQuery->get();
        $tenantNetTotals = TenantWalletMetrics::tenantNetTotalsByAllocationIds($allocations->pluck('id'));
        $ownerMarkupTotals = TenantWalletMetrics::ownerMarkupTotalsByAllocationIds($allocations->pluck('id'));
        $allocationRows = $this->appendAllocationMetrics($allocations)
            ->map(function ($allocation) use ($tenantNetTotals, $ownerMarkupTotals) {
                return [
                    'id' => 'allocation-'.$allocation->id,
                    'entry_type' => 'allocation',
                    'invoice' => $allocation->transaction?->invoice ?? $allocation->allocation_number,
                    'reference' => $allocation->allocation_number,
                    'customer_name' => $allocation->transaction?->customer?->name ?? 'Pelanggan umum',
                    'cashier_name' => $allocation->transaction?->cashier?->name ?? '-',
                    'tenant_name' => $allocation->tenantOutlet?->name ?? '-',
                    'gross_total' => (int) ($allocation->grand_total ?? 0),
                    'mutation_total' => (int) ($tenantNetTotals->get($allocation->id, 0) ?? 0),
                    'owner_markup_total' => (int) ($ownerMarkupTotals->get($allocation->id, 0) ?? 0),
                    'profit_total' => (int) ($allocation->profit_total ?? 0),
                    'discount_total' => (int) ($allocation->tenant_discount_total ?? 0) + (int) ($allocation->owner_discount_total ?? 0),
                    'activity_at' => ReportTimezone::formatSourceDateTime($allocation->getRawOriginal('delivered_at'), 'd M Y H:i'),
                    'activity_ts' => strtotime((string) $allocation->getRawOriginal('delivered_at')),
                    'date_key' => ReportTimezone::sourceDateKey($allocation->getRawOriginal('delivered_at')),
                    'status' => 'Masuk saldo',
                ];
            });

        $returnQuery = SalesReturn::query()
            ->with(['transaction.customer:id,name', 'transaction.cashier:id,name'])
            ->where('status', 'completed')
            ->when($filters['outlet_id'] ?? null, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->when($filters['cashier_id'] ?? null, fn ($query, $cashierId) => $query->where('cashier_id', $cashierId))
            ->when($filters['customer_id'] ?? null, function ($query, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $query->whereHas('transaction', fn ($trx) => $trx->whereNull('customer_id')),
                    default => $query->whereHas('transaction', fn ($trx) => $trx->where('customer_id', $customer)),
                };
            })
            ->when($mutationQuery !== '', function ($query) use ($mutationQuery) {
                $query->where(function ($nested) use ($mutationQuery) {
                    $nested
                        ->where('code', 'like', '%'.$mutationQuery.'%')
                        ->orWhereHas('transaction', function ($trx) use ($mutationQuery) {
                            $trx->where('invoice', 'like', '%'.$mutationQuery.'%')
                                ->orWhereHas('customer', fn ($customer) => $customer->where('name', 'like', '%'.$mutationQuery.'%'))
                                ->orWhereHas('cashier', fn ($cashier) => $cashier->where('name', 'like', '%'.$mutationQuery.'%'));
                        });
                });
            })
            ->whereHas('items.transactionDetail', fn ($detail) => $detail->whereIn('tenant_outlet_id', $tenantOutletIds->all()));

        $returnQuery = ReportTimezone::applySourceDateRange($returnQuery, 'completed_at', $rangeFilters);
        $returnRows = $returnQuery->get()->map(function ($return) use ($tenantOutletIds) {
            $relevantItems = $return->items
                ->filter(fn ($item) => $tenantOutletIds->contains((int) ($item->transactionDetail?->tenant_outlet_id ?? 0)))
                ->values();

            $tenantMutationTotal = 0;
            $ownerMarkupTotal = 0;
            $grossTotal = 0;
            $discountTotal = 0;

            $relevantItems->each(function ($item) use (&$tenantMutationTotal, &$ownerMarkupTotal, &$grossTotal, &$discountTotal) {
                $detail = $item->transactionDetail;
                $qty = (int) ($item->qty_return ?? 0);
                $detailQty = max(1, (int) ($detail?->qty ?? 1));
                $customerUnitPrice = (int) ($detail?->customer_base_unit_price ?? $detail?->unit_price ?? 0);
                $tenantBaseUnitPrice = (int) ($detail?->tenant_base_unit_price ?? 0);
                $ownerMarkupUnitPrice = (int) ($detail?->owner_markup_unit_price ?? 0);
                $discountUnitValue = max(0, (int) round(((int) ($detail?->discount_total ?? 0)) / $detailQty));

                $lineTotal = $customerUnitPrice * $qty;
                $tenantNetTotal = (int) ($detail?->tenant_net_total ?? 0) > 0
                    ? (int) round(((int) $detail->tenant_net_total / $detailQty) * $qty)
                    : $tenantBaseUnitPrice * $qty;
                $ownerNetTotal = (int) ($detail?->owner_net_total ?? 0) > 0
                    ? (int) round(((int) $detail->owner_net_total / $detailQty) * $qty)
                    : $ownerMarkupUnitPrice * $qty;

                $grossTotal += $lineTotal;
                $tenantMutationTotal += $tenantNetTotal;
                $ownerMarkupTotal += $ownerNetTotal;
                $discountTotal += $discountUnitValue * $qty;
            });

            return [
                'id' => 'return-'.$return->id,
                'entry_type' => 'return',
                'invoice' => $return->transaction?->invoice ?? $return->code,
                'reference' => $return->code,
                'customer_name' => $return->transaction?->customer?->name ?? 'Pelanggan umum',
                'cashier_name' => $return->transaction?->cashier?->name ?? ($return->cashier?->name ?? '-'),
                'tenant_name' => '-',
                'gross_total' => -$grossTotal,
                'mutation_total' => -$tenantMutationTotal,
                'owner_markup_total' => -$ownerMarkupTotal,
                'profit_total' => 0,
                'discount_total' => -$discountTotal,
                'activity_at' => ReportTimezone::formatSourceDateTime($return->getRawOriginal('completed_at'), 'd M Y H:i'),
                'activity_ts' => strtotime((string) $return->getRawOriginal('completed_at')),
                'date_key' => ReportTimezone::sourceDateKey($return->getRawOriginal('completed_at')),
                'status' => 'Retur',
            ];
        })->filter(fn (array $row) => $row['mutation_total'] !== 0 || $row['owner_markup_total'] !== 0 || $row['gross_total'] !== 0);

        return $allocationRows
            ->merge($returnRows)
            ->values();
    }

    protected function transformSettlementRequestRow(CashierSettlementRequest $request): array
    {
        return [
            'id' => $request->id,
            'request_number' => $request->request_number,
            'business_date' => optional($request->business_date)?->toDateString(),
            'status' => $request->status,
            'gross_sales_total' => (int) $request->gross_sales_total,
            'base_sales_total' => (int) $request->base_sales_total,
            'markup_total' => (int) $request->markup_total,
            'requested_amount' => (int) $request->requested_amount,
            'approved_amount' => (int) $request->approved_amount,
            'recipient_name' => $request->recipient_name,
            'requested_notes' => $request->requested_notes,
            'approval_notes' => $request->approval_notes,
            'approval_reference' => $request->approval_reference,
            'created_at' => ReportTimezone::formatSourceDateTime($request->getRawOriginal('created_at'), 'd M Y H:i'),
            'paid_at' => ReportTimezone::formatSourceDateTime($request->getRawOriginal('paid_at'), 'd M Y H:i'),
            'cashier' => $request->cashier ? [
                'id' => $request->cashier->id,
                'name' => $request->cashier->name,
            ] : null,
            'approved_by' => $request->approvedBy ? [
                'id' => $request->approvedBy->id,
                'name' => $request->approvedBy->name,
            ] : null,
            'rejected_by' => $request->rejectedBy ? [
                'id' => $request->rejectedBy->id,
                'name' => $request->rejectedBy->name,
            ] : null,
        ];
    }

    protected function hasTable(string $table): bool
    {
        return Schema::hasTable($table);
    }

    protected function resolveSettlementTenantOutletIds(array $filters): Collection
    {
        if (! empty($filters['tenant_outlet_id'])) {
            return collect([(int) $filters['tenant_outlet_id']]);
        }

        if (! empty($filters['outlet_id'])) {
            return Outlet::query()
                ->active()
                ->where('outlet_type', 'tenant')
                ->where('parent_outlet_id', (int) $filters['outlet_id'])
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();
        }

        return collect();
    }

}
