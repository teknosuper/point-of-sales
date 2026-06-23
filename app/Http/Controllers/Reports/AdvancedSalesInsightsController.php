<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerCampaign;
use App\Models\CustomerCampaignLog;
use App\Models\CustomerSegment;
use App\Models\CustomerVoucher;
use App\Models\LoyaltyPointHistory;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use App\Services\CustomerOutletMetricService;
use App\Services\LoyaltyService;
use App\Services\OutletResolver;
use App\Support\ReportTimezone;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class AdvancedSalesInsightsController extends Controller
{
    public function __construct(
        private readonly CustomerOutletMetricService $customerOutletMetricService,
        private readonly LoyaltyService $loyaltyService,
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $outletId = $activeOutlet?->id;
        $isTenantWorkspace = (string) ($activeOutlet?->outlet_type ?? '') === 'tenant';
        $activeTab = $this->resolveActiveTab($request);
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'cashier_id' => $request->input('cashier_id'),
            'customer_id' => $request->input('customer_id'),
            'category_id' => $request->input('category_id'),
            'outlet_id' => $isTenantWorkspace ? null : $outletId,
            'tenant_outlet_id' => $isTenantWorkspace ? $outletId : null,
        ];

        $transactionQuery = $this->applyTransactionFilters(
            Transaction::query(),
            $filters
        );

        if ($isTenantWorkspace) {
            $summaryRaw = $this->tenantWorkspaceSummary($filters);
            $transactionCount = (int) ($summaryRaw->orders_count ?? 0);
            $itemsSold = (int) ($summaryRaw->items_sold ?? 0);
            $profitTotal = (int) round($summaryRaw->profit_total ?? 0);
        } else {
            $transactionIds = (clone $transactionQuery)->pluck('id');
            $transactionCount = $transactionIds->count();
            $summaryRaw = (clone $transactionQuery)
                ->selectRaw('COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as revenue_total, COALESCE(SUM(discount), 0) as manual_discount_total')
                ->first();
            $itemsSold = $transactionIds->isNotEmpty()
                ? (int) DB::table('transaction_details')
                    ->whereIn('transaction_id', $transactionIds)
                    ->sum('qty')
                : 0;
            $profitTotal = $transactionIds->isNotEmpty()
                ? (int) DB::table('profits')
                    ->whereIn('transaction_id', $transactionIds)
                    ->sum('total')
                : 0;
        }

        $salesByHour = [];
        $salesByDay = [];
        $cashierPerformance = [];
        $orderSourceStats = [];
        $orderTypeStats = [];
        $topSellingProducts = [];
        $lowPerformingProducts = [];
        $marginByProduct = [];
        $marginByCategory = [];
        $stockCoverage = ['summary' => [], 'products' => []];
        $repeatCustomerMetrics = ['summary' => [], 'top_customers' => []];
        $promoMonitor = ['summary' => [], 'active_rules' => [], 'scheduled_rules' => [], 'recent_audits' => []];
        $loyaltyPerformance = ['summary' => [], 'top_members' => []];
        $crmOperations = ['summary' => [], 'recent_campaigns' => []];

        if ($activeTab === 'overview') {
            $salesByHour = $this->salesByHour($filters);
            $salesByDay = $this->salesByDay($filters);
            $cashierPerformance = $this->cashierPerformance($filters);
            $orderSourceStats = $this->orderSourceStats($filters);
            $orderTypeStats = $this->orderTypeStats($filters);
        }

        if ($activeTab === 'products') {
            $topSellingProducts = $this->topSellingProducts($filters);
            $lowPerformingProducts = $this->lowPerformingProducts($filters);
            $marginByProduct = $this->marginByProduct($filters);
            $marginByCategory = $this->marginByCategory($filters);
            $stockCoverage = $this->stockCoverageAnalysis($filters);
        }

        if ($activeTab === 'customers') {
            $repeatCustomerMetrics = $this->repeatCustomerMetrics($filters);
            $loyaltyPerformance = $isTenantWorkspace
                ? ['summary' => [], 'top_members' => []]
                : $this->loyaltyPerformance($filters);
            $crmOperations = $isTenantWorkspace
                ? ['summary' => [], 'recent_campaigns' => []]
                : $this->crmOperations($filters);
        }

        if ($activeTab === 'promos') {
            $promoMonitor = $this->promoMonitor($filters);
        }

        return Inertia::render('Dashboard/Reports/Insights', [
            'activeTab' => $activeTab,
            'filters' => $filters,
            'cashiers' => User::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::select('id', 'name')->orderBy('name')->get(),
            'categories' => Category::query()
                ->when(
                    $isTenantWorkspace && Schema::hasColumn('categories', 'tenant_outlet_id'),
                    fn ($query) => $query->where('tenant_outlet_id', $outletId)
                )
                ->select('id', 'name')
                ->orderBy('name')
                ->get(),
            'summary' => [
                'orders_count' => (int) ($summaryRaw->orders_count ?? 0),
                'revenue_total' => (int) ($summaryRaw->revenue_total ?? 0),
                'manual_discount_total' => (int) ($summaryRaw->manual_discount_total ?? 0),
                'items_sold' => (int) $itemsSold,
                'profit_total' => (int) $profitTotal,
                'average_order' => $transactionCount > 0
                    ? (int) round(($summaryRaw->revenue_total ?? 0) / $transactionCount)
                    : 0,
            ],
            'salesByHour' => $salesByHour,
            'salesByDay' => $salesByDay,
            'topSellingProducts' => $topSellingProducts,
            'lowPerformingProducts' => $lowPerformingProducts,
            'marginByProduct' => $marginByProduct,
            'marginByCategory' => $marginByCategory,
            'cashierPerformance' => $cashierPerformance,
            'orderSourceStats' => $orderSourceStats,
            'orderTypeStats' => $orderTypeStats,
            'repeatCustomerMetrics' => $repeatCustomerMetrics,
            'stockCoverage' => $stockCoverage,
            'promoMonitor' => $promoMonitor,
            'loyaltyPerformance' => $loyaltyPerformance,
            'crmOperations' => $crmOperations,
            'workspace' => [
                'is_tenant_workspace' => $isTenantWorkspace,
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

    protected function resolveActiveTab(Request $request): string
    {
        $tab = (string) $request->query('tab', 'overview');

        return in_array($tab, ['overview', 'products', 'customers', 'promos'], true)
            ? $tab
            : 'overview';
    }

    protected function applyTransactionFilters(Builder $query, array $filters): Builder
    {
        $query = $query
            ->when($filters['outlet_id'] ?? null, fn (Builder $q, $outletId) => $q->where('transactions.outlet_id', $outletId))
            ->when($filters['cashier_id'] ?? null, fn (Builder $q, $cashierId) => $q->where('transactions.cashier_id', $cashierId))
            ->when($filters['customer_id'] ?? null, function (Builder $q, $customerId) {
                return match ((string) $customerId) {
                    'walk_in' => $q->whereNull('transactions.customer_id'),
                    default => $q->where('transactions.customer_id', $customerId),
                };
            })
            ->when($filters['category_id'] ?? null, function (Builder $q, $categoryId) {
                $q->whereHas('details.product', fn (Builder $productQuery) => $productQuery->where('category_id', $categoryId));
            })
            ->when($filters['tenant_outlet_id'] ?? null, function (Builder $q, $tenantOutletId) {
                if (! Schema::hasColumn('transaction_details', 'tenant_outlet_id')) {
                    return;
                }

                $q->whereHas('details', fn (Builder $detailQuery) => $detailQuery->where('tenant_outlet_id', $tenantOutletId));
            });

        return ReportTimezone::applySourceDateRange($query, 'transactions.created_at', $filters);
    }

    protected function detailMetricsQuery(array $filters)
    {
        return ReportTimezone::applySourceDateRange(
            DB::table('transaction_details as td')
            ->join('transactions as t', 't.id', '=', 'td.transaction_id')
            ->join('products as p', 'p.id', '=', 'td.product_id')
            ->leftJoin('categories as c', 'c.id', '=', 'p.category_id')
            ->when($filters['outlet_id'] ?? null, fn ($q, $outletId) => $q->where('t.outlet_id', $outletId))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashierId) => $q->where('t.cashier_id', $cashierId))
            ->when($filters['customer_id'] ?? null, function ($q, $customerId) {
                return match ((string) $customerId) {
                    'walk_in' => $q->whereNull('t.customer_id'),
                    default => $q->where('t.customer_id', $customerId),
                };
            })
            ->when($filters['category_id'] ?? null, fn ($q, $categoryId) => $q->where('p.category_id', $categoryId))
            ->when($filters['tenant_outlet_id'] ?? null, fn ($q, $tenantOutletId) => $q->where('td.tenant_outlet_id', $tenantOutletId)),
            't.created_at',
            $filters
        );
    }

    protected function topSellingProducts(array $filters): array
    {
        return $this->detailMetricsQuery($filters)
            ->selectRaw('
                td.product_id,
                p.title as product_title,
                p.sku as product_sku,
                c.name as category_name,
                p.stock as current_stock,
                SUM(td.qty) as qty_sold,
                SUM(td.price) as revenue_total,
                SUM((td.price - ROUND((COALESCE(t.discount, 0) * td.price) / NULLIF(tx.subtotal_after_promo, 0))) - (p.buy_price * td.qty)) as profit_total,
                MAX(t.created_at) as last_sold_at
            ')
            ->joinSub(
                DB::table('transaction_details')
                    ->selectRaw('transaction_id, SUM(price) as subtotal_after_promo')
                    ->groupBy('transaction_id'),
                'tx',
                fn ($join) => $join->on('tx.transaction_id', '=', 'td.transaction_id')
            )
            ->groupBy('td.product_id', 'p.title', 'p.sku', 'c.name', 'p.stock')
            ->orderByDesc('qty_sold')
            ->orderByDesc('revenue_total')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'product_id' => (int) $row->product_id,
                'product_title' => $row->product_title,
                'product_sku' => $row->product_sku,
                'category_name' => $row->category_name,
                'current_stock' => (int) $row->current_stock,
                'qty_sold' => (int) $row->qty_sold,
                'revenue_total' => (int) round($row->revenue_total),
                'profit_total' => (int) round($row->profit_total),
                'last_sold_at' => ReportTimezone::formatSourceIso8601($row->last_sold_at),
            ])
            ->all();
    }

    protected function lowPerformingProducts(array $filters): array
    {
        $salesSubquery = $this->detailMetricsQuery($filters)
            ->selectRaw('
                td.product_id,
                SUM(td.qty) as qty_sold,
                SUM(td.price) as revenue_total,
                SUM((td.price - ROUND((COALESCE(t.discount, 0) * td.price) / NULLIF(tx.subtotal_after_promo, 0))) - (p.buy_price * td.qty)) as profit_total,
                MAX(t.created_at) as last_sold_at
            ')
            ->joinSub(
                DB::table('transaction_details')
                    ->selectRaw('transaction_id, SUM(price) as subtotal_after_promo')
                    ->groupBy('transaction_id'),
                'tx',
                fn ($join) => $join->on('tx.transaction_id', '=', 'td.transaction_id')
            )
            ->groupBy('td.product_id');

        return Product::query()
            ->leftJoinSub($salesSubquery, 'sales', fn ($join) => $join->on('sales.product_id', '=', 'products.id'))
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->when($filters['category_id'] ?? null, fn ($q, $categoryId) => $q->where('products.category_id', $categoryId))
            ->when($filters['tenant_outlet_id'] ?? null, fn ($q, $tenantOutletId) => $q->where('products.tenant_outlet_id', $tenantOutletId))
            ->where('products.stock', '>', 0)
            ->selectRaw('
                products.id as product_id,
                products.title as product_title,
                products.sku as product_sku,
                categories.name as category_name,
                products.stock as current_stock,
                COALESCE(sales.qty_sold, 0) as qty_sold,
                COALESCE(sales.revenue_total, 0) as revenue_total,
                COALESCE(sales.profit_total, 0) as profit_total,
                sales.last_sold_at as last_sold_at
            ')
            ->orderBy('qty_sold')
            ->orderBy('revenue_total')
            ->orderByDesc('products.stock')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'product_id' => (int) $row->product_id,
                'product_title' => $row->product_title,
                'product_sku' => $row->product_sku,
                'category_name' => $row->category_name,
                'current_stock' => (int) $row->current_stock,
                'qty_sold' => (int) $row->qty_sold,
                'revenue_total' => (int) round($row->revenue_total),
                'profit_total' => (int) round($row->profit_total),
                'last_sold_at' => ReportTimezone::formatSourceIso8601($row->last_sold_at),
            ])
            ->all();
    }

    protected function marginByProduct(array $filters): array
    {
        return $this->detailMetricsQuery($filters)
            ->selectRaw('
                td.product_id,
                p.title as product_title,
                c.name as category_name,
                SUM(td.qty) as qty_sold,
                SUM(td.price) as revenue_total,
                SUM((td.price - ROUND((COALESCE(t.discount, 0) * td.price) / NULLIF(tx.subtotal_after_promo, 0))) - (p.buy_price * td.qty)) as profit_total
            ')
            ->joinSub(
                DB::table('transaction_details')
                    ->selectRaw('transaction_id, SUM(price) as subtotal_after_promo')
                    ->groupBy('transaction_id'),
                'tx',
                fn ($join) => $join->on('tx.transaction_id', '=', 'td.transaction_id')
            )
            ->groupBy('td.product_id', 'p.title', 'c.name')
            ->orderByDesc('profit_total')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'product_id' => (int) $row->product_id,
                'product_title' => $row->product_title,
                'category_name' => $row->category_name,
                'qty_sold' => (int) $row->qty_sold,
                'revenue_total' => (int) round($row->revenue_total),
                'profit_total' => (int) round($row->profit_total),
                'margin_percentage' => (float) ($row->revenue_total > 0
                    ? round(($row->profit_total / $row->revenue_total) * 100, 2)
                    : 0),
            ])
            ->all();
    }

    protected function marginByCategory(array $filters): array
    {
        return $this->detailMetricsQuery($filters)
            ->selectRaw('
                p.category_id,
                COALESCE(c.name, \'Tanpa Kategori\') as category_name,
                SUM(td.qty) as qty_sold,
                SUM(td.price) as revenue_total,
                SUM((td.price - ROUND((COALESCE(t.discount, 0) * td.price) / NULLIF(tx.subtotal_after_promo, 0))) - (p.buy_price * td.qty)) as profit_total
            ')
            ->joinSub(
                DB::table('transaction_details')
                    ->selectRaw('transaction_id, SUM(price) as subtotal_after_promo')
                    ->groupBy('transaction_id'),
                'tx',
                fn ($join) => $join->on('tx.transaction_id', '=', 'td.transaction_id')
            )
            ->groupBy('p.category_id', 'c.name')
            ->orderByDesc('profit_total')
            ->get()
            ->map(fn ($row) => [
                'category_id' => $row->category_id ? (int) $row->category_id : null,
                'category_name' => $row->category_name,
                'qty_sold' => (int) $row->qty_sold,
                'revenue_total' => (int) round($row->revenue_total),
                'profit_total' => (int) round($row->profit_total),
                'margin_percentage' => (float) ($row->revenue_total > 0
                    ? round(($row->profit_total / $row->revenue_total) * 100, 2)
                    : 0),
            ])
            ->all();
    }

    protected function salesByHour(array $filters): array
    {
        if ($this->isTenantWorkspace($filters)) {
            return $this->tenantSalesByHour($filters);
        }

        $hourExpression = ReportTimezone::sourceToDisplayHourExpression('created_at');

        $rows = $this->applyTransactionFilters(Transaction::query(), $filters)
            ->selectRaw("{$hourExpression} as hour_bucket, COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as revenue_total")
            ->groupBy(DB::raw($hourExpression))
            ->orderBy(DB::raw($hourExpression))
            ->get()
            ->keyBy(fn ($row) => (int) $row->hour_bucket);

        return collect(range(0, 23))
            ->map(function (int $hour) use ($rows) {
                $row = $rows->get($hour);

                return [
                    'hour' => $hour,
                    'label' => sprintf('%02d:00', $hour),
                    'orders_count' => (int) ($row->orders_count ?? 0),
                    'revenue_total' => (int) round($row->revenue_total ?? 0),
                ];
            })
            ->all();
    }

    protected function salesByDay(array $filters): array
    {
        if ($this->isTenantWorkspace($filters)) {
            return $this->tenantSalesByDay($filters);
        }

        return $this->applyTransactionFilters(Transaction::query(), $filters)
            ->selectRaw(ReportTimezone::sourceToDisplayDateExpression('created_at').' as sales_date, COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as revenue_total')
            ->groupBy('sales_date')
            ->orderBy('sales_date')
            ->get()
            ->map(fn ($row) => [
                'date' => $row->sales_date,
                'label' => Carbon::parse($row->sales_date, ReportTimezone::timezone())->format('d M'),
                'orders_count' => (int) $row->orders_count,
                'revenue_total' => (int) round($row->revenue_total),
            ])
            ->all();
    }

    protected function cashierPerformance(array $filters): array
    {
        if ($this->isTenantWorkspace($filters)) {
            return $this->tenantCashierPerformance($filters);
        }

        $transactionsByCashier = $this->applyTransactionFilters(Transaction::query(), $filters)
            ->selectRaw('
                cashier_id,
                COUNT(*) as orders_count,
                COALESCE(SUM(grand_total), 0) as revenue_total,
                SUM(CASE WHEN customer_id IS NULL THEN 1 ELSE 0 END) as walk_in_orders_count,
                COALESCE(SUM(CASE WHEN customer_id IS NULL THEN grand_total ELSE 0 END), 0) as walk_in_revenue_total
            ')
            ->groupBy('cashier_id');

        $itemsByCashier = $this->detailMetricsQuery($filters)
            ->selectRaw('t.cashier_id, COALESCE(SUM(td.qty), 0) as items_sold')
            ->groupBy('t.cashier_id');

        $profitByCashier = $this->applyTransactionFilters(Transaction::query(), $filters)
            ->join('profits', 'profits.transaction_id', '=', 'transactions.id')
            ->selectRaw('transactions.cashier_id, COALESCE(SUM(profits.total), 0) as profit_total')
            ->groupBy('transactions.cashier_id');

        return DB::query()
            ->fromSub($transactionsByCashier, 'tx')
            ->leftJoinSub($itemsByCashier, 'items', fn ($join) => $join->on('items.cashier_id', '=', 'tx.cashier_id'))
            ->leftJoinSub($profitByCashier, 'profits', fn ($join) => $join->on('profits.cashier_id', '=', 'tx.cashier_id'))
            ->leftJoin('users', 'users.id', '=', 'tx.cashier_id')
            ->selectRaw('
                tx.cashier_id,
                users.name as cashier_name,
                tx.orders_count,
                tx.revenue_total,
                tx.walk_in_orders_count,
                tx.walk_in_revenue_total,
                COALESCE(items.items_sold, 0) as items_sold,
                COALESCE(profits.profit_total, 0) as profit_total
            ')
            ->orderByDesc('items_sold')
            ->orderByDesc('revenue_total')
            ->get()
            ->map(fn ($row) => [
                'cashier_id' => (int) $row->cashier_id,
                'cashier_name' => $row->cashier_name,
                'orders_count' => (int) $row->orders_count,
                'walk_in_orders_count' => (int) ($row->walk_in_orders_count ?? 0),
                'registered_orders_count' => max(0, (int) $row->orders_count - (int) ($row->walk_in_orders_count ?? 0)),
                'items_sold' => (int) $row->items_sold,
                'revenue_total' => (int) round($row->revenue_total),
                'walk_in_revenue_total' => (int) round($row->walk_in_revenue_total ?? 0),
                'registered_revenue_total' => max(0, (int) round($row->revenue_total) - (int) round($row->walk_in_revenue_total ?? 0)),
                'profit_total' => (int) round($row->profit_total),
                'average_basket' => (int) ($row->orders_count > 0
                    ? round($row->revenue_total / $row->orders_count)
                    : 0),
                'walk_in_share' => (int) $row->orders_count > 0
                    ? round((((int) ($row->walk_in_orders_count ?? 0)) / (int) $row->orders_count) * 100, 2)
                    : 0,
            ])
            ->all();
    }

    protected function orderSourceStats(array $filters): array
    {
        return $this->isTenantWorkspace($filters)
            ? $this->tenantOrderSourceStats($filters)
            : $this->ownerOrderSourceStats($filters);
    }

    protected function ownerOrderSourceStats(array $filters): array
    {
        if (! Schema::hasColumn('transactions', 'source_channel')) {
            $summary = (clone $this->applyTransactionFilters(Transaction::query(), $filters))
                ->selectRaw('COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as revenue_total')
                ->first();

            $itemsSold = $this->detailMetricsQuery($filters)
                ->selectRaw('COALESCE(SUM(td.qty), 0) as items_sold')
                ->value('items_sold');

            return $this->formatOrderSourceStats(collect([
                (object) [
                    'source_channel' => 'pos',
                    'orders_count' => (int) ($summary->orders_count ?? 0),
                    'revenue_total' => (int) round($summary->revenue_total ?? 0),
                    'items_sold' => (int) round($itemsSold ?? 0),
                ],
            ]));
        }

        $itemSubquery = $this->detailMetricsQuery($filters)
            ->selectRaw('td.transaction_id, COALESCE(SUM(td.qty), 0) as items_sold')
            ->groupBy('td.transaction_id');

        $rows = $this->applyTransactionFilters(Transaction::query(), $filters)
            ->leftJoinSub($itemSubquery, 'items', fn ($join) => $join->on('items.transaction_id', '=', 'transactions.id'))
            ->selectRaw("COALESCE(transactions.source_channel, 'pos') as source_channel")
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(transactions.grand_total), 0) as revenue_total')
            ->selectRaw('COALESCE(SUM(COALESCE(items.items_sold, 0)), 0) as items_sold')
            ->groupBy('source_channel')
            ->get();

        return $this->formatOrderSourceStats($rows);
    }

    protected function tenantOrderSourceStats(array $filters): array
    {
        if (! Schema::hasColumn('transactions', 'source_channel')) {
            $summary = $this->detailMetricsQuery($filters)
                ->selectRaw('COUNT(DISTINCT t.id) as orders_count')
                ->selectRaw('COALESCE(SUM(td.price), 0) as revenue_total')
                ->selectRaw('COALESCE(SUM(td.qty), 0) as items_sold')
                ->first();

            return $this->formatOrderSourceStats(collect([
                (object) [
                    'source_channel' => 'pos',
                    'orders_count' => (int) ($summary->orders_count ?? 0),
                    'revenue_total' => (int) round($summary->revenue_total ?? 0),
                    'items_sold' => (int) round($summary->items_sold ?? 0),
                ],
            ]));
        }

        $rows = $this->detailMetricsQuery($filters)
            ->selectRaw("COALESCE(t.source_channel, 'pos') as source_channel")
            ->selectRaw('COUNT(DISTINCT t.id) as orders_count')
            ->selectRaw('COALESCE(SUM(td.price), 0) as revenue_total')
            ->selectRaw('COALESCE(SUM(td.qty), 0) as items_sold')
            ->groupBy('source_channel')
            ->get();

        return $this->formatOrderSourceStats($rows);
    }

    protected function formatOrderSourceStats($rows): array
    {
        $stats = collect([
            'pos' => [
                'key' => 'pos',
                'label' => 'Kasir',
                'orders_count' => 0,
                'revenue_total' => 0,
                'items_sold' => 0,
                'average_order' => 0,
                'revenue_share' => 0,
                'orders_share' => 0,
            ],
            'table_qr' => [
                'key' => 'table_qr',
                'label' => 'Self Order',
                'orders_count' => 0,
                'revenue_total' => 0,
                'items_sold' => 0,
                'average_order' => 0,
                'revenue_share' => 0,
                'orders_share' => 0,
            ],
            'other' => [
                'key' => 'other',
                'label' => 'Channel Lain',
                'orders_count' => 0,
                'revenue_total' => 0,
                'items_sold' => 0,
                'average_order' => 0,
                'revenue_share' => 0,
                'orders_share' => 0,
            ],
        ]);

        foreach ($rows as $row) {
            $rawKey = (string) ($row->source_channel ?? 'pos');
            $key = in_array($rawKey, ['pos', 'table_qr'], true) ? $rawKey : 'other';
            $current = $stats->get($key);
            $ordersCount = (int) ($row->orders_count ?? 0);
            $revenueTotal = (int) round($row->revenue_total ?? 0);
            $itemsSold = (int) round($row->items_sold ?? 0);

            $current['orders_count'] += $ordersCount;
            $current['revenue_total'] += $revenueTotal;
            $current['items_sold'] += $itemsSold;

            $stats->put($key, $current);
        }

        $totalOrders = (int) $stats->sum('orders_count');
        $totalRevenue = (int) $stats->sum('revenue_total');

        return [
            'summary' => [
                'total_orders' => $totalOrders,
                'total_revenue' => $totalRevenue,
            ],
            'channels' => $stats
                ->map(function (array $row) use ($totalOrders, $totalRevenue) {
                    $row['average_order'] = $row['orders_count'] > 0
                        ? (int) round($row['revenue_total'] / $row['orders_count'])
                        : 0;
                    $row['revenue_share'] = $totalRevenue > 0
                        ? round(($row['revenue_total'] / $totalRevenue) * 100, 2)
                        : 0;
                    $row['orders_share'] = $totalOrders > 0
                        ? round(($row['orders_count'] / $totalOrders) * 100, 2)
                        : 0;

                    return $row;
                })
                ->values()
                ->all(),
        ];
    }

    protected function orderTypeStats(array $filters): array
    {
        return $this->isTenantWorkspace($filters)
            ? $this->tenantOrderTypeStats($filters)
            : $this->ownerOrderTypeStats($filters);
    }

    protected function ownerOrderTypeStats(array $filters): array
    {
        if (! Schema::hasColumn('transactions', 'order_type')) {
            $summary = (clone $this->applyTransactionFilters(Transaction::query(), $filters))
                ->selectRaw('COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as revenue_total')
                ->first();

            $itemsSold = $this->detailMetricsQuery($filters)
                ->selectRaw('COALESCE(SUM(td.qty), 0) as items_sold')
                ->value('items_sold');

            return $this->formatOrderTypeStats(collect([
                (object) [
                    'order_type' => 'take_away',
                    'orders_count' => (int) ($summary->orders_count ?? 0),
                    'revenue_total' => (int) round($summary->revenue_total ?? 0),
                    'items_sold' => (int) round($itemsSold ?? 0),
                ],
            ]));
        }

        $itemSubquery = $this->detailMetricsQuery($filters)
            ->selectRaw('td.transaction_id, COALESCE(SUM(td.qty), 0) as items_sold')
            ->groupBy('td.transaction_id');

        $rows = $this->applyTransactionFilters(Transaction::query(), $filters)
            ->leftJoinSub($itemSubquery, 'items', fn ($join) => $join->on('items.transaction_id', '=', 'transactions.id'))
            ->selectRaw("COALESCE(transactions.order_type, 'take_away') as order_type")
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(transactions.grand_total), 0) as revenue_total')
            ->selectRaw('COALESCE(SUM(COALESCE(items.items_sold, 0)), 0) as items_sold')
            ->groupBy('order_type')
            ->get();

        return $this->formatOrderTypeStats($rows);
    }

    protected function tenantOrderTypeStats(array $filters): array
    {
        if (! Schema::hasColumn('transactions', 'order_type')) {
            $summary = $this->detailMetricsQuery($filters)
                ->selectRaw('COUNT(DISTINCT t.id) as orders_count')
                ->selectRaw('COALESCE(SUM(td.price), 0) as revenue_total')
                ->selectRaw('COALESCE(SUM(td.qty), 0) as items_sold')
                ->first();

            return $this->formatOrderTypeStats(collect([
                (object) [
                    'order_type' => 'take_away',
                    'orders_count' => (int) ($summary->orders_count ?? 0),
                    'revenue_total' => (int) round($summary->revenue_total ?? 0),
                    'items_sold' => (int) round($summary->items_sold ?? 0),
                ],
            ]));
        }

        $rows = $this->detailMetricsQuery($filters)
            ->selectRaw("COALESCE(t.order_type, 'take_away') as order_type")
            ->selectRaw('COUNT(DISTINCT t.id) as orders_count')
            ->selectRaw('COALESCE(SUM(td.price), 0) as revenue_total')
            ->selectRaw('COALESCE(SUM(td.qty), 0) as items_sold')
            ->groupBy('order_type')
            ->get();

        return $this->formatOrderTypeStats($rows);
    }

    protected function formatOrderTypeStats($rows): array
    {
        $stats = collect([
            'dine_in' => [
                'key' => 'dine_in',
                'label' => 'Dine In',
                'orders_count' => 0,
                'revenue_total' => 0,
                'items_sold' => 0,
                'average_order' => 0,
                'revenue_share' => 0,
                'orders_share' => 0,
            ],
            'take_away' => [
                'key' => 'take_away',
                'label' => 'Take Away',
                'orders_count' => 0,
                'revenue_total' => 0,
                'items_sold' => 0,
                'average_order' => 0,
                'revenue_share' => 0,
                'orders_share' => 0,
            ],
            'other' => [
                'key' => 'other',
                'label' => 'Order Lain',
                'orders_count' => 0,
                'revenue_total' => 0,
                'items_sold' => 0,
                'average_order' => 0,
                'revenue_share' => 0,
                'orders_share' => 0,
            ],
        ]);

        foreach ($rows as $row) {
            $rawKey = (string) ($row->order_type ?? 'take_away');
            $key = in_array($rawKey, ['dine_in', 'take_away'], true) ? $rawKey : 'other';
            $current = $stats->get($key);
            $ordersCount = (int) ($row->orders_count ?? 0);
            $revenueTotal = (int) round($row->revenue_total ?? 0);
            $itemsSold = (int) round($row->items_sold ?? 0);

            $current['orders_count'] += $ordersCount;
            $current['revenue_total'] += $revenueTotal;
            $current['items_sold'] += $itemsSold;

            $stats->put($key, $current);
        }

        $totalOrders = (int) $stats->sum('orders_count');
        $totalRevenue = (int) $stats->sum('revenue_total');

        return [
            'summary' => [
                'total_orders' => $totalOrders,
                'total_revenue' => $totalRevenue,
            ],
            'types' => $stats
                ->map(function (array $row) use ($totalOrders, $totalRevenue) {
                    $row['average_order'] = $row['orders_count'] > 0
                        ? (int) round($row['revenue_total'] / $row['orders_count'])
                        : 0;
                    $row['revenue_share'] = $totalRevenue > 0
                        ? round(($row['revenue_total'] / $totalRevenue) * 100, 2)
                        : 0;
                    $row['orders_share'] = $totalOrders > 0
                        ? round(($row['orders_count'] / $totalOrders) * 100, 2)
                        : 0;

                    return $row;
                })
                ->values()
                ->all(),
        ];
    }

    protected function repeatCustomerMetrics(array $filters): array
    {
        if ($this->isTenantWorkspace($filters)) {
            return $this->tenantRepeatCustomerMetrics($filters);
        }

        $baseTransactionQuery = $this->applyTransactionFilters(Transaction::query(), $filters);
        $rows = $this->applyTransactionFilters(Transaction::query(), $filters)
            ->whereNotNull('transactions.customer_id')
            ->leftJoin('customers', 'customers.id', '=', 'transactions.customer_id')
            ->selectRaw('
                transactions.customer_id,
                customers.name as customer_name,
                customers.is_loyalty_member as is_loyalty_member,
                COUNT(transactions.id) as orders_count,
                COALESCE(SUM(transactions.grand_total), 0) as revenue_total,
                MAX(transactions.created_at) as last_purchase_at
            ')
            ->groupBy(
                'transactions.customer_id',
                'customers.name',
                'customers.is_loyalty_member'
            )
            ->get();

        $metricOutletId = $this->workspaceOutletId($filters);
        $customers = Customer::query()
            ->with(['outletMetrics' => fn ($query) => $query
                ->when($metricOutletId, fn ($metricQuery, $outletId) => $metricQuery->where('outlet_id', $outletId))])
            ->whereIn('id', $rows->pluck('customer_id')->filter()->all())
            ->get()
            ->keyBy('id');

        $rows = $rows->map(function ($row) use ($customers, $metricOutletId) {
            $customer = $customers->get((int) $row->customer_id);

            return [
                'customer_id' => (int) $row->customer_id,
                'customer_name' => $row->customer_name,
                'is_loyalty_member' => (bool) $row->is_loyalty_member,
                'loyalty_tier' => $customer ? $this->loyaltyService->resolvedTier($customer, $metricOutletId) : null,
                'orders_count' => (int) $row->orders_count,
                'revenue_total' => (int) round($row->revenue_total),
                'average_basket' => (int) ($row->orders_count > 0
                    ? round($row->revenue_total / $row->orders_count)
                    : 0),
                'last_purchase_at' => ReportTimezone::formatSourceIso8601($row->last_purchase_at),
            ];
        });

        $activeCustomers = $rows->count();
        $repeatCustomers = $rows->filter(fn (array $row) => $row['orders_count'] > 1)->values();
        $newCustomers = $rows->filter(fn (array $row) => $row['orders_count'] === 1)->values();
        $memberRevenue = $rows->where('is_loyalty_member', true)->sum('revenue_total');
        $nonMemberRevenue = $rows->where('is_loyalty_member', false)->sum('revenue_total');
        $repeatRevenue = $repeatCustomers->sum('revenue_total');
        $walkInCount = (clone $baseTransactionQuery)->whereNull('customer_id')->count();
        $walkInRevenue = (clone $baseTransactionQuery)->whereNull('customer_id')->sum('grand_total');
        $registeredRevenue = (clone $baseTransactionQuery)->whereNotNull('customer_id')->sum('grand_total');

        return [
            'summary' => [
                'active_customers' => $activeCustomers,
                'repeat_customers' => $repeatCustomers->count(),
                'new_customers' => $newCustomers->count(),
                'repeat_rate' => $activeCustomers > 0
                    ? round(($repeatCustomers->count() / $activeCustomers) * 100, 2)
                    : 0,
                'repeat_revenue_total' => (int) $repeatRevenue,
                'member_revenue_total' => (int) $memberRevenue,
                'non_member_revenue_total' => (int) $nonMemberRevenue,
                'walk_in_count' => (int) $walkInCount,
                'walk_in_revenue_total' => (int) $walkInRevenue,
                'registered_revenue_total' => (int) $registeredRevenue,
                'walk_in_revenue_share' => ($walkInRevenue + $registeredRevenue) > 0
                    ? round(($walkInRevenue / ($walkInRevenue + $registeredRevenue)) * 100, 2)
                    : 0,
                'member_revenue_share' => ($memberRevenue + $nonMemberRevenue) > 0
                    ? round(($memberRevenue / ($memberRevenue + $nonMemberRevenue)) * 100, 2)
                    : 0,
            ],
            'top_customers' => $repeatCustomers
                ->sortByDesc(fn (array $row) => [$row['orders_count'], $row['revenue_total']])
                ->take(10)
                ->values()
                ->all(),
        ];
    }

    protected function stockCoverageAnalysis(array $filters): array
    {
        $windowDays = $this->salesWindowDays($filters);

        $salesSubquery = $this->detailMetricsQuery($filters)
            ->selectRaw('
                td.product_id,
                SUM(td.qty) as qty_sold,
                SUM(td.price) as revenue_total,
                MAX(t.created_at) as last_sold_at
            ')
            ->groupBy('td.product_id');

        $rows = Product::query()
            ->leftJoinSub($salesSubquery, 'sales', fn ($join) => $join->on('sales.product_id', '=', 'products.id'))
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->when($filters['category_id'] ?? null, fn ($q, $categoryId) => $q->where('products.category_id', $categoryId))
            ->when($filters['tenant_outlet_id'] ?? null, fn ($q, $tenantOutletId) => $q->where('products.tenant_outlet_id', $tenantOutletId))
            ->where('products.stock', '>', 0)
            ->selectRaw('
                products.id as product_id,
                products.title as product_title,
                products.sku as product_sku,
                categories.name as category_name,
                products.stock as current_stock,
                COALESCE(sales.qty_sold, 0) as qty_sold,
                COALESCE(sales.revenue_total, 0) as revenue_total,
                sales.last_sold_at as last_sold_at
            ')
            ->get()
            ->map(function ($row) use ($windowDays) {
                $qtySold = (int) $row->qty_sold;
                $currentStock = (int) $row->current_stock;
                $averageDailyQty = $windowDays > 0 ? round($qtySold / $windowDays, 2) : 0;
                $coverageDays = $averageDailyQty > 0
                    ? round($currentStock / $averageDailyQty, 1)
                    : null;

                return [
                    'product_id' => (int) $row->product_id,
                    'product_title' => $row->product_title,
                    'product_sku' => $row->product_sku,
                    'category_name' => $row->category_name,
                    'current_stock' => $currentStock,
                    'qty_sold' => $qtySold,
                    'revenue_total' => (int) round($row->revenue_total),
                    'average_daily_qty' => $averageDailyQty,
                    'coverage_days' => $coverageDays,
                    'coverage_status' => $this->coverageStatus($currentStock, $qtySold, $coverageDays),
                    'last_sold_at' => ReportTimezone::formatSourceIso8601($row->last_sold_at),
                ];
            });

        $summaryCounts = [
            'critical' => $rows->where('coverage_status', 'critical')->count(),
            'low' => $rows->where('coverage_status', 'low')->count(),
            'healthy' => $rows->where('coverage_status', 'healthy')->count(),
            'no_movement' => $rows->where('coverage_status', 'no_movement')->count(),
        ];

        $sortedRows = $rows
            ->sort(function (array $a, array $b) {
                $statusPriority = [
                    'critical' => 0,
                    'low' => 1,
                    'healthy' => 2,
                    'no_movement' => 3,
                ];

                $statusComparison = ($statusPriority[$a['coverage_status']] ?? 99)
                    <=> ($statusPriority[$b['coverage_status']] ?? 99);

                if ($statusComparison !== 0) {
                    return $statusComparison;
                }

                return ($a['coverage_days'] ?? INF) <=> ($b['coverage_days'] ?? INF);
            })
            ->take(10)
            ->values();

        return [
            'summary' => [
                'window_days' => $windowDays,
                ...$summaryCounts,
            ],
            'products' => $sortedRows->all(),
        ];
    }

    protected function salesWindowDays(array $filters): int
    {
        if (($filters['start_date'] ?? null) && ($filters['end_date'] ?? null)) {
            $start = Carbon::parse($filters['start_date'], ReportTimezone::timezone());
            $end = Carbon::parse($filters['end_date'], ReportTimezone::timezone());

            return max(1, $start->diffInDays($end) + 1);
        }

        $range = $this->applyTransactionFilters(Transaction::query(), $filters)
            ->selectRaw('MIN(transactions.created_at) as min_date, MAX(transactions.created_at) as max_date')
            ->first();

        if (! $range?->min_date || ! $range?->max_date) {
            return 30;
        }

        return max(
            1,
            ReportTimezone::sourceToDisplayCarbon($range->min_date)->diffInDays(
                ReportTimezone::sourceToDisplayCarbon($range->max_date)
            ) + 1
        );
    }

    protected function coverageStatus(int $currentStock, int $qtySold, ?float $coverageDays): string
    {
        if ($currentStock <= 0) {
            return 'out_of_stock';
        }

        if ($qtySold <= 0 || $coverageDays === null) {
            return 'no_movement';
        }

        if ($coverageDays <= 7) {
            return 'critical';
        }

        if ($coverageDays <= 30) {
            return 'low';
        }

        return 'healthy';
    }

    protected function promoMonitor(array $filters): array
    {
        $workspaceOutletId = $this->workspaceOutletId($filters);
        $rules = PricingRule::query()
            ->with(['product:id,title', 'category:id,name'])
            ->when($workspaceOutletId, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
            ->orderByDesc('priority')
            ->orderBy('name')
            ->get();

        return [
            'summary' => [
                'active' => $rules->filter(fn (PricingRule $rule) => $rule->currentStatusLabel() === 'active')->count(),
                'scheduled' => $rules->filter(fn (PricingRule $rule) => $rule->currentStatusLabel() === 'scheduled')->count(),
                'expired' => $rules->filter(fn (PricingRule $rule) => $rule->currentStatusLabel() === 'expired')->count(),
                'inactive' => $rules->filter(fn (PricingRule $rule) => $rule->currentStatusLabel() === 'inactive')->count(),
                'by_kind' => [
                    PricingRule::KIND_STANDARD_DISCOUNT => $rules->where('kind', PricingRule::KIND_STANDARD_DISCOUNT)->count(),
                    PricingRule::KIND_QTY_BREAK => $rules->where('kind', PricingRule::KIND_QTY_BREAK)->count(),
                    PricingRule::KIND_BUNDLE_PRICE => $rules->where('kind', PricingRule::KIND_BUNDLE_PRICE)->count(),
                    PricingRule::KIND_BUY_X_GET_Y => $rules->where('kind', PricingRule::KIND_BUY_X_GET_Y)->count(),
                ],
            ],
            'active_rules' => $rules
                ->filter(fn (PricingRule $rule) => $rule->currentStatusLabel() === 'active')
                ->take(5)
                ->values()
                ->map(fn (PricingRule $rule) => $this->serializePromoRule($rule))
                ->all(),
            'scheduled_rules' => $rules
                ->filter(fn (PricingRule $rule) => $rule->currentStatusLabel() === 'scheduled')
                ->sortBy(fn (PricingRule $rule) => optional($rule->starts_at)?->timestamp ?? PHP_INT_MAX)
                ->take(5)
                ->values()
                ->map(fn (PricingRule $rule) => $this->serializePromoRule($rule))
                ->all(),
            'recent_audits' => AuditLog::query()
                ->where('module', 'pricing_rules')
                ->when($workspaceOutletId, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
                ->latest('id')
                ->limit(5)
                ->get()
                ->map(fn (AuditLog $log) => [
                    'id' => $log->id,
                    'event' => $log->event,
                    'description' => $log->description,
                    'created_at' => ReportTimezone::formatSourceIso8601($log->getRawOriginal('created_at')),
                ])
                ->all(),
        ];
    }

    protected function loyaltyPerformance(array $filters): array
    {
        $outletId = $this->workspaceOutletId($filters);

        $members = Customer::query()
            ->where('is_loyalty_member', true)
            ->when($outletId, fn ($query, $resolvedOutletId) => $query->whereHas('outletMetrics', fn ($metricQuery) => $metricQuery->where('outlet_id', $resolvedOutletId)))
            ->with(['outletMetrics' => fn ($query) => $query
                ->when($outletId, fn ($metricQuery) => $metricQuery->where('outlet_id', $outletId))])
            ->get();

        $historyQuery = LoyaltyPointHistory::query()
            ->leftJoin('transactions', 'transactions.id', '=', 'loyalty_point_histories.transaction_id');
        if ($outletId) {
            $historyQuery->where('transactions.outlet_id', $outletId);
        }
        $this->applyDateRangeFilter($historyQuery, 'loyalty_point_histories.created_at', $filters);

        $vouchers = CustomerVoucher::query()
            ->when($outletId, fn ($query, $resolvedOutletId) => $query->whereHas('customer.outletMetrics', fn ($metricQuery) => $metricQuery->where('outlet_id', $resolvedOutletId)))
            ->get();

        return [
            'summary' => [
                'total_members' => $members->count(),
                'points_balance_total' => (int) $members->sum('loyalty_points'),
                'points_earned' => (int) (clone $historyQuery)
                    ->where('type', LoyaltyPointHistory::TYPE_EARN)
                    ->sum('loyalty_point_histories.points_delta'),
                'points_redeemed' => (int) abs((int) (clone $historyQuery)
                    ->where('type', LoyaltyPointHistory::TYPE_REDEEM)
                    ->sum('loyalty_point_histories.points_delta')),
                'voucher_discount_total' => (int) (clone $historyQuery)
                    ->where('type', LoyaltyPointHistory::TYPE_VOUCHER)
                    ->sum('loyalty_point_histories.amount_delta'),
                'tier_distribution' => [
                    'regular' => $members->filter(fn (Customer $customer) => $this->loyaltyService->resolvedTier($customer, $outletId) === 'regular')->count(),
                    'silver' => $members->filter(fn (Customer $customer) => $this->loyaltyService->resolvedTier($customer, $outletId) === 'silver')->count(),
                    'gold' => $members->filter(fn (Customer $customer) => $this->loyaltyService->resolvedTier($customer, $outletId) === 'gold')->count(),
                    'platinum' => $members->filter(fn (Customer $customer) => $this->loyaltyService->resolvedTier($customer, $outletId) === 'platinum')->count(),
                ],
                'voucher_summary' => [
                    'active' => $vouchers->filter(fn (CustomerVoucher $voucher) => $voucher->currentStatusLabel() === 'active')->count(),
                    'scheduled' => $vouchers->filter(fn (CustomerVoucher $voucher) => $voucher->currentStatusLabel() === 'scheduled')->count(),
                    'expired' => $vouchers->filter(fn (CustomerVoucher $voucher) => $voucher->currentStatusLabel() === 'expired')->count(),
                    'used' => $vouchers->filter(fn (CustomerVoucher $voucher) => $voucher->currentStatusLabel() === 'used')->count(),
                    'inactive' => $vouchers->filter(fn (CustomerVoucher $voucher) => $voucher->currentStatusLabel() === 'inactive')->count(),
                ],
            ],
            'top_members' => $this->customerOutletMetricService
                ->topMembers($outletId, 5)
                ->map(function ($entry) use ($outletId) {
                    $customer = $entry instanceof Customer ? $entry : $entry->customer;

                    if (! $customer) {
                        return null;
                    }

                    $metrics = $this->customerOutletMetricService->metricsForCustomer($customer, $outletId);

                    return [
                        'id' => $customer->id,
                        'name' => $customer->name,
                        'loyalty_tier' => $this->loyaltyService->resolvedTier($customer, $outletId),
                        'loyalty_points' => (int) $customer->loyalty_points,
                        'loyalty_total_spent' => (int) ($metrics['total_spent'] ?? $customer->loyalty_total_spent),
                        'loyalty_transaction_count' => (int) ($metrics['transaction_count'] ?? $customer->loyalty_transaction_count),
                    ];
                })
                ->filter()
                ->values()
                ->all(),
        ];
    }

    protected function crmOperations(array $filters): array
    {
        $workspaceOutletId = $this->workspaceOutletId($filters);
        $segments = CustomerSegment::query()
            ->withCount(['memberships as scoped_memberships_count' => fn ($query) => $query
                ->when($workspaceOutletId, fn ($membershipQuery, $outletId) => $membershipQuery->where('outlet_id', $outletId))])
            ->when($workspaceOutletId, fn ($query, $outletId) => $query->whereHas('memberships', fn ($membershipQuery) => $membershipQuery->where('outlet_id', $outletId)))
            ->get();

        $campaignsQuery = CustomerCampaign::query()->withCount('logs');
        if ($workspaceOutletId) {
            $campaignsQuery->where('outlet_id', $workspaceOutletId);
        }
        $this->applyDateRangeFilter($campaignsQuery, 'created_at', $filters);
        $campaigns = $campaignsQuery->get();

        $logsQuery = CustomerCampaignLog::query();
        if ($workspaceOutletId) {
            $logsQuery->where('outlet_id', $workspaceOutletId);
        }
        $this->applyDateRangeFilter($logsQuery, 'created_at', $filters);
        $logs = $logsQuery->get();

        return [
            'summary' => [
                'segments_total' => $segments->count(),
                'segments_manual' => $segments->where('type', CustomerSegment::TYPE_MANUAL)->count(),
                'segments_auto' => $segments->where('type', CustomerSegment::TYPE_AUTO)->count(),
                'segments_active' => $segments->where('is_active', true)->count(),
                'memberships_total' => (int) $segments->sum('scoped_memberships_count'),
                'campaigns_total' => $campaigns->count(),
                'campaigns_draft' => $campaigns->where('status', CustomerCampaign::STATUS_DRAFT)->count(),
                'campaigns_ready' => $campaigns->where('status', CustomerCampaign::STATUS_READY)->count(),
                'campaigns_processed' => $campaigns->where('status', CustomerCampaign::STATUS_PROCESSED)->count(),
                'campaigns_cancelled' => $campaigns->where('status', CustomerCampaign::STATUS_CANCELLED)->count(),
                'queue_pending' => $logs->where('status', CustomerCampaignLog::STATUS_PENDING)->count(),
                'queue_ready_to_send' => $logs->where('status', CustomerCampaignLog::STATUS_READY_TO_SEND)->count(),
                'queue_sent' => $logs->where('status', CustomerCampaignLog::STATUS_SENT)->count(),
                'queue_skipped' => $logs->where('status', CustomerCampaignLog::STATUS_SKIPPED)->count(),
            ],
            'recent_campaigns' => CustomerCampaign::query()
                ->withCount('logs')
                ->when($workspaceOutletId, fn ($query, $outletId) => $query->where('outlet_id', $outletId))
                ->latest('id')
                ->limit(5)
                ->get()
                ->map(fn (CustomerCampaign $campaign) => [
                    'id' => $campaign->id,
                    'name' => $campaign->name,
                    'type' => $campaign->type,
                    'status' => $campaign->status,
                    'channel' => $campaign->channel,
                    'logs_count' => (int) $campaign->logs_count,
                    'processed_at' => ReportTimezone::formatSourceIso8601($campaign->getRawOriginal('processed_at')),
                    'created_at' => ReportTimezone::formatSourceIso8601($campaign->getRawOriginal('created_at')),
                ])
                ->all(),
        ];
    }

    protected function applyDateRangeFilter($query, string $column, array $filters): void
    {
        ReportTimezone::applySourceDateRange($query, $column, $filters);
    }

    protected function serializePromoRule(PricingRule $rule): array
    {
        return [
            'id' => $rule->id,
            'name' => $rule->name,
            'kind' => $rule->kind,
            'status_label' => $rule->currentStatusLabel(),
            'priority' => (int) $rule->priority,
            'target_type' => $rule->target_type,
            'customer_scope' => $rule->customer_scope,
            'product_title' => $rule->product?->title,
            'category_name' => $rule->category?->name,
            'starts_at' => ReportTimezone::formatSourceIso8601($rule->getRawOriginal('starts_at')),
            'ends_at' => ReportTimezone::formatSourceIso8601($rule->getRawOriginal('ends_at')),
        ];
    }

    protected function isTenantWorkspace(array $filters): bool
    {
        return filled($filters['tenant_outlet_id'] ?? null) && blank($filters['outlet_id'] ?? null);
    }

    protected function workspaceOutletId(array $filters): ?int
    {
        return filled($filters['outlet_id'] ?? null)
            ? (int) $filters['outlet_id']
            : (filled($filters['tenant_outlet_id'] ?? null) ? (int) $filters['tenant_outlet_id'] : null);
    }

    protected function detailProfitExpression(): string
    {
        return 'SUM((td.price - ROUND((COALESCE(t.discount, 0) * td.price) / NULLIF(tx.subtotal_after_promo, 0))) - (p.buy_price * td.qty))';
    }

    protected function tenantWorkspaceSummary(array $filters): object
    {
        return $this->detailMetricsQuery($filters)
            ->joinSub(
                DB::table('transaction_details')
                    ->selectRaw('transaction_id, SUM(price) as subtotal_after_promo')
                    ->groupBy('transaction_id'),
                'tx',
                fn ($join) => $join->on('tx.transaction_id', '=', 'td.transaction_id')
            )
            ->selectRaw('COUNT(DISTINCT t.id) as orders_count')
            ->selectRaw('COALESCE(SUM(td.price), 0) as revenue_total')
            ->selectRaw('COALESCE(SUM(td.qty), 0) as items_sold')
            ->selectRaw('COALESCE(SUM(td.discount_total), 0) as manual_discount_total')
            ->selectRaw('COALESCE('.$this->detailProfitExpression().', 0) as profit_total')
            ->first();
    }

    protected function tenantSalesByHour(array $filters): array
    {
        $hourExpression = ReportTimezone::sourceToDisplayHourExpression('t.created_at');

        $rows = $this->detailMetricsQuery($filters)
            ->selectRaw("{$hourExpression} as hour_bucket")
            ->selectRaw('COUNT(DISTINCT t.id) as orders_count')
            ->selectRaw('COALESCE(SUM(td.price), 0) as revenue_total')
            ->groupBy(DB::raw($hourExpression))
            ->orderBy(DB::raw($hourExpression))
            ->get()
            ->keyBy(fn ($row) => (int) $row->hour_bucket);

        return collect(range(0, 23))
            ->map(function (int $hour) use ($rows) {
                $row = $rows->get($hour);

                return [
                    'hour' => $hour,
                    'label' => sprintf('%02d:00', $hour),
                    'orders_count' => (int) ($row->orders_count ?? 0),
                    'revenue_total' => (int) round($row->revenue_total ?? 0),
                ];
            })
            ->all();
    }

    protected function tenantSalesByDay(array $filters): array
    {
        return $this->detailMetricsQuery($filters)
            ->selectRaw(ReportTimezone::sourceToDisplayDateExpression('t.created_at').' as sales_date')
            ->selectRaw('COUNT(DISTINCT t.id) as orders_count')
            ->selectRaw('COALESCE(SUM(td.price), 0) as revenue_total')
            ->groupBy('sales_date')
            ->orderBy('sales_date')
            ->get()
            ->map(fn ($row) => [
                'date' => $row->sales_date,
                'label' => Carbon::parse($row->sales_date, ReportTimezone::timezone())->format('d M'),
                'orders_count' => (int) $row->orders_count,
                'revenue_total' => (int) round($row->revenue_total),
            ])
            ->all();
    }

    protected function tenantCashierPerformance(array $filters): array
    {
        return $this->detailMetricsQuery($filters)
            ->joinSub(
                DB::table('transaction_details')
                    ->selectRaw('transaction_id, SUM(price) as subtotal_after_promo')
                    ->groupBy('transaction_id'),
                'tx',
                fn ($join) => $join->on('tx.transaction_id', '=', 'td.transaction_id')
            )
            ->leftJoin('users', 'users.id', '=', 't.cashier_id')
            ->selectRaw('t.cashier_id, users.name as cashier_name')
            ->selectRaw('COUNT(DISTINCT t.id) as orders_count')
            ->selectRaw('COALESCE(SUM(td.qty), 0) as items_sold')
            ->selectRaw('COALESCE(SUM(td.price), 0) as revenue_total')
            ->selectRaw('COUNT(DISTINCT CASE WHEN t.customer_id IS NULL THEN t.id END) as walk_in_orders_count')
            ->selectRaw('COALESCE(SUM(CASE WHEN t.customer_id IS NULL THEN td.price ELSE 0 END), 0) as walk_in_revenue_total')
            ->selectRaw('COALESCE('.$this->detailProfitExpression().', 0) as profit_total')
            ->groupBy('t.cashier_id', 'users.name')
            ->orderByDesc('items_sold')
            ->orderByDesc('revenue_total')
            ->get()
            ->map(fn ($row) => [
                'cashier_id' => (int) $row->cashier_id,
                'cashier_name' => $row->cashier_name,
                'orders_count' => (int) $row->orders_count,
                'walk_in_orders_count' => (int) ($row->walk_in_orders_count ?? 0),
                'registered_orders_count' => max(0, (int) $row->orders_count - (int) ($row->walk_in_orders_count ?? 0)),
                'items_sold' => (int) $row->items_sold,
                'revenue_total' => (int) round($row->revenue_total),
                'walk_in_revenue_total' => (int) round($row->walk_in_revenue_total ?? 0),
                'registered_revenue_total' => max(0, (int) round($row->revenue_total) - (int) round($row->walk_in_revenue_total ?? 0)),
                'profit_total' => (int) round($row->profit_total),
                'average_basket' => (int) ($row->orders_count > 0
                    ? round($row->revenue_total / $row->orders_count)
                    : 0),
                'walk_in_share' => (int) $row->orders_count > 0
                    ? round((((int) ($row->walk_in_orders_count ?? 0)) / (int) $row->orders_count) * 100, 2)
                    : 0,
            ])
            ->all();
    }

    protected function tenantRepeatCustomerMetrics(array $filters): array
    {
        $rows = $this->detailMetricsQuery($filters)
            ->leftJoin('customers', 'customers.id', '=', 't.customer_id')
            ->selectRaw('t.customer_id, customers.name as customer_name, customers.is_loyalty_member as is_loyalty_member')
            ->selectRaw('COUNT(DISTINCT t.id) as orders_count')
            ->selectRaw('COALESCE(SUM(td.price), 0) as revenue_total')
            ->selectRaw('MAX(t.created_at) as last_purchase_at')
            ->whereNotNull('t.customer_id')
            ->groupBy('t.customer_id', 'customers.name', 'customers.is_loyalty_member')
            ->get()
            ->map(fn ($row) => [
                'customer_id' => (int) $row->customer_id,
                'customer_name' => $row->customer_name,
                'is_loyalty_member' => (bool) $row->is_loyalty_member,
                'loyalty_tier' => null,
                'orders_count' => (int) $row->orders_count,
                'revenue_total' => (int) round($row->revenue_total),
                'average_basket' => (int) ($row->orders_count > 0
                    ? round($row->revenue_total / $row->orders_count)
                    : 0),
                'last_purchase_at' => ReportTimezone::formatSourceIso8601($row->last_purchase_at),
            ]);

        $activeCustomers = $rows->count();
        $repeatCustomers = $rows->filter(fn (array $row) => $row['orders_count'] > 1)->values();
        $newCustomers = $rows->filter(fn (array $row) => $row['orders_count'] === 1)->values();
        $memberRevenue = $rows->where('is_loyalty_member', true)->sum('revenue_total');
        $nonMemberRevenue = $rows->where('is_loyalty_member', false)->sum('revenue_total');
        $repeatRevenue = $repeatCustomers->sum('revenue_total');

        $walkInRow = $this->detailMetricsQuery($filters)
            ->whereNull('t.customer_id')
            ->selectRaw('COUNT(DISTINCT t.id) as walk_in_count, COALESCE(SUM(td.price), 0) as walk_in_revenue_total')
            ->first();

        $registeredRevenue = $rows->sum('revenue_total');
        $walkInRevenue = (int) round($walkInRow->walk_in_revenue_total ?? 0);

        return [
            'summary' => [
                'active_customers' => $activeCustomers,
                'repeat_customers' => $repeatCustomers->count(),
                'new_customers' => $newCustomers->count(),
                'repeat_rate' => $activeCustomers > 0
                    ? round(($repeatCustomers->count() / $activeCustomers) * 100, 2)
                    : 0,
                'repeat_revenue_total' => (int) $repeatRevenue,
                'member_revenue_total' => (int) $memberRevenue,
                'non_member_revenue_total' => (int) $nonMemberRevenue,
                'walk_in_count' => (int) ($walkInRow->walk_in_count ?? 0),
                'walk_in_revenue_total' => $walkInRevenue,
                'registered_revenue_total' => (int) $registeredRevenue,
                'walk_in_revenue_share' => ($walkInRevenue + $registeredRevenue) > 0
                    ? round(($walkInRevenue / ($walkInRevenue + $registeredRevenue)) * 100, 2)
                    : 0,
                'member_revenue_share' => ($memberRevenue + $nonMemberRevenue) > 0
                    ? round(($memberRevenue / ($memberRevenue + $nonMemberRevenue)) * 100, 2)
                    : 0,
            ],
            'top_customers' => $repeatCustomers
                ->sortByDesc(fn (array $row) => [$row['orders_count'], $row['revenue_total']])
                ->take(10)
                ->values()
                ->all(),
        ];
    }
}
