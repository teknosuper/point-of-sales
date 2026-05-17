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

        if ($isKitchenWorkspace) {
            return $this->renderKitchenWorkspace($request, $user, $outlet->id, $outlet->name, $outlet->code, $filters, $allowedPerPage);
        }

        $baseQuery = $this->applyFilters(
            Transaction::query()
                ->with(['customer:id,name', 'cashier:id,name'])
                ->where('outlet_id', $outlet->id),
            $filters
        );

        $filteredTransactionIds = (clone $baseQuery)->pluck('id');
        $baseTotalsByTransaction = $this->baseTotalsByTransactionIds($filteredTransactionIds);
        $filteredGrossTotal = (int) ((clone $baseQuery)->sum('grand_total') ?? 0);
        $filteredBaseTotal = $this->sumBaseValueForTransactionIds($filteredTransactionIds);
        $filteredMarkupTotal = max(0, $filteredGrossTotal - $filteredBaseTotal);

        $transactions = (clone $baseQuery)
            ->latest('created_at')
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(function (Transaction $transaction) use ($baseTotalsByTransaction, $isKitchenWorkspace) {
                $baseTotal = (int) ($baseTotalsByTransaction[$transaction->id] ?? 0);
                $grossTotal = (int) $transaction->grand_total;

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
                    'markup_total' => max(0, $grossTotal - $baseTotal),
                    'display_total' => $isKitchenWorkspace ? $baseTotal : $grossTotal,
                    'created_at' => optional($transaction->getRawOriginal('created_at'))
                        ? Carbon::parse($transaction->getRawOriginal('created_at'))->toIso8601String()
                        : null,
                ];
            });

        $filteredSummary = (clone $baseQuery)
            ->selectRaw('COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as sales_total')
            ->first();

        $filteredProfitTotal = $filteredTransactionIds->isNotEmpty()
            ? Profit::query()->whereIn('transaction_id', $filteredTransactionIds)->sum('total')
            : 0;

        $todayTransactions = Transaction::query()
            ->where('outlet_id', $outlet->id)
            ->whereDate('created_at', Carbon::today());
        $todaySales = (int) ((clone $todayTransactions)->sum('grand_total') ?? 0);
        $todayBaseTotal = $this->sumBaseValueFromTransactionQuery(clone $todayTransactions);
        $todayOrders = (clone $todayTransactions)
            ->count();

        $yesterdayTransactions = Transaction::query()
            ->where('outlet_id', $outlet->id)
            ->whereDate('created_at', Carbon::yesterday());
        $yesterdaySales = (int) ((clone $yesterdayTransactions)->sum('grand_total') ?? 0);
        $yesterdayBaseTotal = $this->sumBaseValueFromTransactionQuery(clone $yesterdayTransactions);
        $yesterdayOrders = (clone $yesterdayTransactions)->count();

        $monthTransactions = Transaction::query()
            ->where('outlet_id', $outlet->id)
            ->whereMonth('created_at', Carbon::now()->month)
            ->whereYear('created_at', Carbon::now()->year);
        $monthSales = (int) ((clone $monthTransactions)->sum('grand_total') ?? 0);
        $monthBaseTotal = $this->sumBaseValueFromTransactionQuery(clone $monthTransactions);
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
                'today_markup_total' => max(0, $todaySales - $todayBaseTotal),
                'today_orders' => (int) $todayOrders,
                'yesterday_total' => $isKitchenWorkspace ? $yesterdayBaseTotal : $yesterdaySales,
                'yesterday_sales' => (int) $yesterdaySales,
                'yesterday_base_total' => $yesterdayBaseTotal,
                'yesterday_markup_total' => max(0, $yesterdaySales - $yesterdayBaseTotal),
                'yesterday_orders' => (int) $yesterdayOrders,
                'month_total' => $isKitchenWorkspace ? $monthBaseTotal : $monthSales,
                'month_sales' => (int) $monthSales,
                'month_base_total' => $monthBaseTotal,
                'month_markup_total' => max(0, $monthSales - $monthBaseTotal),
                'month_orders' => (int) $monthOrders,
                'filtered_total' => $isKitchenWorkspace ? $filteredBaseTotal : $filteredGrossTotal,
                'filtered_sales_total' => (int) ($filteredSummary->sales_total ?? 0),
                'filtered_base_total' => $filteredBaseTotal,
                'filtered_markup_total' => $filteredMarkupTotal,
                'filtered_orders_count' => (int) ($filteredSummary->orders_count ?? 0),
                'filtered_profit_total' => (int) $filteredProfitTotal,
            ],
            'trend' => $trend,
            'hourlyTrend' => $hourlyTrend,
            'paymentBreakdown' => $paymentBreakdown,
            'topProducts' => $topProducts,
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

    private function renderKitchenWorkspace(
        Request $request,
        User $user,
        int $outletId,
        string $outletName,
        ?string $outletCode,
        array $filters,
        array $allowedPerPage
    ): Response {
        $tenantOutletIds = $this->resolveKitchenTenantOutletIds($user, $outletId);

        $allocationBaseQuery = $this->applyKitchenAllocationFilters(
            TransactionTenantAllocation::query()
                ->with(['transaction.customer:id,name', 'transaction.cashier:id,name'])
                ->where('outlet_id', $outletId)
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
        $filteredTenantSalesTotal = $this->sumBaseValueForAllocationIds($filteredAllocationIds);
        $filteredBaseTotal = $filteredTenantSalesTotal;

        $transactions = (clone $allocationBaseQuery)
            ->latest('delivered_at')
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(function (TransactionTenantAllocation $allocation) use ($filteredBaseTotals) {
                $baseTotal = (int) ($filteredBaseTotals[$allocation->id] ?? 0);
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
                    'tenant_sale_total' => $baseTotal,
                    'base_total' => $baseTotal,
                    'service_status' => $allocation->waiter_status,
                    'service_status_label' => $this->humanizeServiceStatus($allocation->waiter_status),
                    'settlement_reference_total' => $baseTotal,
                    'created_at' => optional($transaction?->getRawOriginal('created_at'))
                        ? Carbon::parse($transaction->getRawOriginal('created_at'))->toIso8601String()
                        : null,
                    'delivered_at' => optional($allocation->delivered_at)?->toIso8601String(),
                ];
            });

        $todayAllocations = TransactionTenantAllocation::query()
            ->where('outlet_id', $outletId)
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            )
            ->whereDate('delivered_at', Carbon::today());
        $todayTenantSales = $this->sumBaseValueFromAllocationQuery(clone $todayAllocations);
        $todayBaseTotal = $todayTenantSales;
        $todayOrders = (clone $todayAllocations)->count();
        $todayCashCount = (clone $todayAllocations)->whereHas('transaction', fn (Builder $query) => $query->where('payment_method', 'cash'))->count();
        $todayNonCashCount = max(0, $todayOrders - $todayCashCount);

        $yesterdayAllocations = TransactionTenantAllocation::query()
            ->where('outlet_id', $outletId)
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            )
            ->whereDate('delivered_at', Carbon::yesterday());
        $yesterdayTenantSales = $this->sumBaseValueFromAllocationQuery(clone $yesterdayAllocations);
        $yesterdayBaseTotal = $yesterdayTenantSales;
        $yesterdayOrders = (clone $yesterdayAllocations)->count();

        $monthAllocations = TransactionTenantAllocation::query()
            ->where('outlet_id', $outletId)
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            )
            ->whereMonth('delivered_at', Carbon::now()->month)
            ->whereYear('delivered_at', Carbon::now()->year);
        $monthTenantSales = $this->sumBaseValueFromAllocationQuery(clone $monthAllocations);
        $monthBaseTotal = $monthTenantSales;
        $monthOrders = (clone $monthAllocations)->count();

        $paymentBreakdown = $this->buildTenantPaymentBreakdown($outletId, $tenantOutletIds, $filters);
        $topProducts = $this->buildTenantTopProducts($filteredAllocationIds);
        $trend = $this->buildTenantTrend($outletId, $tenantOutletIds, $filters);
        $hourlyTrend = $this->buildTenantHourlyTrend($outletId, $tenantOutletIds);

        $cashiers = TransactionTenantAllocation::query()
            ->where('outlet_id', $outletId)
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
            ],
            'trend' => $trend,
            'hourlyTrend' => $hourlyTrend,
            'paymentBreakdown' => $paymentBreakdown,
            'topProducts' => $topProducts,
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
            ],
        ]);
    }

    private function sumBaseValueFromTransactionQuery($query): int
    {
        $transactionIds = (clone $query)->pluck('id');

        return $this->sumBaseValueForTransactionIds($transactionIds);
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
            ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0) as total_base_value')
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
        return Transaction::query()
            ->where('outlet_id', $outletId)
            ->when($filters['start_date'], fn ($query, $startDate) => $query->whereDate('created_at', '>=', $startDate))
            ->when($filters['end_date'], fn ($query, $endDate) => $query->whereDate('created_at', '<=', $endDate))
            ->selectRaw('DATE(created_at) as day, COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as total_value')
            ->groupBy('day')
            ->orderBy('day')
            ->limit(14)
            ->get()
            ->map(fn ($row) => [
                'day' => $row->day,
                'label' => Carbon::parse($row->day)->format('d M'),
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
            ->selectRaw('DATE(transactions.created_at) as day, COUNT(DISTINCT transactions.id) as orders_count, COALESCE(SUM(transaction_details.base_unit_price * transaction_details.qty), 0) as total_value')
            ->groupBy('day')
            ->orderBy('day')
            ->limit(14)
            ->get()
            ->map(fn ($row) => [
                'day' => $row->day,
                'label' => Carbon::parse($row->day)->format('d M'),
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildGrossHourlyTrend(int $outletId): Collection
    {
        return Transaction::query()
            ->where('outlet_id', $outletId)
            ->whereDate('created_at', Carbon::today())
            ->selectRaw('HOUR(created_at) as hour_of_day, COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as total_value')
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
        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->where('transactions.outlet_id', $outletId)
            ->whereDate('transactions.created_at', Carbon::today())
            ->selectRaw('HOUR(transactions.created_at) as hour_of_day, COUNT(DISTINCT transactions.id) as orders_count, COALESCE(SUM(transaction_details.base_unit_price * transaction_details.qty), 0) as total_value')
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
        return $query
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
            ->when($filters['start_date'] ?? null, fn ($builder, $startDate) => $builder->whereDate('delivered_at', '>=', $startDate))
            ->when($filters['end_date'] ?? null, fn ($builder, $endDate) => $builder->whereDate('delivered_at', '<=', $endDate))
            ->when($filters['payment_method'] ?? null, fn ($builder, $paymentMethod) => $builder->whereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery->where('payment_method', $paymentMethod)))
            ->when($filters['payment_status'] ?? null, fn ($builder, $paymentStatus) => $builder->whereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery->where('payment_status', $paymentStatus)))
            ->when($filters['order_type'] ?? null, fn ($builder, $orderType) => $builder->whereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery->where('order_type', $orderType)))
            ->when($filters['cashier_id'] ?? null, fn ($builder, $cashierId) => $builder->whereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery->where('cashier_id', $cashierId)));
    }

    private function buildTenantTrend(int $outletId, Collection $tenantOutletIds, array $filters): Collection
    {
        return $this->applyKitchenAllocationFilters(
            TransactionTenantAllocation::query()
                ->join('transaction_tenant_allocation_items', 'transaction_tenant_allocation_items.transaction_tenant_allocation_id', '=', 'transaction_tenant_allocations.id')
                ->where('transaction_tenant_allocations.outlet_id', $outletId)
                ->where('transaction_tenant_allocations.waiter_status', 'delivered')
                ->whereNotNull('transaction_tenant_allocations.delivered_at')
                ->when(
                    $tenantOutletIds->isNotEmpty(),
                    fn (Builder $query) => $query->whereIn('transaction_tenant_allocations.tenant_outlet_id', $tenantOutletIds->all()),
                    fn (Builder $query) => $query->whereRaw('1 = 0')
                ),
            $filters
        )
            ->selectRaw('DATE(transaction_tenant_allocations.delivered_at) as day, COUNT(DISTINCT transaction_tenant_allocations.id) as orders_count, COALESCE(SUM(transaction_tenant_allocation_items.base_unit_price * transaction_tenant_allocation_items.qty), 0) as total_value')
            ->groupBy('day')
            ->orderBy('day')
            ->limit(14)
            ->get()
            ->map(fn ($row) => [
                'day' => $row->day,
                'label' => Carbon::parse($row->day)->format('d M'),
                'orders_count' => (int) $row->orders_count,
                'total_value' => (int) $row->total_value,
            ])
            ->values();
    }

    private function buildTenantHourlyTrend(int $outletId, Collection $tenantOutletIds): Collection
    {
        return TransactionTenantAllocation::query()
            ->join('transaction_tenant_allocation_items', 'transaction_tenant_allocation_items.transaction_tenant_allocation_id', '=', 'transaction_tenant_allocations.id')
            ->where('transaction_tenant_allocations.outlet_id', $outletId)
            ->where('transaction_tenant_allocations.waiter_status', 'delivered')
            ->whereNotNull('transaction_tenant_allocations.delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $query) => $query->whereIn('transaction_tenant_allocations.tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $query) => $query->whereRaw('1 = 0')
            )
            ->whereDate('transaction_tenant_allocations.delivered_at', Carbon::today())
            ->selectRaw('HOUR(transaction_tenant_allocations.delivered_at) as hour_of_day, COUNT(DISTINCT transaction_tenant_allocations.id) as orders_count, COALESCE(SUM(transaction_tenant_allocation_items.base_unit_price * transaction_tenant_allocation_items.qty), 0) as total_value')
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
                ->where('transaction_tenant_allocations.outlet_id', $outletId)
                ->where('transaction_tenant_allocations.waiter_status', 'delivered')
                ->whereNotNull('transaction_tenant_allocations.delivered_at')
                ->when(
                    $tenantOutletIds->isNotEmpty(),
                    fn ($query) => $query->whereIn('transaction_tenant_allocations.tenant_outlet_id', $tenantOutletIds->all()),
                    fn ($query) => $query->whereRaw('1 = 0')
                ),
            $filters
        )
            ->selectRaw('COALESCE(transactions.payment_method, "lainnya") as payment_method, COUNT(DISTINCT transaction_tenant_allocations.id) as orders_count, COALESCE(SUM(transaction_tenant_allocation_items.base_unit_price * transaction_tenant_allocation_items.qty), 0) as total_value')
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

    private function applyFilters($query, array $filters)
    {
        return $query
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
            ->when($filters['start_date'] ?? null, fn ($builder, $startDate) => $builder->whereDate('created_at', '>=', $startDate))
            ->when($filters['end_date'] ?? null, fn ($builder, $endDate) => $builder->whereDate('created_at', '<=', $endDate))
            ->when($filters['payment_method'] ?? null, fn ($builder, $paymentMethod) => $builder->where('payment_method', $paymentMethod))
            ->when($filters['payment_status'] ?? null, fn ($builder, $paymentStatus) => $builder->where('payment_status', $paymentStatus))
            ->when($filters['order_type'] ?? null, fn ($builder, $orderType) => $builder->where('order_type', $orderType))
            ->when($filters['cashier_id'] ?? null, fn ($builder, $cashierId) => $builder->where('cashier_id', $cashierId));
    }

    private function applyQuickRange(array &$filters): void
    {
        $today = Carbon::today();

        switch ((string) ($filters['quick_range'] ?? '')) {
            case 'today':
                $filters['start_date'] = $today->toDateString();
                $filters['end_date'] = $today->toDateString();
                break;
            case 'yesterday':
                $filters['start_date'] = Carbon::yesterday()->toDateString();
                $filters['end_date'] = Carbon::yesterday()->toDateString();
                break;
            case '7d':
                $filters['start_date'] = $today->copy()->subDays(6)->toDateString();
                $filters['end_date'] = $today->toDateString();
                break;
            case '30d':
                $filters['start_date'] = $today->copy()->subDays(29)->toDateString();
                $filters['end_date'] = $today->toDateString();
                break;
            case 'month':
                $filters['start_date'] = $today->copy()->startOfMonth()->toDateString();
                $filters['end_date'] = $today->toDateString();
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
