<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Profit;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use App\Services\OutletResolver;
use App\Support\ReportOwnerTenantSplit;
use App\Support\ReportTimezone;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceSalesController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');
        $isKitchenWorkspace = $user?->isKitchenWorkspace() ?? false;
        $isTenantOutlet = (string) ($outlet->outlet_type ?? '') === 'tenant';

        $filters = [
            'q' => trim((string) $request->input('q', '')),
            'start_date' => $request->input('start_date', ''),
            'end_date' => $request->input('end_date', ''),
            'quick_range' => $request->input('quick_range', ''),
            'payment_method' => $request->input('payment_method', ''),
            'payment_status' => $request->input('payment_status', ''),
            'order_type' => $request->input('order_type', ''),
            'cashier_id' => $request->input('cashier_id', ''),
            'per_page' => (int) $request->input('per_page', 15),
        ];

        $this->applyQuickRange($filters);

        $allowedPerPage = [10, 15, 25, 50];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 15;
        }

        if ($isKitchenWorkspace || $isTenantOutlet) {
            return $this->renderKitchenWorkspace(
                $request,
                $user,
                $outlet->id,
                $outlet->name,
                $outlet->code,
                $filters,
                $allowedPerPage,
                $isTenantOutlet ? collect([(int) $outlet->id]) : null
            );
        }

        $baseQuery = $this->applyFilters(
            Transaction::query()
                ->with(['customer:id,name', 'cashier:id,name'])
                ->where('outlet_id', $outlet->id),
            $filters
        );

        $filteredTransactionIds = (clone $baseQuery)->pluck('id');
        $baseTotalsByTransaction = $this->baseTotalsByTransactionIds($filteredTransactionIds);
        $ownerMarkupTotalsByTransaction = $this->ownerMarkupTotalsByTransactionIds($filteredTransactionIds);
        $filteredGrossTotal = (int) ((clone $baseQuery)->sum('grand_total') ?? 0);
        $filteredBaseTotal = $this->sumBaseValueForTransactionIds($filteredTransactionIds);
        $ownerSplitSummary = ReportOwnerTenantSplit::aggregateForTransactionIds(
            Transaction::query()
                ->whereIn('id', $filteredTransactionIds)
                ->select('id')
        );
        $filteredMarkupTotal = (int) ($ownerSplitSummary['owner_net_total'] ?? 0);
        $filteredPromoTotal = $this->sumPromoDiscountsForTransactionIds($filteredTransactionIds);
        $filteredPreDiscountTotal = max(0, $filteredGrossTotal + $filteredPromoTotal);

        $transactions = (clone $baseQuery)
            ->latest('created_at')
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(function (Transaction $transaction) use ($baseTotalsByTransaction, $ownerMarkupTotalsByTransaction, $isKitchenWorkspace) {
                $baseTotal = (int) ($baseTotalsByTransaction[$transaction->id] ?? 0);
                $ownerMarkupTotal = (int) ($ownerMarkupTotalsByTransaction[$transaction->id] ?? 0);
                $grossTotal = (int) $transaction->grand_total;
                $promoTotal = (int) ($transaction->details()->sum('discount_total') ?? 0)
                    + (int) ($transaction->discount ?? 0)
                    + (int) ($transaction->loyalty_discount_total ?? 0)
                    + (int) ($transaction->customer_voucher_discount ?? 0);
                $preDiscountTotal = max(0, $grossTotal + $promoTotal);

                return [
                    'id' => $transaction->id,
                    'invoice' => $transaction->invoice,
                    'customer_name' => $transaction->customer?->name ?? 'Pelanggan umum',
                    'cashier_name' => $transaction->cashier?->name ?? '-',
                    'order_type' => $transaction->order_type,
                    'order_type_label' => $this->humanizeOrderType($transaction->order_type),
                    'payment_method' => $transaction->payment_method,
                    'payment_method_label' => $this->humanizePaymentMethod($transaction->payment_method),
                    'payment_status' => $transaction->payment_status,
                    'payment_status_label' => $this->humanizePaymentStatus($transaction->payment_status),
                    'grand_total' => $grossTotal,
                    'base_total' => $baseTotal,
                    'promo_total' => $promoTotal,
                    'pre_discount_total' => $preDiscountTotal,
                    'markup_total' => $ownerMarkupTotal,
                    'display_total' => $isKitchenWorkspace ? $baseTotal : $grossTotal,
                    'created_at' => ReportTimezone::formatSourceIso8601($transaction->getRawOriginal('created_at')),
                ];
            });

        $filteredSummary = (clone $baseQuery)
            ->selectRaw('COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as sales_total')
            ->first();

        $filteredProfitTotal = $filteredTransactionIds->isNotEmpty()
            ? Profit::query()->whereIn('transaction_id', $filteredTransactionIds)->sum('total')
            : 0;

        // Today/Yesterday/Month using source timezone
        $todayStart = ReportTimezone::localDateStartInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());
        $todayEnd = ReportTimezone::localDateEndInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());
        $todayTransactions = Transaction::query()
            ->where('outlet_id', $outlet->id)
            ->where('created_at', '>=', $todayStart)
            ->where('created_at', '<=', $todayEnd);
        $todaySales = (int) ((clone $todayTransactions)->sum('grand_total') ?? 0);
        $todayBaseTotal = $this->sumBaseValueFromTransactionQuery(clone $todayTransactions);
        $todayPromoTotal = $this->sumPromoDiscountsFromTransactionQuery(clone $todayTransactions);
        $todayOrders = (clone $todayTransactions)->count();

        $yesterdayDate = Carbon::now(ReportTimezone::displayTimezone())->subDay()->toDateString();
        $yesterdayStart = ReportTimezone::localDateStartInSourceTz($yesterdayDate);
        $yesterdayEnd = ReportTimezone::localDateEndInSourceTz($yesterdayDate);
        $yesterdayTransactions = Transaction::query()
            ->where('outlet_id', $outlet->id)
            ->where('created_at', '>=', $yesterdayStart)
            ->where('created_at', '<=', $yesterdayEnd);
        $yesterdaySales = (int) ((clone $yesterdayTransactions)->sum('grand_total') ?? 0);
        $yesterdayBaseTotal = $this->sumBaseValueFromTransactionQuery(clone $yesterdayTransactions);
        $yesterdayPromoTotal = $this->sumPromoDiscountsFromTransactionQuery(clone $yesterdayTransactions);
        $yesterdayOrders = (clone $yesterdayTransactions)->count();

        $monthStart = Carbon::now(ReportTimezone::displayTimezone())->startOfMonth()->setTimezone(ReportTimezone::sourceTimezone());
        $monthEnd = Carbon::now(ReportTimezone::displayTimezone())->endOfMonth()->setTimezone(ReportTimezone::sourceTimezone());
        $monthTransactions = Transaction::query()
            ->where('outlet_id', $outlet->id)
            ->where('created_at', '>=', $monthStart)
            ->where('created_at', '<=', $monthEnd);
        $monthSales = (int) ((clone $monthTransactions)->sum('grand_total') ?? 0);
        $monthBaseTotal = $this->sumBaseValueFromTransactionQuery(clone $monthTransactions);
        $monthPromoTotal = $this->sumPromoDiscountsFromTransactionQuery(clone $monthTransactions);
        $monthOrders = (clone $monthTransactions)->count();

        $trend = $isKitchenWorkspace
            ? $this->buildBaseTrend($filteredTransactionIds)
            : $this->buildGrossTrend($outlet->id, $filters);

        $hourlyTrend = $isKitchenWorkspace
            ? $this->buildBaseHourlyTrend($outlet->id)
            : $this->buildGrossHourlyTrend($outlet->id);

        $paymentBreakdown = $isKitchenWorkspace
            ? $this->buildBasePaymentBreakdown($filteredTransactionIds)
            : $this->buildGrossPaymentBreakdown($outlet->id, $filters);

        $topProducts = $isKitchenWorkspace
            ? $this->buildBaseTopProducts($filteredTransactionIds)
            : $this->buildGrossTopProducts($filteredTransactionIds);
        $tenantPromoBreakdown = $isKitchenWorkspace
            ? collect()
            : $this->buildAdminTenantPromoBreakdown($outlet->id, $filteredTransactionIds);
        $promoTrend = $isKitchenWorkspace
            ? collect()
            : $this->buildAdminTenantPromoTrend($outlet->id, $filteredTransactionIds);

        $cashiers = Transaction::query()
            ->where('outlet_id', $outlet->id)
            ->with('cashier:id,name')
            ->whereNotNull('cashier_id')
            ->get()
            ->pluck('cashier')
            ->filter()
            ->unique('id')
            ->sortBy('name')
            ->values()
            ->map(fn ($cashier) => [
                'id' => $cashier->id,
                'name' => $cashier->name,
            ]);

        $recipientUserId = Setting::getInt('cashier_base_settlement_recipient_user_id', 0, $outlet->id);
        $recipientUser = $recipientUserId > 0
            ? User::query()->select('id', 'name')->find($recipientUserId)
            : null;

        return Inertia::render('Dashboard/WorkspaceSales/Index', [
            'filters' => $filters,
            'transactions' => $transactions,
            'summary' => [
                'today_total' => $isKitchenWorkspace ? $todayBaseTotal : $todaySales,
                'today_sales' => (int) $todaySales,
                'today_base_total' => $todayBaseTotal,
                'today_promo_total' => $todayPromoTotal,
                'today_pre_discount_total' => max(0, $todaySales + $todayPromoTotal),
                'today_markup_total' => max(0, $todaySales - $todayBaseTotal),
                'today_orders' => (int) $todayOrders,
                'yesterday_total' => $isKitchenWorkspace ? $yesterdayBaseTotal : $yesterdaySales,
                'yesterday_sales' => (int) $yesterdaySales,
                'yesterday_base_total' => $yesterdayBaseTotal,
                'yesterday_promo_total' => $yesterdayPromoTotal,
                'yesterday_pre_discount_total' => max(0, $yesterdaySales + $yesterdayPromoTotal),
                'yesterday_markup_total' => max(0, $yesterdaySales - $yesterdayBaseTotal),
                'yesterday_orders' => (int) $yesterdayOrders,
                'month_total' => $isKitchenWorkspace ? $monthBaseTotal : $monthSales,
                'month_sales' => (int) $monthSales,
                'month_base_total' => $monthBaseTotal,
                'month_promo_total' => $monthPromoTotal,
                'month_pre_discount_total' => max(0, $monthSales + $monthPromoTotal),
                'month_markup_total' => max(0, $monthSales - $monthBaseTotal),
                'month_orders' => (int) $monthOrders,
                'filtered_total' => $isKitchenWorkspace ? $filteredBaseTotal : $filteredGrossTotal,
                'filtered_sales_total' => (int) ($filteredSummary->sales_total ?? 0),
                'filtered_base_total' => $filteredBaseTotal,
                'filtered_promo_total' => $filteredPromoTotal,
                'filtered_pre_discount_total' => $filteredPreDiscountTotal,
                'filtered_markup_total' => $filteredMarkupTotal,
                'filtered_orders_count' => (int) ($filteredSummary->orders_count ?? 0),
                'filtered_profit_total' => (int) $filteredProfitTotal,
            ],
            'trend' => $trend,
            'hourlyTrend' => $hourlyTrend,
            'paymentBreakdown' => $paymentBreakdown,
            'topProducts' => $topProducts,
            'tenantPromoBreakdown' => $tenantPromoBreakdown,
            'promoTrend' => $promoTrend,
            'cashiers' => $cashiers,
            'meta' => [
                'per_page_options' => $allowedPerPage,
                'metric_mode' => $isKitchenWorkspace ? 'base_cost' : 'sales',
                'settlement_recipient' => $recipientUser ? [
                    'id' => $recipientUser->id,
                    'name' => $recipientUser->name,
                ] : null,
                'outlet' => [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                    'code' => $outlet->code,
                ],
            ],
        ]);
    }

    public function dailyBreakdown(Request $request): Response
    {
        [, $outlet, $filters, $tenantOutletIds, $allocationQuery] = $this->resolveKitchenWorkspaceContext($request);
        $rows = $this->buildKitchenDailyBreakdownRows($allocationQuery, $filters);

        return Inertia::render('Dashboard/WorkspaceSales/DailyBreakdown', [
            'rows' => $rows,
            'filters' => $filters,
            'summary' => [
                'days_count' => (int) $rows->count(),
                'sales_total' => (int) $rows->sum('sales_total'),
                'orders_count' => (int) $rows->sum('orders_count'),
            ],
            'meta' => [
                'outlet' => [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                    'code' => $outlet->code,
                ],
                'tenant_outlet_ids' => $tenantOutletIds->values()->all(),
            ],
        ]);
    }

    public function exportDailyBreakdown(Request $request)
    {
        [, , $filters, , $allocationQuery] = $this->resolveKitchenWorkspaceContext($request);
        $rows = $this->buildKitchenDailyBreakdownRows($allocationQuery, $filters);
        $filename = 'tenant-daily-breakdown-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['date', 'orders_count', 'cash_count', 'non_cash_count', 'average_order', 'sales_total']);
            foreach ($rows as $row) {
                fputcsv($handle, [$row['date'], $row['orders_count'], $row['cash_count'], $row['non_cash_count'], $row['average_order'], $row['sales_total']]);
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function hourlyBreakdown(Request $request): Response
    {
        [, $outlet, $filters, $tenantOutletIds, $allocationQuery] = $this->resolveKitchenWorkspaceContext($request);
        $rows = $this->buildKitchenHourlyBreakdownRows($allocationQuery, $filters);

        return Inertia::render('Dashboard/WorkspaceSales/HourlyBreakdown', [
            'rows' => $rows,
            'filters' => $filters,
            'summary' => [
                'sales_total' => (int) $rows->sum('sales_total'),
                'orders_count' => (int) $rows->sum('orders_count'),
                'peak_hour' => $rows->sortByDesc('sales_total')->first(),
            ],
            'meta' => [
                'outlet' => [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                    'code' => $outlet->code,
                ],
                'tenant_outlet_ids' => $tenantOutletIds->values()->all(),
            ],
        ]);
    }

    public function exportHourlyBreakdown(Request $request)
    {
        [, , $filters, , $allocationQuery] = $this->resolveKitchenWorkspaceContext($request);
        $rows = $this->buildKitchenHourlyBreakdownRows($allocationQuery, $filters);
        $filename = 'tenant-hourly-breakdown-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['hour_of_day', 'label', 'orders_count', 'cash_count', 'non_cash_count', 'average_order', 'sales_total']);
            foreach ($rows as $row) {
                fputcsv($handle, [$row['hour_of_day'], $row['label'], $row['orders_count'], $row['cash_count'], $row['non_cash_count'], $row['average_order'], $row['sales_total']]);
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function productBreakdown(Request $request): Response
    {
        [$user, $outlet, $filters, $tenantOutletIds, $allocationQuery] = $this->resolveKitchenWorkspaceContext($request);

        $filteredAllocationIds = (clone $this->applyKitchenAllocationFilters($allocationQuery, $filters))->pluck('id');
        $productPerformance = $this->buildTenantProductPerformance($user, $outlet->id, $tenantOutletIds, $filteredAllocationIds);
        $rows = collect()
            ->concat($productPerformance['best_sellers'] ?? collect())
            ->concat($productPerformance['slow_movers'] ?? collect())
            ->concat($productPerformance['unsold_products'] ?? collect())
            ->concat($productPerformance['revenue_mix'] ?? collect())
            ->unique('product_id')
            ->map(function (array $row) {
                $status = match (true) {
                    (int) ($row['sold_qty'] ?? 0) === 0 => 'Tidak laku',
                    (int) ($row['sold_qty'] ?? 0) <= 2 => 'Kurang laku',
                    default => 'Laku',
                };

                return [
                    ...$row,
                    'status_label' => $status,
                ];
            })
            ->sortBy([
                ['sold_qty', 'desc'],
                ['sold_value', 'desc'],
                ['product_title', 'asc'],
            ])
            ->values();

        return Inertia::render('Dashboard/WorkspaceSales/ProductBreakdown', [
            'rows' => $rows,
            'productPerformance' => $productPerformance,
            'filters' => $filters,
            'meta' => [
                'outlet' => [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                    'code' => $outlet->code,
                ],
                'tenant_outlet_ids' => $tenantOutletIds->values()->all(),
            ],
        ]);
    }

    public function exportProductBreakdown(Request $request)
    {
        [$user, $outlet, $filters, $tenantOutletIds, $allocationQuery] = $this->resolveKitchenWorkspaceContext($request);
        $filteredAllocationIds = (clone $this->applyKitchenAllocationFilters($allocationQuery, $filters))->pluck('id');
        $productPerformance = $this->buildTenantProductPerformance($user, $outlet->id, $tenantOutletIds, $filteredAllocationIds);
        $rows = collect()
            ->concat($productPerformance['best_sellers'] ?? collect())
            ->concat($productPerformance['slow_movers'] ?? collect())
            ->concat($productPerformance['unsold_products'] ?? collect())
            ->concat($productPerformance['revenue_mix'] ?? collect())
            ->unique('product_id')
            ->values();
        $filename = 'tenant-product-breakdown-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['product_id', 'product_title', 'sold_qty', 'sold_value', 'share_percentage']);
            foreach ($rows as $row) {
                fputcsv($handle, [$row['product_id'], $row['product_title'], $row['sold_qty'] ?? 0, $row['sold_value'] ?? 0, $row['share_percentage'] ?? 0]);
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function renderKitchenWorkspace(
        Request $request,
        User $user,
        int $outletId,
        string $outletName,
        ?string $outletCode,
        array $filters,
        array $allowedPerPage,
        ?Collection $forcedTenantOutletIds = null
    ): Response {
        $tenantOutletIds = $forcedTenantOutletIds ?: $this->resolveKitchenTenantOutletIds($user, $outletId);
        $allocationOutletId = $forcedTenantOutletIds ? 0 : $outletId;

        $allocationBaseQuery = $this->applyKitchenAllocationFilters(
            TransactionTenantAllocation::query()
                ->with(['transaction.customer:id,name', 'transaction.cashier:id,name'])
                ->when($allocationOutletId > 0, fn (Builder $query) => $query->where('outlet_id', $allocationOutletId))
                ->where('waiter_status', 'delivered')
                ->whereNotNull('delivered_at')
                ->when(
                    $tenantOutletIds->isNotEmpty(),
                    fn (Builder $query) => $query->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                    fn (Builder $query) => $query->whereRaw('1 = 0')
                ),
            $filters
        );

        $filteredAllocationIds = (clone $allocationBaseQuery)->pluck('id');
        $filteredBaseTotals = $this->baseTotalsByAllocationIds($filteredAllocationIds);
        $filteredTenantSalesTotal = (int) ((clone $allocationBaseQuery)->sum('subtotal') ?? 0);
        $filteredBaseTotal = $this->sumBaseValueForAllocationIds($filteredAllocationIds);

        $transactions = (clone $allocationBaseQuery)
            ->latest('delivered_at')
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(function (TransactionTenantAllocation $allocation) use ($filteredBaseTotals) {
                $baseTotal = (int) ($filteredBaseTotals[$allocation->id] ?? 0);
                $tenantSaleTotal = (int) ($allocation->subtotal ?? 0);
                $transaction = $allocation->transaction;

                return [
                    'id' => $allocation->id,
                    'invoice' => $transaction?->invoice ?? $allocation->allocation_number,
                    'customer_name' => $transaction?->customer?->name ?? 'Pelanggan umum',
                    'cashier_name' => $transaction?->cashier?->name ?? '-',
                    'order_type' => $transaction?->order_type,
                    'order_type_label' => $this->humanizeOrderType($transaction?->order_type),
                    'payment_method' => $transaction?->payment_method,
                    'payment_method_label' => $this->humanizePaymentMethod($transaction?->payment_method),
                    'payment_status' => $transaction?->payment_status ?? $allocation->payment_status,
                    'payment_status_label' => $this->humanizePaymentStatus($transaction?->payment_status ?? $allocation->payment_status),
                    'tenant_sale_total' => $tenantSaleTotal,
                    'base_total' => $baseTotal,
                    'service_status' => $allocation->waiter_status,
                    'service_status_label' => $this->humanizeServiceStatus($allocation->waiter_status),
                    'settlement_reference_total' => $tenantSaleTotal,
                    'created_at' => ReportTimezone::formatSourceIso8601($transaction?->getRawOriginal('created_at')),
                    'delivered_at' => ReportTimezone::formatSourceIso8601($allocation->getRawOriginal('delivered_at')),
                ];
            });

        $todayAllocations = TransactionTenantAllocation::query()
            ->when($allocationOutletId > 0, fn (Builder $query) => $query->where('outlet_id', $allocationOutletId))
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            )
            ->where('delivered_at', '>=', ReportTimezone::localDateStartInSourceTz(now(ReportTimezone::displayTimezone())->toDateString()))
            ->where('delivered_at', '<=', ReportTimezone::localDateEndInSourceTz(now(ReportTimezone::displayTimezone())->toDateString()));
        $todayTenantSales = (int) ((clone $todayAllocations)->sum('subtotal') ?? 0);
        $todayBaseTotal = $this->sumBaseValueFromAllocationQuery(clone $todayAllocations);
        $todayOrders = (clone $todayAllocations)->count();
        $todayCashCount = (clone $todayAllocations)->whereHas('transaction', fn (Builder $query) => $query->where('payment_method', 'cash'))->count();
        $todayNonCashCount = max(0, $todayOrders - $todayCashCount);

        $yesterdayAllocations = TransactionTenantAllocation::query()
            ->when($allocationOutletId > 0, fn (Builder $query) => $query->where('outlet_id', $allocationOutletId))
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            )
            ->where('delivered_at', '>=', ReportTimezone::localDateStartInSourceTz(now(ReportTimezone::displayTimezone())->subDay()->toDateString()))
            ->where('delivered_at', '<=', ReportTimezone::localDateEndInSourceTz(now(ReportTimezone::displayTimezone())->subDay()->toDateString()));
        $yesterdayTenantSales = (int) ((clone $yesterdayAllocations)->sum('subtotal') ?? 0);
        $yesterdayBaseTotal = $this->sumBaseValueFromAllocationQuery(clone $yesterdayAllocations);
        $yesterdayOrders = (clone $yesterdayAllocations)->count();

        $monthAllocations = TransactionTenantAllocation::query()
            ->when($allocationOutletId > 0, fn (Builder $query) => $query->where('outlet_id', $allocationOutletId))
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            )
            ->whereMonth('delivered_at', Carbon::now()->month)
            ->whereYear('delivered_at', Carbon::now()->year);
        $monthTenantSales = (int) ((clone $monthAllocations)->sum('subtotal') ?? 0);
        $monthBaseTotal = $this->sumBaseValueFromAllocationQuery(clone $monthAllocations);
        $monthOrders = (clone $monthAllocations)->count();

        $paymentBreakdown = $this->buildTenantPaymentBreakdown($allocationOutletId, $tenantOutletIds, $filters);
        $topProducts = $this->buildTenantTopProducts($filteredAllocationIds);
        $trend = $this->buildTenantTrend($allocationOutletId, $tenantOutletIds, $filters);
        $hourlyTrend = $this->buildTenantHourlyTrend($allocationOutletId, $tenantOutletIds);
        $productPerformance = $this->buildTenantProductPerformance($user, $outletId, $tenantOutletIds, $filteredAllocationIds);

        $cashiers = TransactionTenantAllocation::query()
            ->when($allocationOutletId > 0, fn (Builder $query) => $query->where('outlet_id', $allocationOutletId))
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            )
            ->with('transaction.cashier:id,name')
            ->get()
            ->pluck('transaction.cashier')
            ->filter()
            ->unique('id')
            ->sortBy('name')
            ->values()
            ->map(fn ($cashier) => [
                'id' => $cashier->id,
                'name' => $cashier->name,
            ]);

        $recipientUserId = Setting::getInt('cashier_base_settlement_recipient_user_id', 0, $outletId);
        $recipientUser = $recipientUserId > 0
            ? User::query()->select('id', 'name')->find($recipientUserId)
            : null;

        return Inertia::render('Dashboard/WorkspaceSales/Index', [
            'filters' => $filters,
            'transactions' => $transactions,
            'summary' => [
                'today_total' => $todayTenantSales,
                'today_base_total' => $todayBaseTotal,
                'today_orders' => (int) $todayOrders,
                'today_cash_count' => (int) $todayCashCount,
                'today_non_cash_count' => (int) $todayNonCashCount,
                'yesterday_total' => $yesterdayTenantSales,
                'yesterday_base_total' => $yesterdayBaseTotal,
                'yesterday_orders' => (int) $yesterdayOrders,
                'month_total' => $monthTenantSales,
                'month_base_total' => $monthBaseTotal,
                'month_orders' => (int) $monthOrders,
                'filtered_total' => $filteredTenantSalesTotal,
                'filtered_base_total' => $filteredBaseTotal,
                'filtered_orders_count' => (int) $filteredAllocationIds->count(),
                'average_order_value' => $filteredAllocationIds->count() > 0
                    ? (int) round($filteredTenantSalesTotal / max(1, (int) $filteredAllocationIds->count()))
                    : 0,
            ],
            'trend' => $trend,
            'hourlyTrend' => $hourlyTrend,
            'paymentBreakdown' => $paymentBreakdown,
            'topProducts' => $topProducts,
            'productPerformance' => $productPerformance,
            'cashiers' => $cashiers,
            'meta' => [
                'per_page_options' => $allowedPerPage,
                'metric_mode' => 'tenant_sales',
                'settlement_recipient' => $recipientUser ? [
                    'id' => $recipientUser->id,
                    'name' => $recipientUser->name,
                ] : null,
                'outlet' => [
                    'id' => $outletId,
                    'name' => $outletName,
                    'code' => $outletCode,
                ],
                'tenant_outlet_ids' => $tenantOutletIds->values()->all(),
                'detail_routes' => [
                    'daily' => route('workspace-sales.daily-breakdown', $filters),
                    'hourly' => route('workspace-sales.hourly-breakdown', $filters),
                    'products' => route('workspace-sales.product-breakdown', $filters),
                ],
            ],
        ]);
    }

    private function resolveKitchenWorkspaceContext(Request $request): array
    {
        $user = $request->user();
        $outlet = $this->outletResolver->resolve($request, $user);
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');
        $isTenantOutlet = (string) ($outlet->outlet_type ?? '') === 'tenant';
        abort_unless($user?->isKitchenWorkspace() || $isTenantOutlet, 403, 'Halaman detail ini khusus workspace tenant / kitchen.');

        $filters = [
            'q' => trim((string) $request->input('q', '')),
            'start_date' => $request->input('start_date', ''),
            'end_date' => $request->input('end_date', ''),
            'quick_range' => $request->input('quick_range', ''),
            'payment_method' => $request->input('payment_method', ''),
            'payment_status' => $request->input('payment_status', ''),
            'order_type' => $request->input('order_type', ''),
            'cashier_id' => $request->input('cashier_id', ''),
            'per_page' => (int) $request->input('per_page', 15),
        ];

        $this->applyQuickRange($filters);

        $tenantOutletIds = $isTenantOutlet
            ? collect([(int) $outlet->id])
            : $this->resolveKitchenTenantOutletIds($user, $outlet->id);
        $allocationOutletId = $isTenantOutlet ? 0 : $outlet->id;
        $allocationQuery = TransactionTenantAllocation::query()
            ->when($allocationOutletId > 0, fn (Builder $query) => $query->where('outlet_id', $allocationOutletId))
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            );

        return [$user, $outlet, $filters, $tenantOutletIds, $allocationQuery];
    }

    private function buildKitchenDailyBreakdownRows($allocationQuery, array $filters): Collection
    {
        return $this->applyKitchenAllocationFilters($allocationQuery, $filters)
            ->with('transaction:id,payment_method')
            ->get()
            ->groupBy(fn (TransactionTenantAllocation $allocation) => ReportTimezone::sourceDateKey($allocation->getRawOriginal('delivered_at')) ?: 'tanpa-tanggal')
            ->map(function (Collection $allocations, string $date) {
                $cashCount = $allocations->filter(fn (TransactionTenantAllocation $allocation) => $allocation->transaction?->payment_method === 'cash')->count();
                $ordersCount = $allocations->count();
                $salesTotal = (int) $allocations->sum('subtotal');

                return [
                    'date' => $date,
                    'label' => $date !== 'tanpa-tanggal' ? Carbon::parse($date, ReportTimezone::timezone())->translatedFormat('d M Y') : 'Tanpa tanggal',
                    'orders_count' => $ordersCount,
                    'sales_total' => $salesTotal,
                    'average_order' => $ordersCount > 0 ? (int) round($salesTotal / $ordersCount) : 0,
                    'cash_count' => $cashCount,
                    'non_cash_count' => max(0, $ordersCount - $cashCount),
                ];
            })
            ->sortByDesc('date')
            ->values();
    }

    private function buildKitchenHourlyBreakdownRows($allocationQuery, array $filters): Collection
    {
        return collect(range(0, 23))->map(function (int $hour) use ($allocationQuery, $filters) {
            $hourQuery = $this->applyKitchenAllocationFilters(clone $allocationQuery, $filters)
                ->whereRaw(ReportTimezone::sourceToDisplayHourExpression('delivered_at').' = ?', [$hour]);

            $ordersCount = (int) (clone $hourQuery)->count();
            $cashCount = (int) (clone $hourQuery)
                ->whereHas('transaction', fn (Builder $query) => $query->where('payment_method', 'cash'))
                ->count();
            $salesTotal = (int) ((clone $hourQuery)->sum('subtotal') ?? 0);

            return [
                'hour_of_day' => $hour,
                'label' => str_pad((string) $hour, 2, '0', STR_PAD_LEFT).'.00',
                'orders_count' => $ordersCount,
                'sales_total' => $salesTotal,
                'average_order' => $ordersCount > 0 ? (int) round($salesTotal / $ordersCount) : 0,
                'cash_count' => $cashCount,
                'non_cash_count' => max(0, $ordersCount - $cashCount),
            ];
        });
    }

    private function sumBaseValueFromTransactionQuery($query): int
    {
        $transactionIds = (clone $query)->pluck('id');

        return $this->sumBaseValueForTransactionIds($transactionIds);
    }

    private function sumPromoDiscountsFromTransactionQuery($query): int
    {
        $transactionIds = (clone $query)->pluck('id');

        return $this->sumPromoDiscountsForTransactionIds($transactionIds);
    }

    private function sumBaseValueForTransactionIds(Collection $transactionIds): int
    {
        if ($transactionIds->isEmpty()) {
            return 0;
        }

        return (int) (TransactionDetail::query()
            ->whereIn('transaction_id', $transactionIds)
            ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0) as total_base_value')
            ->value('total_base_value') ?? 0);
    }

    private function sumPromoDiscountsForTransactionIds(Collection $transactionIds): int
    {
        if ($transactionIds->isEmpty()) {
            return 0;
        }

        $itemDiscounts = (int) (TransactionDetail::query()
            ->whereIn('transaction_id', $transactionIds)
            ->sum('discount_total') ?? 0);

        $checkoutDiscounts = (int) (Transaction::query()
            ->whereIn('id', $transactionIds)
            ->selectRaw('COALESCE(SUM(discount + loyalty_discount_total + customer_voucher_discount), 0) as total_checkout_discount')
            ->value('total_checkout_discount') ?? 0);

        return $itemDiscounts + $checkoutDiscounts;
    }

    private function baseTotalsByTransactionIds(Collection $transactionIds): Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        return TransactionDetail::query()
            ->whereIn('transaction_id', $transactionIds)
            ->selectRaw('transaction_id, COALESCE(SUM(base_unit_price * qty), 0) as total_base_value')
            ->groupBy('transaction_id')
            ->pluck('total_base_value', 'transaction_id');
    }

    private function sumOwnerMarkupValueForTransactionIds(Collection $transactionIds): int
    {
        if ($transactionIds->isEmpty()) {
            return 0;
        }

        return (int) (TransactionDetail::query()
            ->whereIn('transaction_id', $transactionIds)
            ->selectRaw('COALESCE(SUM(owner_net_total), 0) as total_owner_markup_value')
            ->value('total_owner_markup_value') ?? 0);
    }

    private function ownerMarkupTotalsByTransactionIds(Collection $transactionIds): Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        return TransactionDetail::query()
            ->whereIn('transaction_id', $transactionIds)
            ->with(['modifiers' => fn ($query) => $query->select(ReportOwnerTenantSplit::modifierSelectColumns())])
            ->get()
            ->groupBy('transaction_id')
            ->map(fn (Collection $details) => (int) (ReportOwnerTenantSplit::summarizeDetails($details)['owner_net_total'] ?? 0));
    }

    private function sumBaseValueFromAllocationQuery($query): int
    {
        $allocationIds = (clone $query)->pluck('id');

        return $this->sumBaseValueForAllocationIds($allocationIds);
    }

    private function sumBaseValueForAllocationIds(Collection $allocationIds): int
    {
        if ($allocationIds->isEmpty()) {
            return 0;
        }

        return (int) (TransactionTenantAllocationItem::query()
            ->whereIn('transaction_tenant_allocation_id', $allocationIds)
            ->selectRaw('COALESCE(SUM(line_total), 0) as total_base_value')
            ->value('total_base_value') ?? 0);
    }

    private function baseTotalsByAllocationIds(Collection $allocationIds): Collection
    {
        if ($allocationIds->isEmpty()) {
            return collect();
        }

        return TransactionTenantAllocationItem::query()
            ->whereIn('transaction_tenant_allocation_id', $allocationIds)
            ->selectRaw('transaction_tenant_allocation_id, COALESCE(SUM(base_unit_price * qty), 0) as total_base_value')
            ->groupBy('transaction_tenant_allocation_id')
            ->pluck('total_base_value', 'transaction_tenant_allocation_id');
    }

    private function buildGrossTrend(int $outletId, array $filters): Collection
    {
        return ReportTimezone::applySourceDateRange(
            Transaction::query()->where('outlet_id', $outletId),
            'created_at',
            $filters
        )
            ->selectRaw(ReportTimezone::sourceToDisplayDateExpression('created_at').' as day, COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as total_value')
            ->groupBy('day')
            ->orderBy('day')
            ->limit(14)
            ->get()
            ->map(fn ($row) => [
                'day' => $row->day,
                'label' => Carbon::parse($row->day, ReportTimezone::timezone())->format('d M'),
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildBaseTrend(Collection $transactionIds): Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->whereIn('transaction_details.transaction_id', $transactionIds)
            ->selectRaw(ReportTimezone::sourceToDisplayDateExpression('transactions.created_at').' as day, COUNT(DISTINCT transactions.id) as orders_count, COALESCE(SUM(transaction_details.base_unit_price * transaction_details.qty), 0) as total_value')
            ->groupBy('day')
            ->orderBy('day')
            ->limit(14)
            ->get()
            ->map(fn ($row) => [
                'day' => $row->day,
                'label' => Carbon::parse($row->day, ReportTimezone::timezone())->format('d M'),
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildGrossHourlyTrend(int $outletId): Collection
    {
        $todayStart = ReportTimezone::localDateStartInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());
        $todayEnd = ReportTimezone::localDateEndInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());

        return Transaction::query()
            ->where('outlet_id', $outletId)
            ->where('created_at', '>=', $todayStart)
            ->where('created_at', '<=', $todayEnd)
            ->selectRaw(ReportTimezone::sourceToDisplayHourExpression('created_at').' as hour_of_day, COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as total_value')
            ->groupBy('hour_of_day')
            ->orderBy('hour_of_day')
            ->get()
            ->map(fn ($row) => [
                'hour_of_day' => (int) $row->hour_of_day,
                'label' => str_pad((string) $row->hour_of_day, 2, '0', STR_PAD_LEFT).'.00',
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildBaseHourlyTrend(int $outletId): Collection
    {
        $todayStart = ReportTimezone::localDateStartInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());
        $todayEnd = ReportTimezone::localDateEndInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());

        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->where('transactions.outlet_id', $outletId)
            ->where('transactions.created_at', '>=', $todayStart)
            ->where('transactions.created_at', '<=', $todayEnd)
            ->selectRaw(ReportTimezone::sourceToDisplayHourExpression('transactions.created_at').' as hour_of_day, COUNT(DISTINCT transactions.id) as orders_count, COALESCE(SUM(transaction_details.base_unit_price * transaction_details.qty), 0) as total_value')
            ->groupBy('hour_of_day')
            ->orderBy('hour_of_day')
            ->get()
            ->map(fn ($row) => [
                'hour_of_day' => (int) $row->hour_of_day,
                'label' => str_pad((string) $row->hour_of_day, 2, '0', STR_PAD_LEFT).'.00',
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildGrossPaymentBreakdown(int $outletId, array $filters): Collection
    {
        return $this->applyFilters(
            Transaction::query()->where('outlet_id', $outletId),
            $filters
        )
            ->selectRaw('COALESCE(payment_method, "lainnya") as payment_method, COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as total_value')
            ->groupBy('payment_method')
            ->orderByDesc('total_value')
            ->get()
            ->map(fn ($row) => [
                'payment_method' => $row->payment_method ?: 'lainnya',
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildBasePaymentBreakdown(Collection $transactionIds): Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->whereIn('transaction_details.transaction_id', $transactionIds)
            ->selectRaw('COALESCE(transactions.payment_method, "lainnya") as payment_method, COUNT(DISTINCT transactions.id) as orders_count, COALESCE(SUM(transaction_details.base_unit_price * transaction_details.qty), 0) as total_value')
            ->groupBy('transactions.payment_method')
            ->orderByDesc('total_value')
            ->get()
            ->map(fn ($row) => [
                'payment_method' => $row->payment_method ?: 'lainnya',
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildGrossTopProducts(Collection $transactionIds): Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        return TransactionDetail::query()
            ->with('product:id,title')
            ->whereIn('transaction_id', $transactionIds)
            ->selectRaw('product_id, SUM(qty) as total_qty, COALESCE(SUM(price), 0) as total_value')
            ->groupBy('product_id')
            ->orderByDesc('total_qty')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'product_id' => $row->product_id,
                'product_title' => $row->product?->title ?? 'Produk terhapus',
                'total_qty' => (int) $row->total_qty,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildAdminTenantPromoBreakdown(int $outletId, Collection $transactionIds): Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        $allocations = TransactionTenantAllocation::query()
            ->with('tenantOutlet:id,name,code')
            ->where('outlet_id', $outletId)
            ->whereIn('transaction_id', $transactionIds)
            ->get();

        $allocations = $allocations->map(function (TransactionTenantAllocation $allocation) {
            $promoDiscountTotal = (int) ($allocation->promo_discount_total ?? 0);
            $subtotal = (int) ($allocation->subtotal ?? 0);
            $prePromoSubtotal = $subtotal + $promoDiscountTotal;
            $totalDiscountTotal = $promoDiscountTotal
                + (int) ($allocation->voucher_discount_total ?? 0)
                + (int) ($allocation->loyalty_discount_total ?? 0)
                + (int) ($allocation->manual_discount_total ?? 0);

            $allocation->setAttribute('pre_promo_subtotal', $prePromoSubtotal);
            $allocation->setAttribute('total_discount_total', $totalDiscountTotal);

            return $allocation;
        });

        return $allocations
            ->groupBy('tenant_outlet_id')
            ->map(function (Collection $tenantAllocations) {
                /** @var TransactionTenantAllocation $first */
                $first = $tenantAllocations->first();

                return [
                    'tenant_outlet_id' => (int) $first->tenant_outlet_id,
                    'tenant_outlet' => $first->tenantOutlet ? [
                        'id' => $first->tenantOutlet->id,
                        'name' => $first->tenantOutlet->name,
                        'code' => $first->tenantOutlet->code,
                    ] : null,
                    'orders_count' => $tenantAllocations->count(),
                    'pre_promo_subtotal' => (int) $tenantAllocations->sum('pre_promo_subtotal'),
                    'promo_total' => (int) $tenantAllocations->sum('total_discount_total'),
                    'after_promo_total' => (int) $tenantAllocations->sum('grand_total'),
                ];
            })
            ->sortByDesc('promo_total')
            ->values();
    }

    private function buildAdminTenantPromoTrend(int $outletId, Collection $transactionIds): Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        return TransactionTenantAllocation::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_tenant_allocations.transaction_id')
            ->where('transaction_tenant_allocations.outlet_id', $outletId)
            ->whereIn('transaction_tenant_allocations.transaction_id', $transactionIds)
            ->selectRaw(ReportTimezone::sourceToDisplayDateExpression('transactions.created_at').' as day')
            ->selectRaw('COUNT(DISTINCT transaction_tenant_allocations.transaction_id) as orders_count')
            ->selectRaw('COALESCE(SUM(transaction_tenant_allocations.promo_discount_total + transaction_tenant_allocations.voucher_discount_total + transaction_tenant_allocations.loyalty_discount_total + transaction_tenant_allocations.manual_discount_total), 0) as promo_total')
            ->groupBy('day')
            ->orderBy('day')
            ->limit(14)
            ->get()
            ->map(fn ($row) => [
                'day' => $row->day,
                'label' => Carbon::parse($row->day, ReportTimezone::timezone())->format('d M'),
                'orders_count' => (int) $row->orders_count,
                'promo_total' => (int) $row->promo_total,
            ])
            ->values();
    }

    private function buildBaseTopProducts(Collection $transactionIds): Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        return TransactionDetail::query()
            ->with('product:id,title')
            ->whereIn('transaction_id', $transactionIds)
            ->selectRaw('product_id, SUM(qty) as total_qty, COALESCE(SUM(base_unit_price * qty), 0) as total_value')
            ->groupBy('product_id')
            ->orderByDesc('total_qty')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'product_id' => $row->product_id,
                'product_title' => $row->product?->title ?? 'Produk terhapus',
                'total_qty' => (int) $row->total_qty,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function resolveKitchenTenantOutletIds(User $user, int $activeOutletId): Collection
    {
        $preferredStationId = (int) ($user->preferred_kitchen_station_id ?? 0);

        return Product::query()
            ->whereNotNull('tenant_outlet_id')
            ->whereHas('kitchenStationMappings', function (Builder $query) use ($preferredStationId, $activeOutletId) {
                $query->where('is_active', true)
                    ->when(
                        $preferredStationId > 0,
                        fn (Builder $builder) => $builder->where('kitchen_station_id', $preferredStationId)
                    )
                    ->when(
                        $preferredStationId <= 0,
                        fn (Builder $builder) => $builder->whereHas(
                            'kitchenStation',
                            fn (Builder $stationQuery) => $stationQuery
                                ->where('outlet_id', $activeOutletId)
                                ->where('is_active', true)
                        )
                    );
            })
            ->pluck('tenant_outlet_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    private function applyKitchenAllocationFilters($query, array $filters)
    {
        $query = $query
            ->when($filters['q'] ?? null, function ($builder, $search) {
                $builder->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('allocation_number', 'like', '%'.$search.'%')
                        ->orWhereHas('transaction', function (Builder $transactionQuery) use ($search) {
                            $transactionQuery
                                ->where('invoice', 'like', '%'.$search.'%')
                                ->orWhere('payment_method', 'like', '%'.$search.'%')
                                ->orWhere('payment_status', 'like', '%'.$search.'%')
                                ->orWhereHas('customer', fn (Builder $customerQuery) => $customerQuery->where('name', 'like', '%'.$search.'%'))
                                ->orWhereHas('cashier', fn (Builder $cashierQuery) => $cashierQuery->where('name', 'like', '%'.$search.'%'));
                        });
                });
            })
            ->when($filters['payment_method'] ?? null, fn ($builder, $paymentMethod) => $builder->whereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery->where('payment_method', $paymentMethod)))
            ->when($filters['payment_status'] ?? null, fn ($builder, $paymentStatus) => $builder->whereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery->where('payment_status', $paymentStatus)))
            ->when($filters['order_type'] ?? null, fn ($builder, $orderType) => $builder->whereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery->where('order_type', $orderType)))
            ->when($filters['cashier_id'] ?? null, fn ($builder, $cashierId) => $builder->whereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery->where('cashier_id', $cashierId)));

        return ReportTimezone::applySourceDateRange($query, 'delivered_at', $filters);
    }

    private function buildTenantTrend(int $outletId, Collection $tenantOutletIds, array $filters): Collection
    {
        return $this->applyKitchenAllocationFilters(
            TransactionTenantAllocation::query()
                ->join('transaction_tenant_allocation_items', 'transaction_tenant_allocation_items.transaction_tenant_allocation_id', '=', 'transaction_tenant_allocations.id')
                ->when($outletId > 0, fn (Builder $query) => $query->where('transaction_tenant_allocations.outlet_id', $outletId))
                ->where('transaction_tenant_allocations.waiter_status', 'delivered')
                ->whereNotNull('transaction_tenant_allocations.delivered_at')
                ->when(
                    $tenantOutletIds->isNotEmpty(),
                    fn (Builder $query) => $query->whereIn('transaction_tenant_allocations.tenant_outlet_id', $tenantOutletIds->all()),
                    fn (Builder $query) => $query->whereRaw('1 = 0')
                ),
            $filters
        )
            ->selectRaw(ReportTimezone::sourceToDisplayDateExpression('transaction_tenant_allocations.delivered_at').' as day, COUNT(DISTINCT transaction_tenant_allocations.id) as orders_count, COALESCE(SUM(transaction_tenant_allocation_items.line_total), 0) as total_value')
            ->groupBy('day')
            ->orderBy('day')
            ->limit(14)
            ->get()
            ->map(fn ($row) => [
                'day' => $row->day,
                'label' => Carbon::parse($row->day, ReportTimezone::timezone())->format('d M'),
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildTenantHourlyTrend(int $outletId, Collection $tenantOutletIds): Collection
    {
        return TransactionTenantAllocation::query()
            ->join('transaction_tenant_allocation_items', 'transaction_tenant_allocation_items.transaction_tenant_allocation_id', '=', 'transaction_tenant_allocations.id')
            ->when($outletId > 0, fn (Builder $query) => $query->where('transaction_tenant_allocations.outlet_id', $outletId))
            ->where('transaction_tenant_allocations.waiter_status', 'delivered')
            ->whereNotNull('transaction_tenant_allocations.delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('transaction_tenant_allocations.tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            )
            ->where('transaction_tenant_allocations.delivered_at', '>=', ReportTimezone::localDateStartInSourceTz(now(ReportTimezone::displayTimezone())->toDateString()))
            ->where('transaction_tenant_allocations.delivered_at', '<=', ReportTimezone::localDateEndInSourceTz(now(ReportTimezone::displayTimezone())->toDateString()))
            ->selectRaw(ReportTimezone::sourceToDisplayHourExpression('transaction_tenant_allocations.delivered_at').' as hour_of_day, COUNT(DISTINCT transaction_tenant_allocations.id) as orders_count, COALESCE(SUM(transaction_tenant_allocation_items.line_total), 0) as total_value')
            ->groupBy('hour_of_day')
            ->orderBy('hour_of_day')
            ->get()
            ->map(fn ($row) => [
                'hour_of_day' => (int) $row->hour_of_day,
                'label' => str_pad((string) $row->hour_of_day, 2, '0', STR_PAD_LEFT).'.00',
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildTenantPaymentBreakdown(int $outletId, Collection $tenantOutletIds, array $filters): Collection
    {
        return $this->applyKitchenAllocationFilters(
            TransactionTenantAllocation::query()
                ->join('transactions', 'transactions.id', '=', 'transaction_tenant_allocations.transaction_id')
                ->join('transaction_tenant_allocation_items', 'transaction_tenant_allocation_items.transaction_tenant_allocation_id', '=', 'transaction_tenant_allocations.id')
                ->when($outletId > 0, fn (Builder $query) => $query->where('transaction_tenant_allocations.outlet_id', $outletId))
                ->where('transaction_tenant_allocations.waiter_status', 'delivered')
                ->whereNotNull('transaction_tenant_allocations.delivered_at')
                ->when(
                    $tenantOutletIds->isNotEmpty(),
                    fn ($query) => $query->whereIn('transaction_tenant_allocations.tenant_outlet_id', $tenantOutletIds->all()),
                    fn ($query) => $query->whereRaw('1 = 0')
                ),
            $filters
        )
            ->selectRaw('COALESCE(transactions.payment_method, "lainnya") as payment_method, COUNT(DISTINCT transaction_tenant_allocations.id) as orders_count, COALESCE(SUM(transaction_tenant_allocation_items.line_total), 0) as total_value')
            ->groupBy('transactions.payment_method')
            ->orderByDesc('total_value')
            ->get()
            ->map(fn ($row) => [
                'payment_method' => $row->payment_method ?: 'lainnya',
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildTenantTopProducts(Collection $allocationIds): Collection
    {
        if ($allocationIds->isEmpty()) {
            return collect();
        }

        return TransactionTenantAllocationItem::query()
            ->with('product:id,title')
            ->whereIn('transaction_tenant_allocation_id', $allocationIds)
            ->selectRaw('product_id, SUM(qty) as total_qty, COALESCE(SUM(line_total), 0) as total_value')
            ->groupBy('product_id')
            ->orderByDesc('total_qty')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'product_id' => $row->product_id,
                'product_title' => $row->product?->title ?? 'Produk terhapus',
                'total_qty' => (int) $row->total_qty,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildTenantProductPerformance(
        User $user,
        int $activeOutletId,
        Collection $tenantOutletIds,
        Collection $allocationIds
    ): array {
        $products = $this->visibleKitchenProductsQuery($user, $activeOutletId, $tenantOutletIds)
            ->get(['id', 'title', 'tenant_outlet_id', 'buy_price', 'sell_price']);

        $salesByProduct = $allocationIds->isNotEmpty()
            ? TransactionTenantAllocationItem::query()
                ->whereIn('transaction_tenant_allocation_id', $allocationIds)
                ->selectRaw('product_id, SUM(qty) as total_qty, COALESCE(SUM(line_total), 0) as total_value')
                ->groupBy('product_id')
                ->get()
                ->keyBy('product_id')
            : collect();

        $totalSalesValue = (int) $salesByProduct->sum(fn ($row) => (int) ($row->total_value ?? 0));

        $performance = $products->map(function (Product $product) use ($salesByProduct, $totalSalesValue) {
            $salesRow = $salesByProduct->get($product->id);
            $soldQty = (int) ($salesRow->total_qty ?? 0);
            $soldValue = (int) ($salesRow->total_value ?? 0);

            return [
                'product_id' => $product->id,
                'product_title' => $product->title,
                'tenant_outlet_id' => (int) ($product->tenant_outlet_id ?? 0),
                'sold_qty' => $soldQty,
                'sold_value' => $soldValue,
                'share_percentage' => $totalSalesValue > 0
                    ? round(($soldValue / $totalSalesValue) * 100, 2)
                    : 0.0,
            ];
        })->values();

        $soldProducts = $performance
            ->filter(fn (array $product) => (int) $product['sold_qty'] > 0)
            ->values();

        return [
            'catalog_count' => (int) $performance->count(),
            'sold_count' => (int) $soldProducts->count(),
            'unsold_count' => (int) $performance->where('sold_qty', 0)->count(),
            'best_sellers' => $soldProducts
                ->sortBy([
                    ['sold_qty', 'desc'],
                    ['sold_value', 'desc'],
                    ['product_title', 'asc'],
                ])
                ->take(5)
                ->values(),
            'slow_movers' => $soldProducts
                ->sortBy([
                    ['sold_qty', 'asc'],
                    ['sold_value', 'asc'],
                    ['product_title', 'asc'],
                ])
                ->take(5)
                ->values(),
            'unsold_products' => $performance
                ->where('sold_qty', 0)
                ->sortBy('product_title')
                ->take(8)
                ->values(),
            'revenue_mix' => $soldProducts
                ->sortBy([
                    ['sold_value', 'desc'],
                    ['sold_qty', 'desc'],
                    ['product_title', 'asc'],
                ])
                ->take(6)
                ->values(),
        ];
    }

    private function visibleKitchenProductsQuery(User $user, int $activeOutletId, Collection $tenantOutletIds)
    {
        $preferredStationId = (int) ($user->preferred_kitchen_station_id ?? 0);

        return Product::query()
            ->whereNotNull('tenant_outlet_id')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            )
            ->whereHas('kitchenStationMappings', function (Builder $query) use ($preferredStationId, $activeOutletId) {
                $query->where('is_active', true)
                    ->when(
                        $preferredStationId > 0,
                        fn (Builder $builder) => $builder->where('kitchen_station_id', $preferredStationId)
                    )
                    ->when(
                        $preferredStationId <= 0,
                        fn (Builder $builder) => $builder->whereHas(
                            'kitchenStation',
                            fn (Builder $stationQuery) => $stationQuery
                                ->where('outlet_id', $activeOutletId)
                                ->where('is_active', true)
                        )
                    );
            })
            ->orderBy('title');
    }

    private function applyFilters($query, array $filters)
    {
        return ReportTimezone::applySourceDateRange($query
            ->when($filters['q'] ?? null, function ($builder, $search) {
                $builder->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('invoice', 'like', '%'.$search.'%')
                        ->orWhere('payment_method', 'like', '%'.$search.'%')
                        ->orWhere('payment_status', 'like', '%'.$search.'%')
                        ->orWhereHas('customer', fn ($customerQuery) => $customerQuery->where('name', 'like', '%'.$search.'%'))
                        ->orWhereHas('cashier', fn ($cashierQuery) => $cashierQuery->where('name', 'like', '%'.$search.'%'));
                });
            })
            ->when($filters['payment_method'] ?? null, fn ($builder, $paymentMethod) => $builder->where('payment_method', $paymentMethod))
            ->when($filters['payment_status'] ?? null, fn ($builder, $paymentStatus) => $builder->where('payment_status', $paymentStatus))
            ->when($filters['order_type'] ?? null, fn ($builder, $orderType) => $builder->where('order_type', $orderType))
            ->when($filters['cashier_id'] ?? null, fn ($builder, $cashierId) => $builder->where('cashier_id', $cashierId)),
            'created_at',
            $filters
        );
    }

    private function applyQuickRange(array &$filters): void
    {
        $displayTz = ReportTimezone::displayTimezone();
        $now = now($displayTz);

        switch ((string) ($filters['quick_range'] ?? '')) {
            case 'today':
                $filters['start_date'] = $now->toDateString();
                $filters['end_date'] = $now->toDateString();
                break;
            case 'yesterday':
                $filters['start_date'] = $now->copy()->subDay()->toDateString();
                $filters['end_date'] = $now->copy()->subDay()->toDateString();
                break;
            case '7d':
                $filters['start_date'] = $now->copy()->subDays(6)->toDateString();
                $filters['end_date'] = $now->toDateString();
                break;
            case '30d':
                $filters['start_date'] = $now->copy()->subDays(29)->toDateString();
                $filters['end_date'] = $now->toDateString();
                break;
            case 'month':
                $filters['start_date'] = $now->copy()->startOfMonth()->toDateString();
                $filters['end_date'] = $now->toDateString();
                break;
            default:
                break;
        }
    }

    private function humanizeOrderType(?string $orderType): string
    {
        return match ((string) $orderType) {
            'dine_in' => 'Makan di Tempat',
            'take_away', 'takeaway' => 'Bawa Pulang',
            'delivery' => 'Delivery',
            default => $orderType ? ucwords(str_replace(['_', '-'], ' ', $orderType)) : '-',
        };
    }

    private function humanizePaymentMethod(?string $paymentMethod): string
    {
        return match ((string) $paymentMethod) {
            'cash' => 'Tunai',
            'transfer' => 'Transfer',
            'qris' => 'QRIS',
            'debt' => 'Bayar Belakangan',
            default => $paymentMethod ? ucwords(str_replace(['_', '-'], ' ', $paymentMethod)) : '-',
        };
    }

    private function humanizePaymentStatus(?string $paymentStatus): string
    {
        return match ((string) $paymentStatus) {
            'paid' => 'Lunas',
            'pending' => 'Menunggu Pembayaran',
            'failed' => 'Gagal',
            default => $paymentStatus ? ucwords(str_replace(['_', '-'], ' ', $paymentStatus)) : '-',
        };
    }

    private function humanizeServiceStatus(?string $status): string
    {
        return match ((string) $status) {
            'delivered' => 'Sudah Diantar / Diambil',
            'picked_up' => 'Sedang Diantar',
            'assigned' => 'Sudah Ditugaskan',
            'ready' => 'Siap Antar',
            default => $status ? ucwords(str_replace(['_', '-'], ' ', $status)) : '-',
        };
    }
}
