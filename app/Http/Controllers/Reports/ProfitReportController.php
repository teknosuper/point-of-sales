<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\CashierSettlementRequest;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Outlet;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use App\Services\OutletResolver;
use App\Support\ReportModifierTotals;
use App\Support\ReportOwnerTenantSplit;
use App\Support\ReportCashSummary;
use App\Support\ReportTargetSummary;
use App\Support\ReportTenantProfitMetrics;
use App\Support\ReportTimezone;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class ProfitReportController extends Controller
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $outletId = $activeOutlet?->id;
        $activeTab = $this->resolveReportTab($request);
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
            return $this->renderTenantProfitReport($filters, $outletId, $activeTab);
        }

        $baseQuery = $this->applyFilters(
            Transaction::query()
                ->with(['cashier:id,name', 'customer:id,name']),
            $filters
        )->orderByDesc('created_at');

        $transactionIds = (clone $baseQuery)->pluck('id');
        $transactionIdQuery = $this->filteredTransactionIdsQuery($filters);
        $summary = $this->buildSummary(
            $baseQuery,
            $transactionIds,
            $outletId,
            $filters,
            $activeTab === 'overview'
        );
        $targets = $this->targetSummary($summary, $outletId, $filters);
        $transactions = $activeTab === 'transactions'
            ? $this->transactionsPaginator($baseQuery, $outletId)
            : null;
        $itemBreakdown = $activeTab === 'products'
            ? $this->itemBreakdownPaginator($filters)
            : null;
        $dailyProfitTrend = in_array($activeTab, ['overview', 'analysis'], true)
            ? $this->dailyProfitTrend($filters, $outletId)
            : collect();
        $cashierSummary = $activeTab === 'analysis'
            ? $this->cashierSummary($filters)
            : [];
        $tenantBreakdown = $activeTab === 'analysis'
            ? $this->tenantBreakdown($transactionIdQuery)
            : collect();
        $ownerMarkupBreakdown = $activeTab === 'analysis'
            ? $this->ownerMarkupBreakdown($transactionIdQuery, $outletId, $activeOutlet?->name)
            : collect();

        return Inertia::render('Dashboard/Reports/Profit', [
            'transactions' => $transactions,
            'itemBreakdown' => $itemBreakdown,
            'summary' => $summary,
            'targets' => $targets,
            'cashierSummary' => $cashierSummary,
            'dailyProfitTrend' => $dailyProfitTrend,
            'tenantBreakdown' => $tenantBreakdown,
            'ownerMarkupBreakdown' => $ownerMarkupBreakdown,
            'filters' => $filters,
            'cashiers' => User::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::select('id', 'name')->orderBy('name')->get(),
            'pricingRuleKinds' => [
                ['id' => 'standard_discount', 'name' => 'Diskon Standar'],
                ['id' => 'qty_break', 'name' => 'Diskon Bertingkat Qty'],
                ['id' => 'bundle_price', 'name' => 'Harga Bundling'],
                ['id' => 'buy_x_get_y', 'name' => 'Beli X Gratis Y'],
            ],
            'tenantOutlets' => $this->accessibleTenantOutlets($request)
                ->when($outletId, fn ($query) => $query->where('outlets.id', '!=', $outletId))
                ->get(['outlets.id', 'outlets.name', 'outlets.code'])
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
            'activeTab' => $activeTab,
            'reportMeta' => [
                'timezone' => ReportTimezone::timezone(),
                'timezone_label' => ReportTimezone::timezoneLabel(),
            ],
        ]);
    }

    protected function renderTenantProfitReport(array $filters, int $tenantOutletId, string $activeTab = 'overview')
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

        $metricAllocations = ReportTenantProfitMetrics::appendMetrics((clone $baseQuery)->get());
        $transactions = $activeTab === 'transactions'
            ? ReportTenantProfitMetrics::appendMetrics(
                (clone $baseQuery)->paginate(10)->withQueryString()
            )->through(fn (TransactionTenantAllocation $allocation) => $this->transformTenantProfitAllocationListRow($allocation))
            : null;

        $summary = ReportTenantProfitMetrics::summary($metricAllocations);
        $expenseSummary = $this->expenseSummary($filters, $tenantOutletId);
        $summary['expense_total'] = (int) $expenseSummary['expense_total'];
        $summary['expense_paid_total'] = (int) $expenseSummary['expense_paid_total'];
        $summary['expense_unpaid_total'] = (int) $expenseSummary['expense_unpaid_total'];
        $summary['profit_after_expense_total'] = (int) $summary['profit_total'] - (int) $summary['expense_total'];
        $summary['tenant_payout_approved_total'] = 0;
        $summary['tenant_payout_paid_total'] = 0;
        $summary['tenant_payout_pending_approval_total'] = 0;
        $summary['tenant_payout_outstanding_total'] = 0;
        $summary['remaining_cash_after_paid_total'] = (int) $summary['revenue_total'] - (int) $summary['expense_paid_total'];
        $summary['remaining_cash_after_approved_total'] = (int) $summary['revenue_total'] - (int) $summary['expense_total'];
        $summary['registered_customer_count'] = max(0, $summary['orders_count'] - $summary['walk_in_count']);

        $targets = $this->targetSummary($summary, $tenantOutletId, $filters);
        $itemBreakdown = $activeTab === 'products'
            ? $this->itemBreakdownPaginator($filters, true)
            : null;
        $tenantOutlet = $metricAllocations->first()?->tenantOutlet;
        $cashierSummary = $activeTab === 'analysis'
            ? ReportTenantProfitMetrics::cashierSummary($metricAllocations)
            : [];
        $dailyProfitTrend = in_array($activeTab, ['overview', 'analysis'], true)
            ? ReportTenantProfitMetrics::dailyTrend($metricAllocations, fn (string $day) => $this->formatTrendDayLabel($day))
            : collect();
        $tenantBreakdown = $activeTab === 'analysis' && $tenantOutlet
            ? collect([[
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
            ]])
            : collect();

        return Inertia::render('Dashboard/Reports/Profit', [
            'transactions' => $transactions,
            'itemBreakdown' => $itemBreakdown,
            'summary' => $summary,
            'targets' => $targets,
            'cashierSummary' => $cashierSummary,
            'dailyProfitTrend' => $dailyProfitTrend,
            'tenantBreakdown' => $tenantBreakdown,
            'ownerMarkupBreakdown' => collect(),
            'filters' => $filters,
            'cashiers' => User::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::select('id', 'name')->orderBy('name')->get(),
            'pricingRuleKinds' => [
                ['id' => 'standard_discount', 'name' => 'Diskon Standar'],
                ['id' => 'qty_break', 'name' => 'Diskon Bertingkat Qty'],
                ['id' => 'bundle_price', 'name' => 'Harga Bundling'],
                ['id' => 'buy_x_get_y', 'name' => 'Beli X Gratis Y'],
            ],
            'tenantOutlets' => $this->accessibleTenantOutlets(request())
                ->where('outlets.id', $tenantOutletId)
                ->get(['outlets.id', 'outlets.name', 'outlets.code'])
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
            'activeTab' => $activeTab,
            'reportMeta' => [
                'timezone' => ReportTimezone::timezone(),
                'timezone_label' => ReportTimezone::timezoneLabel(),
            ],
        ]);
    }

    public function transactionDetail(Request $request, int $recordId)
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $outletId = $activeOutlet?->id;
        $isTenantOutlet = (string) ($activeOutlet?->outlet_type ?? '') === 'tenant';

        if ($isTenantOutlet) {
            $allocation = TransactionTenantAllocation::query()
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
                ->whereKey($recordId)
                ->where('tenant_outlet_id', $outletId)
                ->firstOrFail();

            $detail = ReportTenantProfitMetrics::appendMetrics(collect([$allocation]))->first();

            return response()->json([
                'data' => $this->transformTenantProfitAllocationRow($detail),
            ]);
        }

        $detailColumns = $this->transactionDetailSelectColumns();
        $transactionRelations = [
            'details' => fn ($query) => $query
                ->select($detailColumns)
                ->with(['product:id,title', 'modifiers' => fn ($modifierQuery) => $modifierQuery->select(ReportOwnerTenantSplit::modifierSelectColumns())]),
            'cashier:id,name',
            'customer:id,name',
        ];

        if ($this->hasTable('transaction_tenant_allocations')) {
            $transactionRelations[] = 'tenantAllocations:id,transaction_id,tenant_outlet_id,grand_total';
            $transactionRelations[] = 'tenantAllocations.tenantOutlet:id,name,code';
        }

        $transaction = Transaction::query()
            ->with($transactionRelations)
            ->whereKey($recordId)
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->firstOrFail();

        return response()->json([
            'data' => $this->transformTransactionRow($transaction, $outletId),
        ]);
    }

    protected function transactionsPaginator(Builder $baseQuery, ?int $outletId)
    {
        return (clone $baseQuery)
            ->select('transactions.*')
            ->selectSub($this->transactionDetailAggregateSubquery('qty', 'COALESCE(SUM(qty), 0)'), 'total_items')
            ->selectSub($this->transactionDetailAggregateSubquery('pre_promo_subtotal', $this->prePromoSubtotalExpression()), 'pre_promo_subtotal')
            ->selectSub($this->transactionDetailAggregateSubquery('base_cost_total', $this->baseCostTotalExpression()), 'base_cost_total')
            ->selectSub($this->transactionDetailAggregateSubquery('tenant_discount_total', $this->sumColumnExpression('tenant_discount_total')), 'tenant_discount_total')
            ->selectSub($this->transactionDetailAggregateSubquery('owner_discount_total', $this->sumColumnExpression('owner_discount_total')), 'owner_discount_total')
            ->selectSub($this->transactionDetailAggregateSubquery('tenant_net_total', $this->sumColumnExpression('tenant_net_total')), 'tenant_net_total')
            ->selectSub($this->transactionDetailAggregateSubquery('owner_net_total', $this->sumColumnExpression('owner_net_total')), 'owner_net_total')
            ->selectSub($this->transactionDetailAggregateSubquery('owner_direct_revenue_total', $this->ownerDirectRevenueExpression($outletId)), 'owner_direct_revenue_total')
            ->selectSub($this->transactionDetailAggregateSubquery('owner_direct_markup_total', $this->ownerDirectMarkupExpression($outletId)), 'owner_direct_markup_total')
            ->with(['cashier:id,name', 'customer:id,name'])
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Transaction $transaction) => $this->transformTransactionListAggregateRow($transaction));
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
            'tenant' => $this->accessibleTenantOutlets($request)
                ->when($activeOutlet?->id, fn ($query) => $query->where('outlets.id', '!=', $activeOutlet->id))
                ->when($search !== '', function ($query) use ($search) {
                    $query->where(function ($nested) use ($search) {
                        $nested->where('name', 'like', '%'.$search.'%')
                            ->orWhere('code', 'like', '%'.$search.'%');
                    });
                })
                ->limit(20)
                ->get(['outlets.id', 'outlets.name', 'outlets.code'])
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

    private function accessibleTenantOutlets(Request $request): Builder
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

        $filename = 'laporan-laba-per-item-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'nama_produk',
                'nama_tenant',
                'jumlah_transaksi',
                'qty_terjual',
                'omzet_total',
                'biaya_pokok_total',
                'laba_kotor_total',
                'diskon_tenant_total',
                'diskon_owner_total',
                'pendapatan_bersih_tenant',
                'pendapatan_bersih_owner',
                'jumlah_baris_promo',
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

    protected function buildSummary(
        Builder $baseQuery,
        Collection $transactionIds,
        ?int $outletId,
        array $filters,
        bool $includeBestTransaction = true
    ): array
    {
        $revenueTotal = (clone $baseQuery)->sum('grand_total');
        $ordersCount = (clone $baseQuery)->count();
        $transactionIdQuery = $this->filteredTransactionIdsQuery($filters);
        $itemsSold = (int) TransactionDetail::query()
            ->whereIn('transaction_id', clone $transactionIdQuery)
            ->sum('qty');

        $ownerEconomics = $this->ownerEconomicsTotals($transactionIdQuery);
        $ownerSplitSummary = ReportOwnerTenantSplit::aggregateForTransactionIds($transactionIdQuery);
        $baseCostTotal = $ownerEconomics['basis_total'] > 0
            ? $ownerEconomics['basis_total']
            : $this->sumTransactionDetailBaseCost($transactionIdQuery);
        $markupTotal = $ownerEconomics['profit_total'] > 0
            ? $ownerEconomics['profit_total']
            : max(0, (int) $revenueTotal - (int) $baseCostTotal);

        $tenantSummary = $this->tenantBreakdown($transactionIdQuery);
        $tenantRevenueTotal = (int) $tenantSummary->sum('after_promo_total');
        $tenantProfitTotal = (int) $tenantSummary->sum('profit_total');
        $tenantDiscountTotal = (int) $tenantSummary->sum('discount_total');
        $detailDiscountSplit = $this->transactionDiscountSplit($transactionIdQuery);

        $ownerMarkupSummary = $this->ownerMarkupBreakdown($transactionIdQuery, $outletId, null);
        $ownerDirectRow = $ownerMarkupSummary->firstWhere('kind', 'owner_direct');
        $tenantMarkupRow = $ownerMarkupSummary->firstWhere('kind', 'tenant_markup');
        $bestTransaction = $includeBestTransaction
            ? $this->bestGrossProfitTransaction($baseQuery, $outletId)
            : null;
        $expenseSummary = $this->expenseSummary($filters, $outletId);
        $tenantPayoutSummary = $this->tenantPayoutSummary($filters, $outletId);

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
            'owner_product_markup_total' => (int) ($ownerSplitSummary['owner_product_markup_total'] ?? 0),
            'owner_topping_markup_total' => (int) ($ownerSplitSummary['owner_topping_markup_total'] ?? 0),
            'tenant_revenue_total' => $tenantRevenueTotal,
            'tenant_profit_total' => $tenantProfitTotal,
            'tenant_discount_total' => $tenantDiscountTotal,
            'owner_discount_total' => (int) ($detailDiscountSplit['owner_discount_total'] ?? 0),
            'owner_direct_revenue_total' => (int) ($ownerDirectRow['revenue_total'] ?? 0),
            'owner_direct_markup_total' => (int) ($ownerDirectRow['markup_total'] ?? 0),
            'tenant_markup_total' => (int) ($tenantMarkupRow['markup_total'] ?? 0),
            'expense_total' => (int) $expenseSummary['expense_total'],
            'expense_paid_total' => (int) $expenseSummary['expense_paid_total'],
            'expense_unpaid_total' => (int) $expenseSummary['expense_unpaid_total'],
            'tenant_payout_balance_total' => (int) $tenantPayoutSummary['balance_total'],
            'tenant_payout_approved_total' => (int) $tenantPayoutSummary['approved_total'],
            'tenant_payout_paid_total' => (int) $tenantPayoutSummary['paid_total'],
            'tenant_payout_paid_period_total' => (int) $tenantPayoutSummary['paid_period_total'],
            'tenant_payout_paid_cumulative_total' => (int) $tenantPayoutSummary['paid_cumulative_total'],
            'tenant_payout_pending_approval_total' => (int) $tenantPayoutSummary['pending_approval_total'],
            'tenant_payout_outstanding_total' => (int) $tenantPayoutSummary['outstanding_total'],
            'expense_paid_cumulative_total' => (int) $expenseSummary['expense_paid_cumulative_total'],
        ];
        $summary['profit_after_expense_total'] = (int) $summary['profit_total'] - (int) $summary['expense_total'];
        $summary['remaining_cash_after_paid_total'] = (int) $summary['revenue_total']
            - (int) $summary['tenant_payout_paid_period_total']
            - (int) $summary['expense_paid_total'];
        $summary['remaining_cash_after_paid_cumulative_total'] = (int) $summary['revenue_total']
            - (int) $summary['tenant_payout_paid_cumulative_total']
            - (int) $summary['expense_paid_cumulative_total'];
        $summary['remaining_cash_after_approved_total'] = (int) $summary['revenue_total']
            - (int) $summary['tenant_payout_balance_total']
            - (int) $summary['expense_total'];

        $summary['registered_customer_count'] = max(0, $summary['orders_count'] - $summary['walk_in_count']);

        return $summary;
    }

    protected function filteredTransactionIdsQuery(array $filters): Builder
    {
        return $this->applyFilters(
            Transaction::query()->select('transactions.id'),
            $filters
        );
    }

    protected function expenseSummary(array $filters, ?int $outletId): array
    {
        return ReportCashSummary::expenseSummary($filters, $outletId);
    }

    protected function tenantPayoutSummary(array $filters, ?int $outletId): array
    {
        $balanceFilters = [...$filters, 'start_date' => null];
        $balanceTransactionQuery = $this->applyFilters(
            Transaction::query()->select('transactions.id'),
            $balanceFilters
        );
        return ReportCashSummary::tenantPayoutSummary($filters, $outletId, $balanceTransactionQuery->select('transactions.id'));
    }

    protected function resolveReportTab(Request $request): string
    {
        $tab = (string) $request->input('tab', 'overview');
        $allowedTabs = ['overview', 'products', 'analysis', 'transactions'];

        return in_array($tab, $allowedTabs, true) ? $tab : 'overview';
    }

    protected function targetSummary(array $summary, ?int $outletId, array $filters): array
    {
        return ReportTargetSummary::build($summary, $outletId, $filters);
    }

    protected function cashierSummary(array $filters): array
    {
        $transactionIdQuery = $this->filteredTransactionIdsQuery($filters);
        $transactions = $this->applyFilters(
            Transaction::query()
                ->leftJoin('users as cashiers', 'cashiers.id', '=', 'transactions.cashier_id'),
            $filters
        )
            ->selectRaw('transactions.cashier_id')
            ->selectRaw('MAX(cashiers.name) as cashier_name')
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(CASE WHEN transactions.customer_id IS NULL THEN 1 ELSE 0 END), 0) as walk_in_count')
            ->selectRaw('COALESCE(SUM(transactions.grand_total), 0) as revenue_total')
            ->groupBy('transactions.cashier_id')
            ->get();

        if ($transactions->isEmpty()) {
            return [];
        }

        $baseCostByCashier = $this->baseCostByCashier($transactionIdQuery);
        $ownerProfitByCashier = $this->ownerProfitByCashier($transactionIdQuery);

        return $transactions
            ->map(function ($row) use ($baseCostByCashier, $ownerProfitByCashier) {
                $cashierId = (int) ($row->cashier_id ?? 0);
                $ordersCount = (int) ($row->orders_count ?? 0);
                $walkInCount = (int) ($row->walk_in_count ?? 0);
                $revenueTotal = (int) round($row->revenue_total ?? 0);
                $baseCostTotal = (int) ($baseCostByCashier[$cashierId] ?? 0);
                $profitTotal = array_key_exists($cashierId, $ownerProfitByCashier)
                    ? (int) ($ownerProfitByCashier[$cashierId] ?? 0)
                    : max(0, $revenueTotal - $baseCostTotal);

                return [
                    'cashier_id' => $cashierId,
                    'cashier_name' => $row->cashier_name,
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

    protected function dailyProfitTrend(array $filters, ?int $outletId): Collection
    {
        $transactionIdQuery = $this->filteredTransactionIdsQuery($filters);
        $dailyTransactions = $this->applyFilters(Transaction::query(), $filters)
            ->selectRaw(ReportTimezone::sourceToDisplayDateExpression('created_at').' as day')
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(grand_total), 0) as revenue_total')
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $dailyDetails = $this->aggregateDetailsByDay($transactionIdQuery, $outletId)->keyBy('day');
        $dailyTenant = $this->aggregateTenantAllocationsByDay($transactionIdQuery)->keyBy('day');

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
                $ownerProfitTotal = (int) round($detail->owner_profit_total ?? 0);

                return [
                    'day' => $day,
                    'label' => $this->formatTrendDayLabel($day),
                    'orders_count' => (int) ($tx->orders_count ?? 0),
                    'revenue_total' => $revenueTotal,
                    'profit_total' => $ownerProfitTotal > 0 ? $ownerProfitTotal : max(0, $revenueTotal - $baseCostTotal),
                    'base_cost_total' => $baseCostTotal,
                    'markup_total' => $ownerProfitTotal > 0 ? $ownerProfitTotal : max(0, $revenueTotal - $baseCostTotal),
                    'discount_total' => (int) round($detail->discount_total ?? 0),
                    'owner_direct_revenue_total' => (int) round($detail->owner_direct_revenue_total ?? 0),
                    'owner_direct_markup_total' => (int) round($detail->owner_direct_profit_total ?? max(0, (int) round(($detail->owner_direct_revenue_total ?? 0) - ($detail->owner_direct_base_total ?? 0)))),
                    'tenant_after_promo_total' => (int) round($tenant->after_promo_total ?? 0),
                    'tenant_discount_total' => (int) round($tenant->discount_total ?? 0),
                ];
            })
            ->values();
    }

    protected function tenantBreakdown(Builder $transactionIdQuery): Collection
    {
        if (! Schema::hasColumn('transaction_details', 'tenant_outlet_id')) {
            return collect();
        }

        $hasCustomerBasePrice = Schema::hasColumn('transaction_details', 'customer_base_unit_price');
        $hasTenantNetTotal = Schema::hasColumn('transaction_details', 'tenant_net_total');
        $hasOwnerNetTotal = Schema::hasColumn('transaction_details', 'owner_net_total');
        $hasTenantDiscountTotal = Schema::hasColumn('transaction_details', 'tenant_discount_total');
        $hasOwnerDiscountTotal = Schema::hasColumn('transaction_details', 'owner_discount_total');
        $revenueExpression = ReportModifierTotals::revenueExpression();

        return TransactionDetail::query()
            ->join('outlets as tenant_outlets', 'tenant_outlets.id', '=', 'transaction_details.tenant_outlet_id')
            ->leftJoinSub(
                ReportModifierTotals::subquery(),
                'detail_modifier_totals',
                fn ($join) => $join->on('detail_modifier_totals.transaction_detail_id', '=', 'transaction_details.id')
            )
            ->whereIn('transaction_details.transaction_id', clone $transactionIdQuery)
            ->whereNotNull('transaction_details.tenant_outlet_id')
            ->selectRaw('transaction_details.tenant_outlet_id')
            ->selectRaw('MAX(tenant_outlets.name) as tenant_name')
            ->selectRaw('MAX(tenant_outlets.code) as tenant_code')
            ->selectRaw('COUNT(DISTINCT transaction_details.transaction_id) as orders_count')
            ->selectRaw('COALESCE(SUM(transaction_details.qty), 0) as items_sold')
            ->selectRaw($hasCustomerBasePrice
                ? 'COALESCE(SUM(transaction_details.customer_base_unit_price * transaction_details.qty), 0) as pre_promo_subtotal'
                : "COALESCE(SUM({$revenueExpression}), 0) as pre_promo_subtotal")
            ->selectRaw("COALESCE(SUM({$revenueExpression}), 0) as after_promo_total")
            ->selectRaw($hasTenantNetTotal
                ? 'COALESCE(SUM(transaction_details.tenant_net_total), 0) as cost_total'
                : 'COALESCE(SUM(transaction_details.base_unit_price * transaction_details.qty), 0) as cost_total')
            ->selectRaw($hasOwnerNetTotal
                ? 'COALESCE(SUM(transaction_details.owner_net_total), 0) as profit_total'
                : "COALESCE(SUM({$revenueExpression}), 0) - COALESCE(SUM(transaction_details.base_unit_price * transaction_details.qty), 0) as profit_total")
            ->selectRaw(($hasTenantDiscountTotal || $hasOwnerDiscountTotal)
                ? 'COALESCE(SUM('.($hasTenantDiscountTotal ? 'transaction_details.tenant_discount_total' : '0').' + '.($hasOwnerDiscountTotal ? 'transaction_details.owner_discount_total' : '0').'), 0) as discount_total'
                : '0 as discount_total')
            ->groupBy('transaction_details.tenant_outlet_id')
            ->get()
            ->map(function ($row) {
                $afterPromoTotal = (int) round($row->after_promo_total ?? 0);
                $costTotal = (int) round($row->cost_total ?? 0);
                $profitTotal = (int) round($row->profit_total ?? 0);

                return [
                    'tenant_outlet_id' => (int) $row->tenant_outlet_id,
                    'tenant_outlet' => [
                        'id' => (int) $row->tenant_outlet_id,
                        'name' => $row->tenant_name,
                        'code' => $row->tenant_code,
                    ],
                    'orders_count' => (int) ($row->orders_count ?? 0),
                    'items_sold' => (int) ($row->items_sold ?? 0),
                    'pre_promo_subtotal' => (int) round($row->pre_promo_subtotal ?? 0),
                    'subtotal_total' => $afterPromoTotal,
                    'discount_total' => (int) round($row->discount_total ?? 0),
                    'after_promo_total' => $afterPromoTotal,
                    'cost_total' => $costTotal,
                    'profit_total' => $profitTotal,
                    'margin' => $afterPromoTotal > 0
                        ? round(($profitTotal / $afterPromoTotal) * 100, 2)
                        : 0,
                ];
            })
            ->sortByDesc('profit_total')
            ->values();
    }

    protected function ownerMarkupBreakdown(Builder $transactionIdQuery, ?int $outletId, ?string $ownerOutletName): Collection
    {
        $hasBaseUnitPrice = Schema::hasColumn('transaction_details', 'base_unit_price');
        $hasTenantNetTotal = Schema::hasColumn('transaction_details', 'tenant_net_total');
        $hasOwnerNetTotal = Schema::hasColumn('transaction_details', 'owner_net_total');
        $hasTenantOutletId = Schema::hasColumn('transaction_details', 'tenant_outlet_id');
        $revenueExpression = ReportModifierTotals::revenueExpression();
        $baseExpression = $hasTenantNetTotal
            ? 'COALESCE(transaction_details.tenant_net_total, 0)'
            : ($hasBaseUnitPrice
                ? 'COALESCE(transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)'
                : $revenueExpression);
        $profitExpression = $hasOwnerNetTotal
            ? 'COALESCE(transaction_details.owner_net_total, 0)'
            : "{$revenueExpression} - {$baseExpression}";

        $rows = TransactionDetail::query()
            ->leftJoinSub(
                ReportModifierTotals::subquery(),
                'detail_modifier_totals',
                fn ($join) => $join->on('detail_modifier_totals.transaction_detail_id', '=', 'transaction_details.id')
            )
            ->when(
                $hasTenantOutletId,
                fn ($query) => $query->leftJoin('outlets as tenant_outlets', 'tenant_outlets.id', '=', 'transaction_details.tenant_outlet_id')
            )
            ->whereIn('transaction_id', clone $transactionIdQuery)
            ->selectRaw($hasTenantOutletId ? 'transaction_details.tenant_outlet_id' : 'NULL as tenant_outlet_id')
            ->selectRaw('COUNT(*) as rows_count')
            ->selectRaw('COALESCE(SUM(transaction_details.qty), 0) as items_sold')
            ->selectRaw("COALESCE(SUM({$revenueExpression}), 0) as revenue_total")
            ->selectRaw("COALESCE(SUM({$baseExpression}), 0) as base_cost_total")
            ->selectRaw("COALESCE(SUM({$profitExpression}), 0) as profit_total")
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
                    'markup_total' => (int) round($row->profit_total ?? ($revenueTotal - $baseCostTotal)),
                    'margin' => $revenueTotal > 0
                        ? round((((int) round($row->profit_total ?? ($revenueTotal - $baseCostTotal))) / $revenueTotal) * 100, 2)
                        : 0,
                ];
            })
            ->sortByDesc('markup_total')
            ->values();
    }

    protected function aggregateDetailsByDay(Builder $transactionIdQuery, ?int $outletId): Collection
    {
        $hasBaseUnitPrice = Schema::hasColumn('transaction_details', 'base_unit_price');
        $hasDiscountTotal = Schema::hasColumn('transaction_details', 'discount_total');
        $hasTenantOutletId = Schema::hasColumn('transaction_details', 'tenant_outlet_id');
        $hasTenantNetTotal = Schema::hasColumn('transaction_details', 'tenant_net_total');
        $hasOwnerNetTotal = Schema::hasColumn('transaction_details', 'owner_net_total');
        $revenueExpression = ReportModifierTotals::revenueExpression();
        $baseExpression = $hasBaseUnitPrice
            ? 'COALESCE(transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)'
            : $revenueExpression;
        $basisExpression = $hasTenantNetTotal
            ? 'COALESCE(transaction_details.tenant_net_total, 0)'
            : $baseExpression;
        $discountExpression = $hasDiscountTotal
            ? 'COALESCE(transaction_details.discount_total, 0)'
            : '0';
        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->leftJoinSub(
                ReportModifierTotals::subquery(),
                'detail_modifier_totals',
                fn ($join) => $join->on('detail_modifier_totals.transaction_detail_id', '=', 'transaction_details.id')
            )
            ->whereIn('transaction_details.transaction_id', clone $transactionIdQuery)
            ->selectRaw(ReportTimezone::sourceToDisplayDateExpression('transactions.created_at').' as day')
            ->selectRaw("COALESCE(SUM({$revenueExpression}), 0) as revenue_total")
            ->selectRaw("COALESCE(SUM({$basisExpression}), 0) as base_cost_total")
            ->selectRaw("COALESCE(SUM({$discountExpression}), 0) as discount_total")
            ->selectRaw($hasOwnerNetTotal
                ? 'COALESCE(SUM(transaction_details.owner_net_total), 0) as owner_profit_total'
                : "COALESCE(SUM({$revenueExpression}), 0) - COALESCE(SUM({$basisExpression}), 0) as owner_profit_total")
            ->selectRaw($hasTenantOutletId ? "
                COALESCE(SUM(
                    CASE
                        WHEN transaction_details.tenant_outlet_id IS NULL
                             OR transaction_details.tenant_outlet_id = ".(int) $outletId.'
                        THEN '.$revenueExpression.'
                        ELSE 0
                    END
                ), 0) as owner_direct_revenue_total
            ' : "COALESCE(SUM({$revenueExpression}), 0) as owner_direct_revenue_total")
            ->selectRaw($hasTenantOutletId ? "
                COALESCE(SUM(
                    CASE
                        WHEN transaction_details.tenant_outlet_id IS NULL
                             OR transaction_details.tenant_outlet_id = ".(int) $outletId."
                        THEN {$basisExpression}
                        ELSE 0
                    END
                ), 0) as owner_direct_base_total
            " : "COALESCE(SUM({$basisExpression}), 0) as owner_direct_base_total")
            ->selectRaw($hasOwnerNetTotal ? "
                COALESCE(SUM(
                    CASE
                        WHEN transaction_details.tenant_outlet_id IS NULL
                             OR transaction_details.tenant_outlet_id = ".(int) $outletId."
                        THEN transaction_details.owner_net_total
                        ELSE 0
                    END
                ), 0) as owner_direct_profit_total
            " : "COALESCE(SUM({$revenueExpression}), 0) - COALESCE(SUM({$basisExpression}), 0) as owner_direct_profit_total")
            ->groupBy('day')
            ->orderBy('day')
            ->get();
    }

    protected function aggregateTenantAllocationsByDay(Builder $transactionIdQuery): Collection
    {
        if (! Schema::hasTable('transaction_tenant_allocations')) {
            return collect();
        }
        return TransactionTenantAllocation::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_tenant_allocations.transaction_id')
            ->whereIn('transaction_tenant_allocations.transaction_id', clone $transactionIdQuery)
            ->selectRaw(ReportTimezone::sourceToDisplayDateExpression('transactions.created_at').' as day')
            ->selectRaw('COALESCE(SUM(transaction_tenant_allocations.grand_total), 0) as after_promo_total')
            ->selectRaw('COALESCE(SUM(transaction_tenant_allocations.promo_discount_total + transaction_tenant_allocations.manual_discount_total + transaction_tenant_allocations.loyalty_discount_total + transaction_tenant_allocations.voucher_discount_total), 0) as discount_total')
            ->groupBy('day')
            ->orderBy('day')
            ->get();
    }

    protected function sumTransactionDetailBaseCost(Builder $transactionIdQuery): int
    {
        if (! Schema::hasColumn('transaction_details', 'base_unit_price')) {
            return (int) TransactionDetail::query()
                ->whereIn('transaction_id', clone $transactionIdQuery)
                ->sum('price');
        }

        return (int) TransactionDetail::query()
            ->whereIn('transaction_id', clone $transactionIdQuery)
            ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0) as aggregate')
            ->value('aggregate');
    }

    protected function ownerEconomicsTotals(Builder $transactionIdQuery): array
    {
        if (
            ! Schema::hasColumn('transaction_details', 'tenant_net_total')
            || ! Schema::hasColumn('transaction_details', 'owner_net_total')
        ) {
            return [
                'basis_total' => 0,
                'profit_total' => 0,
            ];
        }

        $row = TransactionDetail::query()
            ->whereIn('transaction_id', clone $transactionIdQuery)
            ->selectRaw('COALESCE(SUM(tenant_net_total), 0) as basis_total')
            ->selectRaw('COALESCE(SUM(owner_net_total), 0) as profit_total')
            ->first();

        return [
            'basis_total' => (int) ($row->basis_total ?? 0),
            'profit_total' => (int) ($row->profit_total ?? 0),
        ];
    }

    protected function transformTransactionRow(Transaction $transaction, ?int $outletId): array
    {
        $hasTenantOutletId = Schema::hasColumn('transaction_details', 'tenant_outlet_id');
        $hasTenantAllocationTable = Schema::hasTable('transaction_tenant_allocations');
        $baseCostTotal = (int) $transaction->details->sum(function (TransactionDetail $detail) {
            $tenantNetTotal = (int) ($detail->tenant_net_total ?? 0);
            if ($tenantNetTotal > 0) {
                return $tenantNetTotal;
            }

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
            ->sum(fn (TransactionDetail $detail) => $this->detailRevenueTotal($detail));
        $ownerDirectBaseTotal = (int) $transaction->details
            ->filter(fn (TransactionDetail $detail) => ! $hasTenantOutletId || ! $detail->tenant_outlet_id || (int) $detail->tenant_outlet_id === (int) $outletId)
            ->sum(fn (TransactionDetail $detail) => ((int) ($detail->tenant_net_total ?? 0)) > 0
                ? (int) $detail->tenant_net_total
                : (((int) ($detail->base_unit_price ?? 0)) > 0
                    ? (int) $detail->base_unit_price * (int) $detail->qty
                    : (int) $detail->price));
        $prePromoSubtotal = (int) $transaction->details->sum(fn (TransactionDetail $detail) => (int) ($detail->customer_base_unit_price ?? $detail->unit_price ?? 0) * (int) $detail->qty);
        $tenantNetTotal = (int) $transaction->details->sum(fn (TransactionDetail $detail) => (int) ($detail->tenant_net_total ?? 0));
        $ownerNetTotal = (int) $transaction->details->sum(fn (TransactionDetail $detail) => (int) ($detail->owner_net_total ?? 0));
        $ownerSplit = ReportOwnerTenantSplit::summarizeDetails($transaction->details);
        $ownerProfitTotal = $ownerNetTotal > 0 ? $ownerNetTotal : max(0, (int) $transaction->grand_total - $baseCostTotal);

        return [
            ...$transaction->toArray(),
            'created_at' => $transaction->created_at
                ? ReportTimezone::formatSourceDateTime($transaction->getRawOriginal('created_at'), 'd M Y H:i')
                : null,
            'total_profit' => $ownerProfitTotal,
            'base_cost_total' => $baseCostTotal,
            'markup_total' => $ownerProfitTotal,
            'pre_promo_subtotal' => $prePromoSubtotal,
            'tenant_revenue_total' => $tenantRevenueTotal,
            'tenant_discount_total' => (int) $transaction->details->sum(fn (TransactionDetail $detail) => (int) ($detail->tenant_discount_total ?? 0)),
            'owner_discount_total' => (int) $transaction->details->sum(fn (TransactionDetail $detail) => (int) ($detail->owner_discount_total ?? 0)),
            'tenant_net_total' => $tenantNetTotal,
            'owner_net_total' => $ownerNetTotal,
            'owner_product_markup_total' => (int) ($ownerSplit['owner_product_markup_total'] ?? 0),
            'owner_topping_markup_total' => (int) ($ownerSplit['owner_topping_markup_total'] ?? 0),
            'owner_direct_revenue_total' => $ownerDirectRevenueTotal,
            'owner_direct_markup_total' => $ownerDirectRevenueTotal - $ownerDirectBaseTotal,
            'detail_items' => $transaction->details
                ->map(function (TransactionDetail $detail) {
                    $ownerSplit = ReportOwnerTenantSplit::detailOwnerSplit($detail);

                    return [
                        'id' => $detail->id,
                        'product_name' => $detail->product?->title ?? 'Produk',
                        'qty' => (int) $detail->qty,
                        'line_total' => $this->detailRevenueTotal($detail),
                        'base_cost_total' => ((int) ($detail->tenant_net_total ?? 0)) > 0
                            ? (int) $detail->tenant_net_total
                            : (((int) ($detail->base_unit_price ?? 0)) > 0
                                ? (int) $detail->base_unit_price * (int) $detail->qty
                                : (int) $detail->price),
                        'pre_promo_total' => (int) ($detail->customer_base_unit_price ?? $detail->unit_price ?? 0) * (int) $detail->qty,
                        'tenant_discount_total' => (int) ($detail->tenant_discount_total ?? 0),
                        'owner_discount_total' => (int) ($detail->owner_discount_total ?? 0),
                        'tenant_net_total' => (int) ($detail->tenant_net_total ?? 0),
                        'owner_net_total' => (int) ($ownerSplit['owner_net_total'] ?? 0),
                        'owner_product_markup_total' => (int) ($ownerSplit['owner_product_markup_total'] ?? 0),
                        'owner_topping_markup_total' => (int) ($ownerSplit['owner_topping_markup_total'] ?? 0),
                        'pricing_rule_name' => $detail->pricing_rule_name,
                        'pricing_rule_kind' => $detail->pricing_rule_kind,
                    ];
                })
                ->values()
                ->all(),
        ];
    }

    protected function transformTransactionListRow(Transaction $transaction, ?int $outletId): array
    {
        $row = $this->transformTransactionRow($transaction, $outletId);
        unset($row['detail_items']);

        return $row;
    }

    protected function transformTransactionListAggregateRow(Transaction $transaction): array
    {
        $ownerNetTotal = (int) ($transaction->owner_net_total ?? 0);
        $baseCostTotal = (int) ($transaction->base_cost_total ?? 0);
        $grandTotal = (int) ($transaction->grand_total ?? 0);

        return [
            ...$transaction->toArray(),
            'created_at' => $transaction->created_at
                ? ReportTimezone::formatSourceDateTime($transaction->getRawOriginal('created_at'), 'd M Y H:i')
                : null,
            'total_profit' => $ownerNetTotal > 0 ? $ownerNetTotal : max(0, $grandTotal - $baseCostTotal),
            'markup_total' => $ownerNetTotal > 0 ? $ownerNetTotal : max(0, $grandTotal - $baseCostTotal),
            'base_cost_total' => $baseCostTotal,
            'pre_promo_subtotal' => (int) ($transaction->pre_promo_subtotal ?? 0),
            'tenant_discount_total' => (int) ($transaction->tenant_discount_total ?? 0),
            'owner_discount_total' => (int) ($transaction->owner_discount_total ?? 0),
            'tenant_net_total' => (int) ($transaction->tenant_net_total ?? 0),
            'owner_net_total' => $ownerNetTotal,
            'owner_direct_revenue_total' => (int) ($transaction->owner_direct_revenue_total ?? 0),
            'owner_direct_markup_total' => (int) ($transaction->owner_direct_markup_total ?? 0),
        ];
    }

    protected function transactionDetailAggregateSubquery(string $alias, string $expression)
    {
        return TransactionDetail::query()
            ->selectRaw($expression)
            ->whereColumn('transaction_details.transaction_id', 'transactions.id');
    }

    protected function prePromoSubtotalExpression(): string
    {
        return Schema::hasColumn('transaction_details', 'customer_base_unit_price')
            ? 'COALESCE(SUM(COALESCE(customer_base_unit_price, unit_price, 0) * COALESCE(qty, 0)), 0)'
            : 'COALESCE(SUM(COALESCE(unit_price, 0) * COALESCE(qty, 0)), 0)';
    }

    protected function baseCostTotalExpression(): string
    {
        if (Schema::hasColumn('transaction_details', 'tenant_net_total')) {
            return 'COALESCE(SUM(COALESCE(tenant_net_total, 0)), 0)';
        }

        if (Schema::hasColumn('transaction_details', 'base_unit_price')) {
            return 'COALESCE(SUM(COALESCE(base_unit_price, 0) * COALESCE(qty, 0)), 0)';
        }

        return 'COALESCE(SUM(COALESCE(price, 0)), 0)';
    }

    protected function sumColumnExpression(string $column): string
    {
        if (! Schema::hasColumn('transaction_details', $column)) {
            return '0';
        }

        return "COALESCE(SUM(COALESCE({$column}, 0)), 0)";
    }

    protected function ownerDirectRevenueExpression(?int $outletId): string
    {
        $revenueExpression = ReportModifierTotals::revenueExpression();

        if (! Schema::hasColumn('transaction_details', 'tenant_outlet_id')) {
            return "COALESCE(SUM({$revenueExpression}), 0)";
        }

        return 'COALESCE(SUM(CASE
            WHEN tenant_outlet_id IS NULL OR tenant_outlet_id = '.(int) $outletId.'
                THEN '.$revenueExpression.'
            ELSE 0
        END), 0)';
    }

    protected function ownerDirectMarkupExpression(?int $outletId): string
    {
        $revenueExpression = ReportModifierTotals::revenueExpression();
        $baseExpression = Schema::hasColumn('transaction_details', 'tenant_net_total')
            ? 'COALESCE(tenant_net_total, 0)'
            : (Schema::hasColumn('transaction_details', 'base_unit_price')
                ? 'COALESCE(base_unit_price, 0) * COALESCE(qty, 0)'
                : $revenueExpression);

        $profitExpression = Schema::hasColumn('transaction_details', 'owner_net_total')
            ? 'COALESCE(owner_net_total, 0)'
            : 'GREATEST(0, '.$revenueExpression.' - '.$baseExpression.')';

        if (! Schema::hasColumn('transaction_details', 'tenant_outlet_id')) {
            return "COALESCE(SUM({$profitExpression}), 0)";
        }

        return 'COALESCE(SUM(CASE
            WHEN tenant_outlet_id IS NULL OR tenant_outlet_id = '.(int) $outletId."
                THEN {$profitExpression}
            ELSE 0
        END), 0)";
    }

    protected function bestGrossProfitTransaction(Builder $baseQuery, ?int $outletId): ?object
    {
        $hasBaseUnitPrice = Schema::hasColumn('transaction_details', 'base_unit_price');
        $hasTenantNetTotal = Schema::hasColumn('transaction_details', 'tenant_net_total');
        $hasOwnerNetTotal = Schema::hasColumn('transaction_details', 'owner_net_total');
        $revenueExpression = ReportModifierTotals::revenueExpression();
        $baseCostExpression = $hasTenantNetTotal
            ? 'CASE
                WHEN COALESCE(transaction_details.tenant_net_total, 0) > 0
                    THEN COALESCE(transaction_details.tenant_net_total, 0)
                WHEN COALESCE(transaction_details.base_unit_price, 0) > 0
                    THEN COALESCE(transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)
                ELSE '.$revenueExpression.'
            END'
            : ($hasBaseUnitPrice
                ? 'CASE
                    WHEN COALESCE(transaction_details.base_unit_price, 0) > 0
                        THEN COALESCE(transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)
                    ELSE '.$revenueExpression.'
                END'
                : $revenueExpression);

        $aggregateQuery = TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->leftJoinSub(
                ReportModifierTotals::subquery(),
                'detail_modifier_totals',
                fn ($join) => $join->on('detail_modifier_totals.transaction_detail_id', '=', 'transaction_details.id')
            )
            ->whereIn('transaction_details.transaction_id', (clone $baseQuery)->select('transactions.id'))
            ->selectRaw('transaction_details.transaction_id')
            ->selectRaw('MAX(transactions.invoice) as invoice')
            ->selectRaw("COALESCE(SUM({$revenueExpression}), 0) as grand_total")
            ->selectRaw("COALESCE(SUM({$baseCostExpression}), 0) as base_cost_total")
            ->selectRaw($hasOwnerNetTotal
                ? 'COALESCE(SUM(transaction_details.owner_net_total), 0) as owner_net_total_sum'
                : '0 as owner_net_total_sum')
            ->groupBy('transaction_details.transaction_id');

        return DB::query()
            ->fromSub($aggregateQuery, 'profit_rows')
            ->selectRaw('invoice')
            ->selectRaw('CASE
                WHEN COALESCE(owner_net_total_sum, 0) > 0
                    THEN COALESCE(owner_net_total_sum, 0)
                ELSE GREATEST(0, COALESCE(grand_total, 0) - COALESCE(base_cost_total, 0))
            END as total_profit')
            ->orderByDesc('total_profit')
            ->limit(1)
            ->first();
    }

    protected function baseCostByCashier(Builder $transactionIdQuery): array
    {
        if (Schema::hasColumn('transaction_details', 'tenant_net_total')) {
            return TransactionDetail::query()
                ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
                ->whereIn('transaction_details.transaction_id', clone $transactionIdQuery)
                ->selectRaw('transactions.cashier_id')
                ->selectRaw('COALESCE(SUM(transaction_details.tenant_net_total), 0) as base_cost_total')
                ->groupBy('transactions.cashier_id')
                ->pluck('base_cost_total', 'transactions.cashier_id')
                ->map(fn ($value) => (int) round($value))
                ->all();
        }

        $hasBaseUnitPrice = Schema::hasColumn('transaction_details', 'base_unit_price');
        $baseExpression = $hasBaseUnitPrice
            ? 'COALESCE(transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)'
            : 'COALESCE(transaction_details.price, 0)';

        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->whereIn('transaction_details.transaction_id', clone $transactionIdQuery)
            ->selectRaw('transactions.cashier_id')
            ->selectRaw("COALESCE(SUM({$baseExpression}), 0) as base_cost_total")
            ->groupBy('transactions.cashier_id')
            ->pluck('base_cost_total', 'transactions.cashier_id')
            ->map(fn ($value) => (int) round($value))
            ->all();
    }

    protected function ownerProfitByCashier(Builder $transactionIdQuery): array
    {
        if (! Schema::hasColumn('transaction_details', 'owner_net_total')) {
            return [];
        }

        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->whereIn('transaction_details.transaction_id', clone $transactionIdQuery)
            ->selectRaw('transactions.cashier_id')
            ->selectRaw('COALESCE(SUM(transaction_details.owner_net_total), 0) as profit_total')
            ->groupBy('transactions.cashier_id')
            ->pluck('profit_total', 'transactions.cashier_id')
            ->map(fn ($value) => (int) round($value))
            ->all();
    }

    protected function applyFilters($query, array $filters)
    {
        $query = $query
            ->when($filters['outlet_id'] ?? null, fn ($q, $outletId) => $q->where('transactions.outlet_id', $outletId))
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->where('transactions.invoice', 'like', '%'.$invoice.'%'))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashier) => $q->where('transactions.cashier_id', $cashier))
            ->when($filters['tenant_outlet_id'] ?? null, function ($q, $tenantOutletId) {
                if (! $this->hasColumn('transaction_details', 'tenant_outlet_id')) {
                    return;
                }

                $q->whereHas('details', fn ($detailQuery) => $detailQuery->where('tenant_outlet_id', $tenantOutletId));
            })
            ->when($filters['customer_id'] ?? null, function ($q, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $q->whereNull('transactions.customer_id'),
                    default => $q->where('transactions.customer_id', $customer),
                };
            });

        return ReportTimezone::applySourceDateRange(
            $query,
            'transactions.created_at',
            $filters
        );
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
            'owner_markup_unit_price',
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

    protected function transactionDiscountSplit(Builder $transactionIdQuery): array
    {
        if (
            ! Schema::hasColumn('transaction_details', 'tenant_discount_total')
            || ! Schema::hasColumn('transaction_details', 'owner_discount_total')
        ) {
            return [
                'tenant_discount_total' => 0,
                'owner_discount_total' => 0,
            ];
        }

        $row = TransactionDetail::query()
            ->whereIn('transaction_id', clone $transactionIdQuery)
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
            'start_date' => now(ReportTimezone::timezone())->subDays(6)->toDateString(),
            'end_date' => now(ReportTimezone::timezone())->toDateString(),
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
        $hasBaseUnitPrice = $this->hasColumn('transaction_details', 'base_unit_price');
        $hasTenantOutletId = $this->hasColumn('transaction_details', 'tenant_outlet_id');
        $hasTenantNetTotal = $this->hasColumn('transaction_details', 'tenant_net_total');
        $hasOwnerNetTotal = $this->hasColumn('transaction_details', 'owner_net_total');
        $modifierRevenueExpression = 'COALESCE(detail_modifier_totals.modifier_total, 0)';
        $revenueExpression = "COALESCE(transaction_details.price, 0) + {$modifierRevenueExpression}";
        $baseExpression = $tenantWorkspace
            ? 'COALESCE(products.tenant_hpp_price, transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)'
            : ($hasTenantNetTotal
                ? 'COALESCE(transaction_details.tenant_net_total, 0)'
                : ($hasBaseUnitPrice
                ? 'COALESCE(transaction_details.base_unit_price, 0) * COALESCE(transaction_details.qty, 0)'
                : 'COALESCE(transaction_details.price, 0)'));
        $profitExpression = $tenantWorkspace
            ? "COALESCE(SUM({$revenueExpression}), 0) - COALESCE(SUM({$baseExpression}), 0)"
            : ($hasOwnerNetTotal
                ? 'COALESCE(SUM(transaction_details.owner_net_total), 0)'
                : "COALESCE(SUM({$revenueExpression}), 0) - COALESCE(SUM({$baseExpression}), 0)");

        return $this->applyItemFilters(
            TransactionDetail::query()
                ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
                ->leftJoin('products', 'products.id', '=', 'transaction_details.product_id')
                ->leftJoinSub(
                    DB::table('transaction_detail_modifiers')
                        ->selectRaw('transaction_detail_id, COALESCE(SUM(total_price), 0) as modifier_total')
                        ->groupBy('transaction_detail_id'),
                    'detail_modifier_totals',
                    fn ($join) => $join->on('detail_modifier_totals.transaction_detail_id', '=', 'transaction_details.id')
                )
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
                ->selectRaw("COALESCE(SUM({$revenueExpression}), 0) as revenue_total")
                ->selectRaw("COALESCE(SUM({$baseExpression}), 0) as base_cost_total")
                ->selectRaw("{$profitExpression} as gross_profit_total")
                ->selectRaw($this->hasColumn('transaction_details', 'tenant_discount_total') ? 'COALESCE(SUM(transaction_details.tenant_discount_total), 0) as tenant_discount_total' : '0 as tenant_discount_total')
                ->selectRaw($this->hasColumn('transaction_details', 'owner_discount_total') ? 'COALESCE(SUM(transaction_details.owner_discount_total), 0) as owner_discount_total' : '0 as owner_discount_total')
                ->selectRaw($this->hasColumn('transaction_details', 'tenant_net_total') ? 'COALESCE(SUM(transaction_details.tenant_net_total), 0) as tenant_net_total' : '0 as tenant_net_total')
                ->selectRaw($this->hasColumn('transaction_details', 'owner_net_total') ? 'COALESCE(SUM(transaction_details.owner_net_total), 0) as owner_net_total' : '0 as owner_net_total')
                ->selectRaw($this->hasColumn('transaction_details', 'pricing_rule_name') ? "COALESCE(SUM(CASE WHEN transaction_details.pricing_rule_name IS NOT NULL AND transaction_details.pricing_rule_name <> '' THEN 1 ELSE 0 END), 0) as promo_lines_count" : '0 as promo_lines_count')
                ->groupBy('transaction_details.product_id'),
            $filters
        );
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

    protected function modifierAwareRevenueExpression(): string
    {
        return ReportModifierTotals::revenueExpression();
    }

    protected function applyItemFilters($query, array $filters)
    {
        $query = $query
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
                if (! $this->hasColumn('transaction_details', 'pricing_rule_kind')) {
                    return;
                }

                $q->where('transaction_details.pricing_rule_kind', $kind);
            });

        return ReportTimezone::applySourceDateRange(
            $query,
            'transactions.created_at',
            $filters
        );
    }

    protected function applyTenantAllocationFilters($query, array $filters)
    {
        $query = $query
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->whereHas('transaction', fn ($tx) => $tx->where('invoice', 'like', '%'.$invoice.'%')))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashierId) => $q->where('cashier_id', $cashierId))
            ->when($filters['tenant_outlet_id'] ?? null, fn ($q, $tenantOutletId) => $q->where('tenant_outlet_id', $tenantOutletId))
            ->when($filters['customer_id'] ?? null, function ($q, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $q->whereHas('transaction', fn ($tx) => $tx->whereNull('customer_id')),
                    default => $q->whereHas('transaction', fn ($tx) => $tx->where('customer_id', $customer)),
                };
            });

        if (! empty($filters['start_date']) || ! empty($filters['end_date'])) {
            $query->whereHas('transaction', fn ($tx) => ReportTimezone::applySourceDateRange($tx, 'created_at', $filters));
        }

        return $query;
    }

    protected function appendTenantProfitMetrics($allocations)
    {
        return ReportTenantProfitMetrics::appendMetrics($allocations);
    }

    protected function transformTenantProfitAllocationRow(TransactionTenantAllocation $allocation): array
    {
        $transaction = $allocation->transaction;

        return [
            'id' => $allocation->id,
            'invoice' => $transaction?->invoice ?? $allocation->allocation_number,
            'created_at' => $transaction?->created_at
                ? ReportTimezone::formatSourceDateTime($transaction->getRawOriginal('created_at'), 'd M Y H:i')
                : null,
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

    protected function transformTenantProfitAllocationListRow(TransactionTenantAllocation $allocation): array
    {
        $row = $this->transformTenantProfitAllocationRow($allocation);
        unset($row['detail_items']);

        return $row;
    }

    protected function tenantCashierSummary(Collection $allocations): array
    {
        return ReportTenantProfitMetrics::cashierSummary($allocations);
    }

    protected function tenantDailyProfitTrend(Collection $allocations): Collection
    {
        return ReportTenantProfitMetrics::dailyTrend($allocations, fn (string $day) => $this->formatTrendDayLabel($day));
    }

    protected function formatTrendDayLabel(string $day): string
    {
        return ReportTimezone::formatSourceDateLabel($day.' 00:00:00', 'd M Y')
            ?? Carbon::parse($day)->format('d M Y');
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table] ??= Schema::hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $key = $table.'.'.$column;

        return $this->schemaColumnCache[$key] ??= Schema::hasColumn($table, $column);
    }
}
