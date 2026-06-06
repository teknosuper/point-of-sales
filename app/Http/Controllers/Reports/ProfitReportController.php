<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Outlet;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use App\Services\OutletResolver;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class ProfitReportController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

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
            'item_keyword' => $request->input('item_keyword'),
            'pricing_rule_kind' => $request->input('pricing_rule_kind'),
            'outlet_id' => $isTenantOutlet ? null : $outletId,
        ];
        $filters = $this->applyDefaultDatePreset($filters);

        if ($isTenantOutlet) {
            return $this->renderTenantProfitReport($filters, $outletId);
        }

        $baseQuery = $this->applyFilters(
            Transaction::query()
                ->with(['cashier:id,name', 'customer:id,name'])
                ->withSum('details as total_items', 'qty'),
            $filters
        )->orderByDesc('created_at');

        $detailColumns = $this->transactionDetailSelectColumns();
        $transactionRelations = [
            'details' => fn ($query) => $query
                ->select($detailColumns)
                ->with(['product:id,title']),
        ];

        if (Schema::hasTable('transaction_tenant_allocations')) {
            $transactionRelations[] = 'tenantAllocations:id,transaction_id,tenant_outlet_id,grand_total';
            $transactionRelations[] = 'tenantAllocations.tenantOutlet:id,name,code';
        }

        $transactions = (clone $baseQuery)
            ->with($transactionRelations)
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Transaction $transaction) => $this->transformTransactionRow($transaction, $outletId));

        $transactionIds = (clone $baseQuery)->pluck('id');
        $summary = $this->buildSummary($baseQuery, $transactionIds, $outletId);
        $targets = $this->targetSummary($summary, $outletId, $filters);
        $itemBreakdown = $this->itemBreakdownPaginator($filters);

        return Inertia::render('Dashboard/Reports/Profit', [
            'transactions' => $transactions,
            'itemBreakdown' => $itemBreakdown,
            'summary' => $summary,
            'targets' => $targets,
            'cashierSummary' => $this->cashierSummary($filters),
            'dailyProfitTrend' => $this->dailyProfitTrend($filters, $transactionIds, $outletId),
            'tenantBreakdown' => $this->tenantBreakdown($transactionIds),
            'ownerMarkupBreakdown' => $this->ownerMarkupBreakdown($transactionIds, $outletId, $activeOutlet?->name),
            'filters' => $filters,
            'cashiers' => User::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::select('id', 'name')->orderBy('name')->get(),
            'pricingRuleKinds' => [
                ['id' => 'standard_discount', 'name' => 'Standard Discount'],
                ['id' => 'qty_break', 'name' => 'Qty Break'],
                ['id' => 'bundle_price', 'name' => 'Bundle Price'],
                ['id' => 'buy_x_get_y', 'name' => 'Buy X Get Y'],
            ],
            'tenantOutlets' => Outlet::query()
                ->active()
                ->ordered()
                ->when($outletId, fn ($query) => $query->where('id', '!=', $outletId))
                ->get(['id', 'name', 'code'])
                ->values(),
            'workspace' => [
                'is_tenant_workspace' => $isTenantOutlet,
                'active_outlet' => $activeOutlet ? [
                    'id' => $activeOutlet->id,
                    'name' => $activeOutlet->name,
                    'code' => $activeOutlet->code,
                    'outlet_type' => $activeOutlet->outlet_type,
                ] : null,
            ],
        ]);
    }

    protected function renderTenantProfitReport(array $filters, int $tenantOutletId)
    {
        $baseQuery = TransactionTenantAllocation::query()
            ->with([
                'transaction.customer:id,name',
                'transaction.cashier:id,name',
                'items.product:id,title,tenant_hpp_price,buy_price',
                'tenantOutlet:id,name,code,commission_rate_percent',
            ])
            ->select('transaction_tenant_allocations.*')
            ->selectSub(
                TransactionTenantAllocationItem::query()
                    ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0)')
                    ->whereColumn('transaction_tenant_allocation_id', 'transaction_tenant_allocations.id'),
                'cost_total'
            )
            ->withSum('items as total_items', 'qty');

        $baseQuery = $this->applyTenantAllocationFilters($baseQuery, $filters)->orderByDesc('created_at');

        $metricAllocations = $this->appendTenantProfitMetrics((clone $baseQuery)->get());
        $transactions = $this->appendTenantProfitMetrics(
            (clone $baseQuery)->paginate(10)->withQueryString()
        )->through(fn (TransactionTenantAllocation $allocation) => $this->transformTenantProfitAllocationRow($allocation));

        $summary = [
            'profit_total' => (int) $metricAllocations->sum('profit_total'),
            'revenue_total' => (int) $metricAllocations->sum('grand_total'),
            'orders_count' => (int) $metricAllocations->count(),
            'items_sold' => (int) $metricAllocations->sum('total_items'),
            'walk_in_count' => (int) $metricAllocations->filter(fn ($allocation) => blank($allocation->transaction?->customer_id))->count(),
            'average_profit' => $metricAllocations->count() > 0
                ? (int) round($metricAllocations->sum('profit_total') / $metricAllocations->count())
                : 0,
            'margin' => $metricAllocations->sum('grand_total') > 0
                ? round(($metricAllocations->sum('profit_total') / $metricAllocations->sum('grand_total')) * 100, 2)
                : 0,
            'best_invoice' => $metricAllocations->sortByDesc('profit_total')->first()?->transaction?->invoice,
            'best_profit' => (int) ($metricAllocations->sortByDesc('profit_total')->first()?->profit_total ?? 0),
            'base_cost_total' => (int) $metricAllocations->sum('cost_total'),
            'markup_total' => (int) $metricAllocations->sum('profit_total'),
            'tenant_revenue_total' => (int) $metricAllocations->sum('grand_total'),
            'tenant_discount_total' => (int) $metricAllocations->sum('promo_discount_total')
                + (int) $metricAllocations->sum('voucher_discount_total')
                + (int) $metricAllocations->sum('loyalty_discount_total')
                + (int) $metricAllocations->sum('manual_discount_total'),
            'owner_discount_total' => 0,
            'owner_direct_revenue_total' => 0,
            'owner_direct_markup_total' => 0,
            'tenant_markup_total' => (int) $metricAllocations->sum('profit_total'),
            'tenant_profit_total' => (int) $metricAllocations->sum('profit_total'),
        ];
        $summary['registered_customer_count'] = max(0, $summary['orders_count'] - $summary['walk_in_count']);

        $targets = $this->targetSummary($summary, $tenantOutletId, $filters);
        $itemBreakdown = $this->itemBreakdownPaginator($filters, true);
        $tenantOutlet = $metricAllocations->first()?->tenantOutlet;

        return Inertia::render('Dashboard/Reports/Profit', [
            'transactions' => $transactions,
            'itemBreakdown' => $itemBreakdown,
            'summary' => $summary,
            'targets' => $targets,
            'cashierSummary' => $this->tenantCashierSummary($metricAllocations),
            'dailyProfitTrend' => $this->tenantDailyProfitTrend($metricAllocations),
            'tenantBreakdown' => $tenantOutlet ? collect([[
                'tenant_outlet_id' => $tenantOutlet->id,
                'tenant_outlet' => [
                    'id' => $tenantOutlet->id,
                    'name' => $tenantOutlet->name,
                    'code' => $tenantOutlet->code,
                ],
                'orders_count' => $summary['orders_count'],
                'items_sold' => $summary['items_sold'],
                'pre_promo_subtotal' => (int) $metricAllocations->sum('pre_promo_subtotal'),
                'subtotal_total' => (int) $metricAllocations->sum('subtotal'),
                'discount_total' => $summary['tenant_discount_total'],
                'after_promo_total' => $summary['revenue_total'],
                'cost_total' => $summary['base_cost_total'],
                'profit_total' => $summary['profit_total'],
                'margin' => $summary['margin'],
            ]]) : collect(),
            'ownerMarkupBreakdown' => collect(),
            'filters' => $filters,
            'cashiers' => User::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::select('id', 'name')->orderBy('name')->get(),
            'pricingRuleKinds' => [
                ['id' => 'standard_discount', 'name' => 'Standard Discount'],
                ['id' => 'qty_break', 'name' => 'Qty Break'],
                ['id' => 'bundle_price', 'name' => 'Bundle Price'],
                ['id' => 'buy_x_get_y', 'name' => 'Buy X Get Y'],
            ],
            'tenantOutlets' => Outlet::query()
                ->active()
                ->ordered()
                ->where('id', $tenantOutletId)
                ->get(['id', 'name', 'code'])
                ->values(),
            'workspace' => [
                'is_tenant_workspace' => true,
                'active_outlet' => [
                    'id' => $tenantOutletId,
                    'name' => $tenantOutlet?->name,
                    'code' => $tenantOutlet?->code,
                    'outlet_type' => $tenantOutlet?->outlet_type,
                ],
            ],
        ]);
    }

    public function filterOptions(Request $request)
    {
        $type = (string) $request->input('type', '');
        $search = trim((string) $request->input('q', ''));
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());

        $items = match ($type) {
            'cashier' => User::query()
                ->when($search !== '', fn ($query) => $query->where('name', 'like', '%'.$search.'%'))
                ->orderBy('name')
                ->limit(20)
                ->get(['id', 'name'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                ]),
            'customer' => Customer::query()
                ->when($search !== '', function ($query) use ($search) {
                    $query->where(function ($nested) use ($search) {
                        $nested->where('name', 'like', '%'.$search.'%')
                            ->orWhere('no_telp', 'like', '%'.$search.'%')
                            ->orWhere('member_code', 'like', '%'.$search.'%');
                    });
                })
                ->orderBy('name')
                ->limit(20)
                ->get(['id', 'name', 'no_telp'])
                ->map(fn (Customer $customer) => [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'subtitle' => $customer->no_telp,
                ]),
            'tenant' => Outlet::query()
                ->active()
                ->ordered()
                ->when($activeOutlet?->id, fn ($query) => $query->where('id', '!=', $activeOutlet->id))
                ->when($search !== '', function ($query) use ($search) {
                    $query->where(function ($nested) use ($search) {
                        $nested->where('name', 'like', '%'.$search.'%')
                            ->orWhere('code', 'like', '%'.$search.'%');
                    });
                })
                ->limit(20)
                ->get(['id', 'name', 'code'])
                ->map(fn (Outlet $outlet) => [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                    'subtitle' => $outlet->code,
                ]),
            default => collect(),
        };

        return response()->json([
            'data' => $items->values(),
        ]);
    }

    public function exportItems(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $isTenantOutlet = (string) ($activeOutlet?->outlet_type ?? '') === 'tenant';
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'invoice' => $request->input('invoice'),
            'cashier_id' => $request->input('cashier_id'),
            'customer_id' => $request->input('customer_id'),
            'tenant_outlet_id' => $isTenantOutlet ? $activeOutlet?->id : $request->input('tenant_outlet_id'),
            'item_keyword' => $request->input('item_keyword'),
            'pricing_rule_kind' => $request->input('pricing_rule_kind'),
            'outlet_id' => $isTenantOutlet ? null : $activeOutlet?->id,
        ];

        $rows = $this->itemBreakdownQuery($filters, $isTenantOutlet)
            ->orderByDesc('gross_profit_total')
            ->get();

        $filename = 'profit-items-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'product_name',
                'tenant_outlet_name',
                'orders_count',
                'qty_sold',
                'revenue_total',
                'base_cost_total',
                'gross_profit_total',
                'tenant_discount_total',
                'owner_discount_total',
                'tenant_net_total',
                'owner_net_total',
                'promo_lines_count',
            ]);

            foreach ($rows as $row) {
                fputcsv($handle, [
                    (string) ($row->product_name ?? 'Produk'),
                    (string) ($row->tenant_outlet_name ?? ''),
                    (int) ($row->orders_count ?? 0),
                    (int) ($row->qty_sold ?? 0),
                    (int) ($row->revenue_total ?? 0),
                    (int) ($row->base_cost_total ?? 0),
                    (int) ($row->gross_profit_total ?? 0),
                    (int) ($row->tenant_discount_total ?? 0),
                    (int) ($row->owner_discount_total ?? 0),
                    (int) ($row->tenant_net_total ?? 0),
                    (int) ($row->owner_net_total ?? 0),
                    (int) ($row->promo_lines_count ?? 0),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    protected function buildSummary(Builder $baseQuery, Collection $transactionIds, ?int $outletId): array
    {
        $revenueTotal = (clone $baseQuery)->sum('grand_total');
        $ordersCount = (clone $baseQuery)->count();
        $itemsSold = $transactionIds->isNotEmpty()
            ? TransactionDetail::whereIn('transaction_id', $transactionIds)->sum('qty')
            : 0;

        $baseCostTotal = $this->sumTransactionDetailBaseCost($transactionIds);
        $markupTotal = max(0, (int) $revenueTotal - (int) $baseCostTotal);

        $tenantSummary = $this->tenantBreakdown($transactionIds);
        $tenantRevenueTotal = (int) $tenantSummary->sum('after_promo_total');
        $tenantProfitTotal = (int) $tenantSummary->sum('profit_total');
        $tenantDiscountTotal = (int) $tenantSummary->sum('discount_total');
        $detailDiscountSplit = $this->transactionDiscountSplit($transactionIds);

        $ownerMarkupSummary = $this->ownerMarkupBreakdown($transactionIds, $outletId, null);
        $ownerDirectRow = $ownerMarkupSummary->firstWhere('kind', 'owner_direct');
        $tenantMarkupRow = $ownerMarkupSummary->firstWhere('kind', 'tenant_markup');
        $bestTransaction = $this->bestGrossProfitTransaction($baseQuery, $outletId);

        $summary = [
            'profit_total' => (int) $markupTotal,
            'revenue_total' => (int) $revenueTotal,
            'orders_count' => (int) $ordersCount,
            'items_sold' => (int) $itemsSold,
            'walk_in_count' => (int) ((clone $baseQuery)->whereNull('customer_id')->count()),
            'average_profit' => $ordersCount > 0 ? (int) round($markupTotal / $ordersCount) : 0,
            'margin' => $revenueTotal > 0 ? round(($markupTotal / $revenueTotal) * 100, 2) : 0,
            'best_invoice' => $bestTransaction?->invoice,
            'best_profit' => (int) ($bestTransaction?->total_profit ?? 0),
            'base_cost_total' => (int) $baseCostTotal,
            'markup_total' => (int) $markupTotal,
            'tenant_revenue_total' => $tenantRevenueTotal,
            'tenant_profit_total' => $tenantProfitTotal,
            'tenant_discount_total' => $tenantDiscountTotal,
            'owner_discount_total' => (int) ($detailDiscountSplit['owner_discount_total'] ?? 0),
            'owner_direct_revenue_total' => (int) ($ownerDirectRow['revenue_total'] ?? 0),
            'owner_direct_markup_total' => (int) ($ownerDirectRow['markup_total'] ?? 0),
            'tenant_markup_total' => (int) ($tenantMarkupRow['markup_total'] ?? 0),
        ];

        $summary['registered_customer_count'] = max(0, $summary['orders_count'] - $summary['walk_in_count']);

        return $summary;
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

    protected function cashierSummary(array $filters): array
    {
        $transactions = $this->applyFilters(
            Transaction::query()->with('cashier:id,name'),
            $filters
        )->get(['id', 'cashier_id', 'customer_id', 'grand_total']);

        if ($transactions->isEmpty()) {
            return [];
        }

        $baseCostByCashier = $this->baseCostByCashier($transactions->pluck('id'));

        return $transactions
            ->groupBy('cashier_id')
            ->map(function (Collection $cashierTransactions, $cashierId) use ($baseCostByCashier) {
                $ordersCount = $cashierTransactions->count();
                $walkInCount = $cashierTransactions->whereNull('customer_id')->count();
                $revenueTotal = (int) $cashierTransactions->sum('grand_total');
                $baseCostTotal = (int) ($baseCostByCashier[$cashierId] ?? 0);
                $profitTotal = max(0, $revenueTotal - $baseCostTotal);
                $cashierName = $cashierTransactions->first()?->cashier?->name;

                return [
                    'cashier_id' => (int) $cashierId,
                    'cashier_name' => $cashierName,
                    'orders_count' => $ordersCount,
                    'walk_in_count' => $walkInCount,
                    'registered_customer_count' => max(0, $ordersCount - $walkInCount),
                    'revenue_total' => $revenueTotal,
                    'profit_total' => $profitTotal,
                    'walk_in_share' => $ordersCount > 0
                        ? round(($walkInCount / $ordersCount) * 100, 2)
                        : 0,
                    'average_profit' => $ordersCount > 0
                        ? (int) round($profitTotal / $ordersCount)
                        : 0,
                ];
            })
            ->sortByDesc('profit_total')
            ->values()
            ->all();
    }

    protected function dailyProfitTrend(array $filters, Collection $transactionIds, ?int $outletId): Collection
    {
        $dailyTransactions = $this->applyFilters(Transaction::query(), $filters)
            ->selectRaw('DATE(created_at) as day')
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(grand_total), 0) as revenue_total')
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $dailyDetails = $this->aggregateDetailsByDay($transactionIds, $outletId)->keyBy('day');
        $dailyTenant = $this->aggregateTenantAllocationsByDay($transactionIds)->keyBy('day');

        return collect($dailyTransactions->keys())
            ->merge($dailyDetails->keys())
            ->merge($dailyTenant->keys())
            ->unique()
            ->sort()
            ->values()
            ->map(function ($day) use ($dailyTransactions, $dailyDetails, $dailyTenant) {
                $tx = $dailyTransactions->get($day);
                $detail = $dailyDetails->get($day);
                $tenant = $dailyTenant->get($day);
                $revenueTotal = (int) round($tx->revenue_total ?? 0);
                $baseCostTotal = (int) round($detail->base_cost_total ?? 0);

                return [
                    'day' => $day,
                    'label' => Carbon::parse($day)->format('d M Y'),
                    'orders_count' => (int) ($tx->orders_count ?? 0),
                    'revenue_total' => $revenueTotal,
                    'profit_total' => max(0, $revenueTotal - $baseCostTotal),
                    'base_cost_total' => $baseCostTotal,
                    'markup_total' => max(0, $revenueTotal - $baseCostTotal),
                    'discount_total' => (int) round($detail->discount_total ?? 0),
                    'owner_direct_revenue_total' => (int) round($detail->owner_direct_revenue_total ?? 0),
                    'owner_direct_markup_total' => max(0, (int) round(($detail->owner_direct_revenue_total ?? 0) - ($detail->owner_direct_base_total ?? 0))),
                    'tenant_after_promo_total' => (int) round($tenant->after_promo_total ?? 0),
                    'tenant_discount_total' => (int) round($tenant->discount_total ?? 0),
                ];
            })
            ->values();
    }

    protected function tenantBreakdown(Collection $transactionIds): Collection
    {
        if (
            $transactionIds->isEmpty()
            || ! Schema::hasTable('transaction_tenant_allocations')
            || ! Schema::hasTable('transaction_tenant_allocation_items')
        ) {
            return collect();
        }

        $allocationTotals = TransactionTenantAllocation::query()
            ->with('tenantOutlet:id,name,code')
            ->whereIn('transaction_id', $transactionIds)
            ->selectRaw('tenant_outlet_id')
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(subtotal), 0) as subtotal_total')
            ->selectRaw('COALESCE(SUM(promo_discount_total + manual_discount_total + loyalty_discount_total + voucher_discount_total), 0) as discount_total')
            ->selectRaw('COALESCE(SUM(grand_total), 0) as after_promo_total')
            ->groupBy('tenant_outlet_id')
            ->get()
            ->keyBy('tenant_outlet_id');

        $allocationCostTotals = TransactionTenantAllocationItem::query()
            ->join('transaction_tenant_allocations', 'transaction_tenant_allocations.id', '=', 'transaction_tenant_allocation_items.transaction_tenant_allocation_id')
            ->whereIn('transaction_tenant_allocations.transaction_id', $transactionIds)
            ->selectRaw('transaction_tenant_allocation_items.tenant_outlet_id')
            ->selectRaw('COALESCE(SUM(transaction_tenant_allocation_items.base_unit_price * transaction_tenant_allocation_items.qty), 0) as cost_total')
            ->selectRaw('COALESCE(SUM(transaction_tenant_allocation_items.qty), 0) as items_sold')
            ->groupBy('transaction_tenant_allocation_items.tenant_outlet_id')
            ->get()
            ->keyBy('tenant_outlet_id');

        return $allocationTotals
            ->map(function ($row, $tenantOutletId) use ($allocationCostTotals) {
                $costRow = $allocationCostTotals->get($tenantOutletId);
                $afterPromoTotal = (int) round($row->after_promo_total ?? 0);
                $costTotal = (int) round($costRow->cost_total ?? 0);

                return [
                    'tenant_outlet_id' => (int) $tenantOutletId,
                    'tenant_outlet' => $row->tenantOutlet ? [
                        'id' => $row->tenantOutlet->id,
                        'name' => $row->tenantOutlet->name,
                        'code' => $row->tenantOutlet->code,
                    ] : null,
                    'orders_count' => (int) ($row->orders_count ?? 0),
                    'items_sold' => (int) ($costRow->items_sold ?? 0),
                    'pre_promo_subtotal' => (int) round(($row->subtotal_total ?? 0) + ($row->discount_total ?? 0)),
                    'subtotal_total' => (int) round($row->subtotal_total ?? 0),
                    'discount_total' => (int) round($row->discount_total ?? 0),
                    'after_promo_total' => $afterPromoTotal,
                    'cost_total' => $costTotal,
                    'profit_total' => $afterPromoTotal - $costTotal,
                    'margin' => $afterPromoTotal > 0
                        ? round((($afterPromoTotal - $costTotal) / $afterPromoTotal) * 100, 2)
                        : 0,
                ];
            })
            ->sortByDesc('profit_total')
            ->values();
    }

    protected function ownerMarkupBreakdown(Collection $transactionIds, ?int $outletId, ?string $ownerOutletName): Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        $hasBaseUnitPrice = Schema::hasColumn('transaction_details', 'base_unit_price');
        $hasTenantOutletId = Schema::hasColumn('transaction_details', 'tenant_outlet_id');
        $baseExpression = $hasBaseUnitPrice
            ? 'COALESCE(transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)'
            : 'COALESCE(transaction_details.price, 0)';

        $rows = TransactionDetail::query()
            ->when(
                $hasTenantOutletId,
                fn ($query) => $query->leftJoin('outlets as tenant_outlets', 'tenant_outlets.id', '=', 'transaction_details.tenant_outlet_id')
            )
            ->whereIn('transaction_id', $transactionIds)
            ->selectRaw($hasTenantOutletId ? 'transaction_details.tenant_outlet_id' : 'NULL as tenant_outlet_id')
            ->selectRaw('COUNT(*) as rows_count')
            ->selectRaw('COALESCE(SUM(transaction_details.qty), 0) as items_sold')
            ->selectRaw('COALESCE(SUM(transaction_details.price), 0) as revenue_total')
            ->selectRaw("COALESCE(SUM({$baseExpression}), 0) as base_cost_total")
            ->selectRaw($hasTenantOutletId ? 'MAX(tenant_outlets.name) as tenant_name' : 'NULL as tenant_name')
            ->selectRaw($hasTenantOutletId ? 'MAX(tenant_outlets.code) as tenant_code' : 'NULL as tenant_code')
            ->groupBy(DB::raw($hasTenantOutletId ? 'transaction_details.tenant_outlet_id' : 'NULL'))
            ->get();

        return $rows
            ->map(function ($row) use ($outletId, $ownerOutletName) {
                $tenantOutletId = $row->tenant_outlet_id ? (int) $row->tenant_outlet_id : null;
                $isOwnerDirect = ! $tenantOutletId || $tenantOutletId === (int) $outletId;
                $revenueTotal = (int) round($row->revenue_total ?? 0);
                $baseCostTotal = (int) round($row->base_cost_total ?? 0);

                return [
                    'tenant_outlet_id' => $tenantOutletId,
                    'kind' => $isOwnerDirect ? 'owner_direct' : 'tenant_markup',
                    'label' => $isOwnerDirect
                        ? ($ownerOutletName ?: 'Outlet Owner')
                        : ($row->tenant_name ?: $row->tenant_code ?: "Tenant {$tenantOutletId}"),
                    'rows_count' => (int) ($row->rows_count ?? 0),
                    'items_sold' => (int) ($row->items_sold ?? 0),
                    'revenue_total' => $revenueTotal,
                    'base_cost_total' => $baseCostTotal,
                    'markup_total' => $revenueTotal - $baseCostTotal,
                    'margin' => $revenueTotal > 0
                        ? round((($revenueTotal - $baseCostTotal) / $revenueTotal) * 100, 2)
                        : 0,
                ];
            })
            ->sortByDesc('markup_total')
            ->values();
    }

    protected function aggregateDetailsByDay(Collection $transactionIds, ?int $outletId): Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        $hasBaseUnitPrice = Schema::hasColumn('transaction_details', 'base_unit_price');
        $hasDiscountTotal = Schema::hasColumn('transaction_details', 'discount_total');
        $hasTenantOutletId = Schema::hasColumn('transaction_details', 'tenant_outlet_id');
        $baseExpression = $hasBaseUnitPrice
            ? 'COALESCE(transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)'
            : 'COALESCE(transaction_details.price, 0)';
        $discountExpression = $hasDiscountTotal
            ? 'COALESCE(transaction_details.discount_total, 0)'
            : '0';

        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->whereIn('transaction_details.transaction_id', $transactionIds)
            ->selectRaw('DATE(transactions.created_at) as day')
            ->selectRaw('COALESCE(SUM(transaction_details.price), 0) as revenue_total')
            ->selectRaw("COALESCE(SUM({$baseExpression}), 0) as base_cost_total")
            ->selectRaw("COALESCE(SUM({$discountExpression}), 0) as discount_total")
            ->selectRaw($hasTenantOutletId ? "
                COALESCE(SUM(
                    CASE
                        WHEN transaction_details.tenant_outlet_id IS NULL
                             OR transaction_details.tenant_outlet_id = ".(int) $outletId.'
                        THEN transaction_details.price
                        ELSE 0
                    END
                ), 0) as owner_direct_revenue_total
            ' : 'COALESCE(SUM(transaction_details.price), 0) as owner_direct_revenue_total')
            ->selectRaw($hasTenantOutletId ? "
                COALESCE(SUM(
                    CASE
                        WHEN transaction_details.tenant_outlet_id IS NULL
                             OR transaction_details.tenant_outlet_id = ".(int) $outletId."
                        THEN {$baseExpression}
                        ELSE 0
                    END
                ), 0) as owner_direct_base_total
            " : "COALESCE(SUM({$baseExpression}), 0) as owner_direct_base_total")
            ->groupBy('day')
            ->orderBy('day')
            ->get();
    }

    protected function aggregateTenantAllocationsByDay(Collection $transactionIds): Collection
    {
        if ($transactionIds->isEmpty() || ! Schema::hasTable('transaction_tenant_allocations')) {
            return collect();
        }

        return TransactionTenantAllocation::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_tenant_allocations.transaction_id')
            ->whereIn('transaction_tenant_allocations.transaction_id', $transactionIds)
            ->selectRaw('DATE(transactions.created_at) as day')
            ->selectRaw('COALESCE(SUM(transaction_tenant_allocations.grand_total), 0) as after_promo_total')
            ->selectRaw('COALESCE(SUM(transaction_tenant_allocations.promo_discount_total + transaction_tenant_allocations.manual_discount_total + transaction_tenant_allocations.loyalty_discount_total + transaction_tenant_allocations.voucher_discount_total), 0) as discount_total')
            ->groupBy('day')
            ->orderBy('day')
            ->get();
    }

    protected function sumTransactionDetailBaseCost(Collection $transactionIds): int
    {
        if ($transactionIds->isEmpty()) {
            return 0;
        }

        if (! Schema::hasColumn('transaction_details', 'base_unit_price')) {
            return (int) TransactionDetail::whereIn('transaction_id', $transactionIds)->sum('price');
        }

        return (int) TransactionDetail::query()
            ->whereIn('transaction_id', $transactionIds)
            ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0) as aggregate')
            ->value('aggregate');
    }

    protected function transformTransactionRow(Transaction $transaction, ?int $outletId): array
    {
        $hasTenantOutletId = Schema::hasColumn('transaction_details', 'tenant_outlet_id');
        $hasTenantAllocationTable = Schema::hasTable('transaction_tenant_allocations');
        $baseCostTotal = (int) $transaction->details->sum(function (TransactionDetail $detail) {
            $baseUnitPrice = isset($detail->base_unit_price) ? (int) $detail->base_unit_price : 0;

            return $baseUnitPrice > 0
                ? $baseUnitPrice * (int) $detail->qty
                : (int) $detail->price;
        });

        $tenantRevenueTotal = $hasTenantAllocationTable
            ? (int) $transaction->tenantAllocations->sum('grand_total')
            : 0;
        $ownerDirectRevenueTotal = (int) $transaction->details
            ->filter(fn (TransactionDetail $detail) => ! $hasTenantOutletId || ! $detail->tenant_outlet_id || (int) $detail->tenant_outlet_id === (int) $outletId)
            ->sum('price');
        $ownerDirectBaseTotal = (int) $transaction->details
            ->filter(fn (TransactionDetail $detail) => ! $hasTenantOutletId || ! $detail->tenant_outlet_id || (int) $detail->tenant_outlet_id === (int) $outletId)
            ->sum(fn (TransactionDetail $detail) => ((int) ($detail->base_unit_price ?? 0)) > 0
                ? (int) $detail->base_unit_price * (int) $detail->qty
                : (int) $detail->price);
        $prePromoSubtotal = (int) $transaction->details->sum(fn (TransactionDetail $detail) => (int) ($detail->customer_base_unit_price ?? $detail->unit_price ?? 0) * (int) $detail->qty);
        $tenantNetTotal = (int) $transaction->details->sum(fn (TransactionDetail $detail) => (int) ($detail->tenant_net_total ?? 0));
        $ownerNetTotal = (int) $transaction->details->sum(fn (TransactionDetail $detail) => (int) ($detail->owner_net_total ?? 0));

        return [
            ...$transaction->toArray(),
            'total_profit' => max(0, (int) $transaction->grand_total - $baseCostTotal),
            'base_cost_total' => $baseCostTotal,
            'markup_total' => (int) $transaction->grand_total - $baseCostTotal,
            'pre_promo_subtotal' => $prePromoSubtotal,
            'tenant_revenue_total' => $tenantRevenueTotal,
            'tenant_discount_total' => (int) $transaction->details->sum(fn (TransactionDetail $detail) => (int) ($detail->tenant_discount_total ?? 0)),
            'owner_discount_total' => (int) $transaction->details->sum(fn (TransactionDetail $detail) => (int) ($detail->owner_discount_total ?? 0)),
            'tenant_net_total' => $tenantNetTotal,
            'owner_net_total' => $ownerNetTotal,
            'owner_direct_revenue_total' => $ownerDirectRevenueTotal,
            'owner_direct_markup_total' => $ownerDirectRevenueTotal - $ownerDirectBaseTotal,
            'detail_items' => $transaction->details
                ->map(fn (TransactionDetail $detail) => [
                    'id' => $detail->id,
                    'product_name' => $detail->product?->title ?? 'Produk',
                    'qty' => (int) $detail->qty,
                    'line_total' => (int) $detail->price,
                    'base_cost_total' => ((int) ($detail->base_unit_price ?? 0)) > 0
                        ? (int) $detail->base_unit_price * (int) $detail->qty
                        : (int) $detail->price,
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

    protected function bestGrossProfitTransaction(Builder $baseQuery, ?int $outletId): ?object
    {
        $detailColumns = $this->transactionDetailSelectColumns();

        return (clone $baseQuery)
            ->with(['details' => fn ($query) => $query->select($detailColumns)])
            ->get()
            ->map(function (Transaction $transaction) use ($outletId) {
                $row = (object) $this->transformTransactionRow($transaction, $outletId);
                $row->invoice = $transaction->invoice;

                return $row;
            })
            ->sortByDesc('total_profit')
            ->first();
    }

    protected function baseCostByCashier(Collection $transactionIds): array
    {
        if ($transactionIds->isEmpty()) {
            return [];
        }

        $hasBaseUnitPrice = Schema::hasColumn('transaction_details', 'base_unit_price');
        $baseExpression = $hasBaseUnitPrice
            ? 'COALESCE(transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)'
            : 'COALESCE(transaction_details.price, 0)';

        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->whereIn('transaction_details.transaction_id', $transactionIds)
            ->selectRaw('transactions.cashier_id')
            ->selectRaw("COALESCE(SUM({$baseExpression}), 0) as base_cost_total")
            ->groupBy('transactions.cashier_id')
            ->pluck('base_cost_total', 'transactions.cashier_id')
            ->map(fn ($value) => (int) round($value))
            ->all();
    }

    protected function applyFilters($query, array $filters)
    {
        return $query
            ->when($filters['outlet_id'] ?? null, fn ($q, $outletId) => $q->where('transactions.outlet_id', $outletId))
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->where('transactions.invoice', 'like', '%'.$invoice.'%'))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashier) => $q->where('transactions.cashier_id', $cashier))
            ->when($filters['tenant_outlet_id'] ?? null, function ($q, $tenantOutletId) {
                if (! Schema::hasColumn('transaction_details', 'tenant_outlet_id')) {
                    return;
                }

                $q->whereHas('details', fn ($detailQuery) => $detailQuery->where('tenant_outlet_id', $tenantOutletId));
            })
            ->when($filters['customer_id'] ?? null, function ($q, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $q->whereNull('transactions.customer_id'),
                    default => $q->where('transactions.customer_id', $customer),
                };
            })
            ->when($filters['start_date'] ?? null, fn ($q, $start) => $q->whereDate('transactions.created_at', '>=', $start))
            ->when($filters['end_date'] ?? null, fn ($q, $end) => $q->whereDate('transactions.created_at', '<=', $end));
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
        ];

        foreach ([
            'tenant_outlet_id',
            'base_unit_price',
            'customer_base_unit_price',
            'tenant_discount_total',
            'owner_discount_total',
            'tenant_net_total',
            'owner_net_total',
            'pricing_rule_name',
            'pricing_rule_kind',
        ] as $optionalColumn) {
            if (Schema::hasColumn('transaction_details', $optionalColumn)) {
                $columns[] = $optionalColumn;
            }
        }

        return $columns;
    }

    protected function transactionDiscountSplit(Collection $transactionIds): array
    {
        if (
            $transactionIds->isEmpty()
            || ! Schema::hasColumn('transaction_details', 'tenant_discount_total')
            || ! Schema::hasColumn('transaction_details', 'owner_discount_total')
        ) {
            return [
                'tenant_discount_total' => 0,
                'owner_discount_total' => 0,
            ];
        }

        $row = TransactionDetail::query()
            ->whereIn('transaction_id', $transactionIds)
            ->selectRaw('COALESCE(SUM(tenant_discount_total), 0) as tenant_discount_total')
            ->selectRaw('COALESCE(SUM(owner_discount_total), 0) as owner_discount_total')
            ->first();

        return [
            'tenant_discount_total' => (int) ($row->tenant_discount_total ?? 0),
            'owner_discount_total' => (int) ($row->owner_discount_total ?? 0),
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

    protected function applyDefaultDatePreset(array $filters): array
    {
        $hasExplicitFilters = collect([
            $filters['start_date'] ?? null,
            $filters['end_date'] ?? null,
            $filters['invoice'] ?? null,
            $filters['cashier_id'] ?? null,
            $filters['customer_id'] ?? null,
            $filters['tenant_outlet_id'] ?? null,
            $filters['item_keyword'] ?? null,
            $filters['pricing_rule_kind'] ?? null,
        ])->contains(fn ($value) => filled($value));

        if ($hasExplicitFilters) {
            return $filters;
        }

        return [
            ...$filters,
            'start_date' => now()->subDays(6)->toDateString(),
            'end_date' => now()->toDateString(),
        ];
    }

    protected function itemBreakdownPaginator(array $filters, bool $tenantWorkspace = false)
    {
        return $this->itemBreakdownQuery($filters, $tenantWorkspace)
            ->orderByDesc('gross_profit_total')
            ->paginate(15, ['*'], 'item_page')
            ->withQueryString()
            ->through(fn ($row) => [
                'product_id' => $row->product_id ? (int) $row->product_id : null,
                'product_name' => $row->product_name ?? 'Produk',
                'tenant_outlet_id' => $row->tenant_outlet_id ? (int) $row->tenant_outlet_id : null,
                'tenant_outlet_name' => $row->tenant_outlet_name,
                'orders_count' => (int) ($row->orders_count ?? 0),
                'qty_sold' => (int) ($row->qty_sold ?? 0),
                'revenue_total' => (int) ($row->revenue_total ?? 0),
                'base_cost_total' => (int) ($row->base_cost_total ?? 0),
                'gross_profit_total' => (int) ($row->gross_profit_total ?? 0),
                'tenant_discount_total' => (int) ($row->tenant_discount_total ?? 0),
                'owner_discount_total' => $tenantWorkspace ? 0 : (int) ($row->owner_discount_total ?? 0),
                'tenant_net_total' => (int) ($row->tenant_net_total ?? 0),
                'owner_net_total' => $tenantWorkspace ? 0 : (int) ($row->owner_net_total ?? 0),
                'promo_lines_count' => (int) ($row->promo_lines_count ?? 0),
            ]);
    }

    protected function itemBreakdownQuery(array $filters, bool $tenantWorkspace = false)
    {
        $hasBaseUnitPrice = Schema::hasColumn('transaction_details', 'base_unit_price');
        $hasTenantOutletId = Schema::hasColumn('transaction_details', 'tenant_outlet_id');
        $baseExpression = $tenantWorkspace
            ? 'COALESCE(products.tenant_hpp_price, transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)'
            : ($hasBaseUnitPrice
                ? 'COALESCE(transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)'
                : 'COALESCE(transaction_details.price, 0)');

        return $this->applyItemFilters(
            TransactionDetail::query()
                ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
                ->leftJoin('products', 'products.id', '=', 'transaction_details.product_id')
                ->when(
                    $hasTenantOutletId,
                    fn ($query) => $query->leftJoin('outlets as tenant_outlets', 'tenant_outlets.id', '=', 'transaction_details.tenant_outlet_id')
                )
                ->selectRaw('transaction_details.product_id')
                ->selectRaw('MAX(products.title) as product_name')
                ->selectRaw($hasTenantOutletId ? 'MAX(transaction_details.tenant_outlet_id) as tenant_outlet_id' : 'NULL as tenant_outlet_id')
                ->selectRaw($hasTenantOutletId ? 'MAX(tenant_outlets.name) as tenant_outlet_name' : 'NULL as tenant_outlet_name')
                ->selectRaw('COUNT(DISTINCT transaction_details.transaction_id) as orders_count')
                ->selectRaw('COALESCE(SUM(transaction_details.qty), 0) as qty_sold')
                ->selectRaw('COALESCE(SUM(transaction_details.price), 0) as revenue_total')
                ->selectRaw("COALESCE(SUM({$baseExpression}), 0) as base_cost_total")
                ->selectRaw("COALESCE(SUM(transaction_details.price), 0) - COALESCE(SUM({$baseExpression}), 0) as gross_profit_total")
                ->selectRaw(Schema::hasColumn('transaction_details', 'tenant_discount_total') ? 'COALESCE(SUM(transaction_details.tenant_discount_total), 0) as tenant_discount_total' : '0 as tenant_discount_total')
                ->selectRaw(Schema::hasColumn('transaction_details', 'owner_discount_total') ? 'COALESCE(SUM(transaction_details.owner_discount_total), 0) as owner_discount_total' : '0 as owner_discount_total')
                ->selectRaw(Schema::hasColumn('transaction_details', 'tenant_net_total') ? 'COALESCE(SUM(transaction_details.tenant_net_total), 0) as tenant_net_total' : '0 as tenant_net_total')
                ->selectRaw(Schema::hasColumn('transaction_details', 'owner_net_total') ? 'COALESCE(SUM(transaction_details.owner_net_total), 0) as owner_net_total' : '0 as owner_net_total')
                ->selectRaw(Schema::hasColumn('transaction_details', 'pricing_rule_name') ? "COALESCE(SUM(CASE WHEN transaction_details.pricing_rule_name IS NOT NULL AND transaction_details.pricing_rule_name <> '' THEN 1 ELSE 0 END), 0) as promo_lines_count" : '0 as promo_lines_count')
                ->groupBy('transaction_details.product_id'),
            $filters
        );
    }

    protected function applyItemFilters($query, array $filters)
    {
        return $query
            ->when($filters['outlet_id'] ?? null, fn ($q, $outletId) => $q->where('transactions.outlet_id', $outletId))
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->where('transactions.invoice', 'like', '%'.$invoice.'%'))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashier) => $q->where('transactions.cashier_id', $cashier))
            ->when($filters['tenant_outlet_id'] ?? null, function ($q, $tenantOutletId) {
                if (! Schema::hasColumn('transaction_details', 'tenant_outlet_id')) {
                    return;
                }

                $q->where('transaction_details.tenant_outlet_id', $tenantOutletId);
            })
            ->when($filters['customer_id'] ?? null, function ($q, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $q->whereNull('transactions.customer_id'),
                    default => $q->where('transactions.customer_id', $customer),
                };
            })
            ->when($filters['item_keyword'] ?? null, function ($q, $keyword) {
                $q->where(function ($nested) use ($keyword) {
                    $nested->where('products.title', 'like', '%'.$keyword.'%')
                        ->orWhere('transactions.invoice', 'like', '%'.$keyword.'%');
                });
            })
            ->when($filters['pricing_rule_kind'] ?? null, function ($q, $kind) {
                if (! Schema::hasColumn('transaction_details', 'pricing_rule_kind')) {
                    return;
                }

                $q->where('transaction_details.pricing_rule_kind', $kind);
            })
            ->when($filters['start_date'] ?? null, fn ($q, $start) => $q->whereDate('transactions.created_at', '>=', $start))
            ->when($filters['end_date'] ?? null, fn ($q, $end) => $q->whereDate('transactions.created_at', '<=', $end));
    }

    protected function applyTenantAllocationFilters($query, array $filters)
    {
        return $query
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->whereHas('transaction', fn ($tx) => $tx->where('invoice', 'like', '%'.$invoice.'%')))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashierId) => $q->where('cashier_id', $cashierId))
            ->when($filters['tenant_outlet_id'] ?? null, fn ($q, $tenantOutletId) => $q->where('tenant_outlet_id', $tenantOutletId))
            ->when($filters['customer_id'] ?? null, function ($q, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $q->whereHas('transaction', fn ($tx) => $tx->whereNull('customer_id')),
                    default => $q->whereHas('transaction', fn ($tx) => $tx->where('customer_id', $customer)),
                };
            })
            ->when($filters['start_date'] ?? null, fn ($q, $start) => $q->whereHas('transaction', fn ($tx) => $tx->whereDate('created_at', '>=', $start)))
            ->when($filters['end_date'] ?? null, fn ($q, $end) => $q->whereHas('transaction', fn ($tx) => $tx->whereDate('created_at', '<=', $end)));
    }

    protected function appendTenantProfitMetrics($allocations)
    {
        if ($allocations instanceof \Illuminate\Contracts\Pagination\LengthAwarePaginator) {
            $allocations->setCollection($this->appendTenantProfitMetrics($allocations->getCollection()));

            return $allocations;
        }

        return $allocations->map(function (TransactionTenantAllocation $allocation) {
            $revenueTotal = (int) ($allocation->grand_total ?? 0);
            $costTotal = (int) $allocation->items->sum(function (TransactionTenantAllocationItem $item) {
                $tenantHppPrice = (int) ($item->product?->tenant_hpp_price ?? $item->base_unit_price ?? 0);

                return $tenantHppPrice * (int) ($item->qty ?? 0);
            });
            $profitTotal = $revenueTotal - $costTotal;
            $discountTotal = (int) ($allocation->promo_discount_total ?? 0)
                + (int) ($allocation->voucher_discount_total ?? 0)
                + (int) ($allocation->loyalty_discount_total ?? 0)
                + (int) ($allocation->manual_discount_total ?? 0);

            $allocation->setAttribute('profit_total', $profitTotal);
            $allocation->setAttribute('pre_promo_subtotal', (int) ($allocation->subtotal ?? 0) + (int) ($allocation->promo_discount_total ?? 0));
            $allocation->setAttribute('discount_total', $discountTotal);

            return $allocation;
        });
    }

    protected function transformTenantProfitAllocationRow(TransactionTenantAllocation $allocation): array
    {
        $transaction = $allocation->transaction;

        return [
            'id' => $allocation->id,
            'invoice' => $transaction?->invoice ?? $allocation->allocation_number,
            'created_at' => optional($transaction?->created_at)?->format('Y-m-d H:i:s'),
            'customer' => $transaction?->customer ? ['name' => $transaction->customer->name] : null,
            'cashier' => $transaction?->cashier ? ['name' => $transaction->cashier->name] : null,
            'grand_total' => (int) ($allocation->grand_total ?? 0),
            'pre_promo_subtotal' => (int) ($allocation->pre_promo_subtotal ?? 0),
            'base_cost_total' => (int) ($allocation->cost_total ?? 0),
            'markup_total' => (int) ($allocation->profit_total ?? 0),
            'tenant_revenue_total' => (int) ($allocation->grand_total ?? 0),
            'tenant_discount_total' => (int) ($allocation->discount_total ?? 0),
            'tenant_net_total' => (int) ($allocation->grand_total ?? 0),
            'owner_discount_total' => 0,
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

    protected function tenantCashierSummary(Collection $allocations): array
    {
        return $allocations
            ->groupBy(fn (TransactionTenantAllocation $allocation) => (int) ($allocation->transaction?->cashier_id ?? 0))
            ->filter(fn (Collection $rows, int $cashierId) => $cashierId > 0)
            ->map(function (Collection $rows, int $cashierId) {
                $cashierName = $rows->first()?->transaction?->cashier?->name;
                $ordersCount = $rows->count();
                $walkInCount = $rows->filter(fn ($allocation) => blank($allocation->transaction?->customer_id))->count();
                $revenueTotal = (int) $rows->sum('grand_total');
                $profitTotal = (int) $rows->sum('profit_total');

                return [
                    'cashier_id' => $cashierId,
                    'cashier_name' => $cashierName,
                    'orders_count' => $ordersCount,
                    'walk_in_count' => $walkInCount,
                    'registered_customer_count' => max(0, $ordersCount - $walkInCount),
                    'revenue_total' => $revenueTotal,
                    'profit_total' => $profitTotal,
                    'walk_in_share' => $ordersCount > 0 ? round(($walkInCount / $ordersCount) * 100, 2) : 0,
                    'average_profit' => $ordersCount > 0 ? (int) round($profitTotal / $ordersCount) : 0,
                ];
            })
            ->sortByDesc('profit_total')
            ->values()
            ->all();
    }

    protected function tenantDailyProfitTrend(Collection $allocations): Collection
    {
        return $allocations
            ->groupBy(fn (TransactionTenantAllocation $allocation) => optional($allocation->transaction?->created_at)?->format('Y-m-d'))
            ->filter(fn (Collection $rows, ?string $day) => filled($day))
            ->map(function (Collection $rows, string $day) {
                $revenueTotal = (int) $rows->sum('grand_total');
                $baseCostTotal = (int) $rows->sum('cost_total');

                return [
                    'day' => $day,
                    'label' => Carbon::parse($day)->format('d M Y'),
                    'orders_count' => (int) $rows->count(),
                    'revenue_total' => $revenueTotal,
                    'profit_total' => (int) $rows->sum('profit_total'),
                    'base_cost_total' => $baseCostTotal,
                    'markup_total' => max(0, $revenueTotal - $baseCostTotal),
                    'discount_total' => (int) $rows->sum('discount_total'),
                    'owner_direct_revenue_total' => 0,
                    'owner_direct_markup_total' => 0,
                    'tenant_after_promo_total' => $revenueTotal,
                    'tenant_discount_total' => (int) $rows->sum('discount_total'),
                ];
            })
            ->sortBy('day')
            ->values();
    }
}
