<?php

namespace App\Http\Controllers;

use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductKitchenStationMapping;
use App\Models\ProductOutletStock;
use App\Models\Profit;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Services\CashierShiftService;
use App\Services\OutletResolver;
use App\Services\TransactionReturnImpactService;
use App\Support\ReportTimezone;
use App\Support\ReportCustomerProfileMetrics;
use Illuminate\Http\RedirectResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver,
        private readonly TransactionReturnImpactService $transactionReturnImpactService
    ) {}

    public function index(CashierShiftService $cashierShiftService): \Inertia\Response|RedirectResponse
    {
        $user = request()->user();
        if ($user?->isKitchenWorkspace()) {
            $preferredStation = $user->preferredKitchenStation;

            if ($preferredStation && $user->hasAccessToOutlet((int) $preferredStation->outlet_id)) {
                request()->session()->put('active_outlet_id', (int) $preferredStation->outlet_id);

                return redirect()->route('kitchen.show', ['stationSlug' => $preferredStation->slug]);
            }

            return redirect()->route('kitchen.index');
        }

        $activeOutlet = $this->outletResolver->resolve(request(), request()->user());
        $outletId = $activeOutlet?->id;

        if ((string) ($activeOutlet?->outlet_type ?? '') === 'tenant') {
            return $this->renderTenantDashboard($activeOutlet);
        }

        $totalCategories = $outletId
            ? Product::query()
                ->whereHas('outletStocks', fn (Builder $query) => $query->where('outlet_id', $outletId))
                ->whereNotNull('category_id')
                ->distinct('category_id')
                ->count('category_id')
            : Category::count();
        $totalProducts = $outletId
            ? ProductOutletStock::query()
                ->where('outlet_id', $outletId)
                ->distinct('product_id')
                ->count('product_id')
            : Product::count();
        $transactionQuery = Transaction::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId));
        $detailQuery = TransactionDetail::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId));
        $transactionMetricRows = $this->transactionReturnImpactService->enrichTransactions(
            (clone $transactionQuery)->get(['id', 'created_at', 'grand_total', 'discount', 'customer_id'])
        );
        $activeTransactionMetricRows = $transactionMetricRows
            ->filter(fn ($row) => ! (bool) data_get($row, 'is_fully_returned', false))
            ->values();
        $totalTransactions = $activeTransactionMetricRows->count();
        $customerProfileSummary = ReportCustomerProfileMetrics::fromRows($activeTransactionMetricRows);
        $totalCustomers = $outletId
            ? (int) ($customerProfileSummary['active_customer_count'] ?? 0)
            : Customer::count();
        $totalRevenue = (int) $transactionMetricRows->sum('net_grand_total');
        $totalProfit = $this->calcOwnerProfit($outletId, null, null);
        $averageOrder = $totalTransactions > 0
            ? (int) round($totalRevenue / $totalTransactions)
            : 0;

        // Today's transactions using source timezone
        $todayStart = ReportTimezone::localDateStartInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());
        $todayEnd = ReportTimezone::localDateEndInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());
        $todayRows = $activeTransactionMetricRows->filter(function ($row) use ($todayStart, $todayEnd) {
            $createdAt = Carbon::parse(method_exists($row, 'getRawOriginal') ? $row->getRawOriginal('created_at') : $row->created_at);

            return $createdAt->greaterThanOrEqualTo($todayStart)
                && $createdAt->lessThanOrEqualTo($todayEnd);
        });
        $todayTransactions = $todayRows->count();
        $walkInTransactions = (int) ($customerProfileSummary['walk_in_count'] ?? 0);
        $memberTransactions = (int) ($customerProfileSummary['registered_customer_count'] ?? 0);

        // New: Today's Sales and Profit
        $todaySales = (int) $todayRows->sum('net_grand_total');
        $todayProfit = $this->calcOwnerProfit($outletId, $todayStart, $todayEnd);

        // Monthly targets using source timezone
        $monthlyTarget = Setting::get('monthly_sales_target', 0, $outletId);
        $monthlyProfitTarget = Setting::get('monthly_profit_target', 0, $outletId);
        $currentMonthStart = Carbon::now(ReportTimezone::displayTimezone())->startOfMonth()->setTimezone(ReportTimezone::sourceTimezone());
        $currentMonthEnd = Carbon::now(ReportTimezone::displayTimezone())->endOfMonth()->setTimezone(ReportTimezone::sourceTimezone());
        $currentMonthSales = (int) $transactionMetricRows
            ->filter(function ($row) use ($currentMonthStart, $currentMonthEnd) {
                $createdAt = Carbon::parse(method_exists($row, 'getRawOriginal') ? $row->getRawOriginal('created_at') : $row->created_at);

                return $createdAt->greaterThanOrEqualTo($currentMonthStart)
                    && $createdAt->lessThanOrEqualTo($currentMonthEnd);
            })
            ->sum('net_grand_total');
        $currentMonthProfit = $this->calcOwnerProfit($outletId, $currentMonthStart, $currentMonthEnd);

        // Revenue trend: last 12 days using source timezone boundaries
        $trendEnd = ReportTimezone::localDateEndInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());
        $trendStart = Carbon::parse($trendEnd)->subDays(11)->startOfDay()->setTimezone(ReportTimezone::sourceTimezone());
        $revenueTrend = $transactionMetricRows
            ->filter(function ($row) use ($trendStart, $trendEnd) {
                $createdAt = Carbon::parse(method_exists($row, 'getRawOriginal') ? $row->getRawOriginal('created_at') : $row->created_at);

                return $createdAt->greaterThanOrEqualTo($trendStart)
                    && $createdAt->lessThanOrEqualTo($trendEnd);
            })
            ->groupBy(fn ($row) => ReportTimezone::sourceDateKey(
                method_exists($row, 'getRawOriginal') ? $row->getRawOriginal('created_at') : $row->created_at
            ))
            ->sortKeys()
            ->take(-12)
            ->map(function ($rows, $date) {
                return [
                    'date' => $date,
                    'label' => Carbon::parse($date, ReportTimezone::timezone())->format('d M'),
                    'total' => (int) $rows->sum('net_grand_total'),
                ];
            })
            ->values();

        $topProducts = (clone $detailQuery)
            ->select('product_id', DB::raw('SUM(qty) as qty'), DB::raw('SUM(price) as total'))
            ->with('product:id,title,sku')
            ->groupBy('product_id')
            ->orderByDesc('qty')
            ->take(3)
            ->get()
            ->map(function ($detail) {
                return [
                    'name' => $detail->product?->title ?? 'Produk terhapus',
                    'sku' => $detail->product?->sku ?? '-',
                    'qty' => (int) $detail->qty,
                    'total' => (int) $detail->total,
                ];
            });

        // New: Low Stock Products (stock < 10)
        $lowStockProducts = Product::query()
            ->where('stock', '<', 10)
            ->orderBy('stock', 'asc')
            ->take(5)
            ->get(['title', 'image', 'stock'])
            ->map(fn ($product) => [
                'name' => $product->title,
                'stock' => (int) ($product->stock ?? 0),
                'image' => $product->image,
            ]);

        // New: Slow Moving Products (no sales in 30 days)
        $thirtyDaysAgo = Carbon::now()->subDays(30);
        $recentlySoldProductIds = (clone $detailQuery)->where('created_at', '>=', $thirtyDaysAgo)
            ->distinct()
            ->pluck('product_id');

        $slowMovingProducts = Product::whereNotIn('id', $recentlySoldProductIds)
            ->where('stock', '>', 0)
            ->take(5)
            ->get()
            ->map(function ($product) {
                return [
                    'name' => $product->title,
                    'stock' => (int) ($product->stock ?? 0),
                    'image' => $product->image,
                ];
            });

        $recentTransactions = $this->transactionReturnImpactService->enrichTransactions(
            Transaction::with('cashier:id,name', 'customer:id,name')
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->latest()
            ->take(5)
            ->get()
        )
            ->map(function ($transaction) {
                return [
                    'invoice' => $transaction->invoice,
                    'date' => ReportTimezone::formatSourceDateTime($transaction->getRawOriginal('created_at'), 'd M Y'),
                    'customer' => $transaction->customer?->name ?? '-',
                    'cashier' => $transaction->cashier?->name ?? '-',
                    'total' => (int) ($transaction->net_grand_total ?? $transaction->grand_total),
                ];
            });

        $customerNames = Customer::query()
            ->whereIn('id', $activeTransactionMetricRows->pluck('customer_id')->filter()->unique()->values())
            ->pluck('name', 'id');
        $topCustomers = $activeTransactionMetricRows
            ->whereNotNull('customer_id')
            ->groupBy('customer_id')
            ->map(function ($rows, $customerId) use ($customerNames) {
                return [
                    'name' => $customerNames->get((int) $customerId, 'Pelanggan'),
                    'orders' => $rows->count(),
                    'total' => (int) $rows->sum('net_grand_total'),
                ];
            })
            ->sortByDesc('total')
            ->take(5)
            ->values();

        $topLocations = Transaction::query()
            ->when($outletId, fn ($query) => $query->where('transactions.outlet_id', $outletId))
            ->join('customers', 'transactions.customer_id', '=', 'customers.id')
            ->select('customers.village_name', DB::raw('COUNT(*) as orders'))
            ->whereNotNull('customers.village_name')
            ->groupBy('customers.village_name')
            ->orderByDesc('orders')
            ->take(5)
            ->get()
            ->map(function ($row) {
                return [
                    'name' => $row->village_name ?? 'Lainnya',
                    'orders' => (int) $row->orders,
                ];
            });

        $activeShifts = CashierShift::query()
            ->with('user:id,name')
            ->open()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->latest('opened_at')
            ->take(5)
            ->get()
            ->map(function (CashierShift $shift) use ($cashierShiftService) {
                $summary = $cashierShiftService->calculateSummary($shift);

                return [
                    'id' => $shift->id,
                    'opened_at' => optional($shift->opened_at)?->toISOString(),
                    'opening_cash' => (int) $shift->opening_cash,
                    'expected_cash' => $summary['expected_cash'],
                    'transactions_count' => $summary['transactions_count'],
                    'cash_sales_total' => $summary['cash_sales_total'],
                    'user' => [
                        'id' => $shift->user?->id,
                        'name' => $shift->user?->name,
                    ],
                ];
            })
            ->values();

        $mainOutletsCount = Outlet::query()->where('outlet_type', 'main')->count();
        $tenantOutletsCount = Outlet::query()->where('outlet_type', 'tenant')->count();
        $warehouseOutletsCount = Outlet::query()->where('outlet_type', 'warehouse')->count();
        $stationCount = KitchenStation::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->count();
        $deviceCount = KitchenStationDevice::query()
            ->when($outletId, fn ($query) => $query->whereHas('kitchenStation', fn ($builder) => $builder->where('outlet_id', $outletId)))
            ->count();
        $tenantAssignedProductsCount = Product::query()->whereNotNull('tenant_outlet_id')->count();
        $productKitchenMappingsCount = ProductKitchenStationMapping::query()
            ->when($outletId, fn ($query) => $query->whereHas('kitchenStation', fn ($builder) => $builder->where('outlet_id', $outletId)))
            ->where('is_active', true)
            ->count();

        $onboardingChecklist = [
            [
                'key' => 'main_outlet',
                'title' => 'Buat outlet utama',
                'description' => 'Buat minimal satu main outlet sebagai pusat transaksi kasir dan konteks operasional.',
                'done' => $mainOutletsCount > 0,
                'count' => $mainOutletsCount,
                'href' => route('outlets.index'),
                'action_label' => 'Kelola Outlet & Tenant',
            ],
            [
                'key' => 'tenant_outlet',
                'title' => 'Buat tenant foodcourt',
                'description' => 'Tambahkan tenant jika model bisnis Anda memakai 1 kasir untuk banyak tenant dengan pendapatan terpisah.',
                'done' => $tenantOutletsCount > 0,
                'count' => $tenantOutletsCount,
                'href' => route('outlets.index'),
                'action_label' => 'Buat Tenant',
            ],
            [
                'key' => 'kitchen_station',
                'title' => 'Siapkan station dapur',
                'description' => 'Buat station seperti minuman, ayam, salad, grill, atau station lain yang dipakai operasional.',
                'done' => $stationCount > 0,
                'count' => $stationCount,
                'href' => route('settings.kitchen-devices.index'),
                'action_label' => 'Atur Kitchen Ops',
            ],
            [
                'key' => 'kitchen_device',
                'title' => 'Hubungkan screen atau printer',
                'description' => 'Tambahkan device untuk tiap station agar ticket bisa tampil di kitchen queue atau diarahkan ke printer.',
                'done' => $deviceCount > 0,
                'count' => $deviceCount,
                'href' => route('settings.kitchen-devices.index'),
                'action_label' => 'Tambah Device',
            ],
            [
                'key' => 'tenant_product',
                'title' => 'Petakan produk ke tenant',
                'description' => 'Untuk mode foodcourt, produk harus tahu tenant outlet yang menerima pendapatan dari item tersebut.',
                'done' => $tenantAssignedProductsCount > 0 || $tenantOutletsCount === 0,
                'count' => $tenantAssignedProductsCount,
                'href' => route('products.index'),
                'action_label' => 'Kelola Produk',
            ],
            [
                'key' => 'kitchen_mapping',
                'title' => 'Petakan produk ke station dapur',
                'description' => 'Agar ticket dapur terpecah otomatis, produk harus terhubung ke station kitchen yang sesuai.',
                'done' => $productKitchenMappingsCount > 0 || $stationCount === 0,
                'count' => $productKitchenMappingsCount,
                'href' => route('settings.kitchen-devices.index'),
                'action_label' => 'Cek Kitchen Mapping',
            ],
            [
                'key' => 'first_transaction',
                'title' => 'Lakukan transaksi pertama',
                'description' => 'Setelah outlet, tenant, dan kitchen siap, uji alur POS sampai ticket dan settlement muncul.',
                'done' => $totalTransactions > 0,
                'count' => $totalTransactions,
                'href' => route('transactions.index'),
                'action_label' => 'Mulai Transaksi',
            ],
            [
                'key' => 'pwa_device',
                'title' => 'Siapkan PWA & perangkat',
                'description' => 'Install aplikasi ke perangkat admin, kasir, atau tablet dapur agar operasional lebih cepat dan stabil.',
                'done' => false,
                'count' => 0,
                'href' => route('guides.pwa-setup'),
                'action_label' => 'Buka Setup PWA',
            ],
        ];

        $onboardingSummary = [
            'total' => count($onboardingChecklist),
            'completed' => collect($onboardingChecklist)->where('done', true)->count(),
            'main_outlets' => $mainOutletsCount,
            'tenant_outlets' => $tenantOutletsCount,
            'warehouses' => $warehouseOutletsCount,
        ];

        return Inertia::render('Dashboard/Index', [
            'totalCategories' => $totalCategories,
            'totalProducts' => $totalProducts,
            'totalTransactions' => $totalTransactions,
            'totalCustomers' => $totalCustomers,
            'revenueTrend' => $revenueTrend,
            'totalRevenue' => (int) $totalRevenue,
            'totalProfit' => (int) $totalProfit,
            'averageOrder' => (int) round($averageOrder),
            'todayTransactions' => (int) $todayTransactions,
            'walkInTransactions' => (int) $walkInTransactions,
            'memberTransactions' => (int) $memberTransactions,
            'todaySales' => (int) $todaySales,
            'todayProfit' => (int) $todayProfit,
            'monthlyTarget' => (int) $monthlyTarget,
            'monthlyProfitTarget' => (int) $monthlyProfitTarget,
            'currentMonthSales' => (int) $currentMonthSales,
            'currentMonthProfit' => (int) $currentMonthProfit,
            'topProducts' => $topProducts,
            'lowStockProducts' => $lowStockProducts,
            'slowMovingProducts' => $slowMovingProducts,
            'recentTransactions' => $recentTransactions,
            'topCustomers' => $topCustomers,
            'topLocations' => $topLocations,
            'activeShifts' => $activeShifts,
            'onboardingChecklist' => $onboardingChecklist,
            'onboardingSummary' => $onboardingSummary,
            'workspace' => [
                'is_tenant_dashboard' => false,
                'active_outlet' => $activeOutlet ? [
                    'id' => $activeOutlet->id,
                    'name' => $activeOutlet->name,
                    'code' => $activeOutlet->code,
                    'outlet_type' => $activeOutlet->outlet_type,
                ] : null,
            ],
        ]);
    }

    private function renderTenantDashboard(Outlet $tenantOutlet): \Inertia\Response
    {
        $tenantOutletId = (int) $tenantOutlet->id;
        $allocationQuery = TransactionTenantAllocation::query()
            ->with(['transaction.cashier:id,name', 'transaction.customer:id,name'])
            ->where('tenant_outlet_id', $tenantOutletId);

        $metricAllocations = (clone $allocationQuery)->get();
        $allocationIds = (clone $allocationQuery)->pluck('id');
        $transactionIds = (clone $allocationQuery)->pluck('transaction_id')->filter()->unique();

        $totalCategories = Product::query()
            ->where('tenant_outlet_id', $tenantOutletId)
            ->whereNotNull('category_id')
            ->distinct('category_id')
            ->count('category_id');
        $totalProducts = Product::query()->where('tenant_outlet_id', $tenantOutletId)->count();
        $totalTransactions = (clone $allocationQuery)->count();
        $customerProfileSummary = ReportCustomerProfileMetrics::fromRows(
            $metricAllocations,
            'transaction.customer_id'
        );
        $totalCustomers = (int) ($customerProfileSummary['active_customer_count'] ?? 0);
        $totalRevenue = (int) ((clone $allocationQuery)->sum('grand_total') ?? 0);
        $totalCost = $this->sumTenantAllocationCost($allocationIds);
        $totalProfit = max(0, $totalRevenue - $totalCost);
        $averageOrder = $totalTransactions > 0 ? (int) round($totalRevenue / $totalTransactions) : 0;

        // Today's using source timezone
        $todayStart = ReportTimezone::localDateStartInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());
        $todayEnd = ReportTimezone::localDateEndInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());
        $todayQuery = (clone $allocationQuery)->whereHas('transaction', fn (Builder $query) => $query->where('created_at', '>=', $todayStart)->where('created_at', '<=', $todayEnd));
        $todayTransactions = (clone $todayQuery)->count();
        $todaySales = (int) ((clone $todayQuery)->sum('grand_total') ?? 0);
        $todayProfit = max(0, $todaySales - $this->sumTenantAllocationCost((clone $todayQuery)->pluck('id')));
        $walkInTransactions = (int) ($customerProfileSummary['walk_in_count'] ?? 0);
        $memberTransactions = (int) ($customerProfileSummary['registered_customer_count'] ?? 0);

        $monthlyTarget = Setting::get('monthly_sales_target', 0, $tenantOutletId);
        $monthlyProfitTarget = Setting::get('monthly_profit_target', 0, $tenantOutletId);
        $currentMonthStart = Carbon::now(ReportTimezone::displayTimezone())->startOfMonth()->setTimezone(ReportTimezone::sourceTimezone());
        $currentMonthEnd = Carbon::now(ReportTimezone::displayTimezone())->endOfMonth()->setTimezone(ReportTimezone::sourceTimezone());
        $currentMonthQuery = (clone $allocationQuery)
            ->whereHas('transaction', function (Builder $query) use ($currentMonthStart, $currentMonthEnd) {
                $query->where('created_at', '>=', $currentMonthStart)
                    ->where('created_at', '<=', $currentMonthEnd);
            });
        $currentMonthSales = (int) ((clone $currentMonthQuery)->sum('grand_total') ?? 0);
        $currentMonthProfit = max(0, $currentMonthSales - $this->sumTenantAllocationCost((clone $currentMonthQuery)->pluck('id')));

        // Revenue trend: last 12 days using source timezone boundaries
        $trendEnd = ReportTimezone::localDateEndInSourceTz(now(ReportTimezone::displayTimezone())->toDateString());
        $trendStart = Carbon::parse($trendEnd)->subDays(11)->startOfDay()->setTimezone(ReportTimezone::sourceTimezone());
        $revenueTrend = TransactionTenantAllocation::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_tenant_allocations.transaction_id')
            ->where('transaction_tenant_allocations.tenant_outlet_id', $tenantOutletId)
            ->where('transactions.created_at', '>=', $trendStart)
            ->where('transactions.created_at', '<=', $trendEnd)
            ->selectRaw(ReportTimezone::sourceToDisplayDateExpression('transactions.created_at')." as date, COALESCE(SUM(transaction_tenant_allocations.grand_total), 0) as total")
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->take(12)
            ->get()
            ->map(fn ($row) => [
                'date' => $row->date,
                'label' => Carbon::parse($row->date, ReportTimezone::timezone())->format('d M'),
                'total' => (int) $row->total,
            ])
            ->values();

        $topProducts = TransactionTenantAllocationItem::query()
            ->select('product_id', DB::raw('SUM(qty) as qty'), DB::raw('SUM(line_total) as total'))
            ->with('product:id,title,sku')
            ->whereIn('transaction_tenant_allocation_id', $allocationIds)
            ->groupBy('product_id')
            ->orderByDesc('qty')
            ->take(3)
            ->get()
            ->map(fn ($detail) => [
                'name' => $detail->product?->title ?? 'Produk terhapus',
                'sku' => $detail->product?->sku ?? '-',
                'qty' => (int) $detail->qty,
                'total' => (int) $detail->total,
            ]);

        $lowStockProducts = Product::query()
            ->where('tenant_outlet_id', $tenantOutletId)
            ->where('stock', '<', 10)
            ->orderBy('stock', 'asc')
            ->take(5)
            ->get(['title', 'image', 'stock'])
            ->map(fn ($product) => [
                'name' => $product->title,
                'stock' => (int) ($product->stock ?? 0),
                'image' => $product->image,
            ]);

        $thirtyDaysAgo = Carbon::now()->subDays(30);
        $recentlySoldProductIds = TransactionTenantAllocation::query()
            ->where('transaction_tenant_allocations.tenant_outlet_id', $tenantOutletId)
            ->whereHas('transaction', fn (Builder $query) => $query->where('created_at', '>=', $thirtyDaysAgo))
            ->join('transaction_tenant_allocation_items', 'transaction_tenant_allocation_items.transaction_tenant_allocation_id', '=', 'transaction_tenant_allocations.id')
            ->distinct()
            ->pluck('transaction_tenant_allocation_items.product_id');

        $slowMovingProducts = Product::query()
            ->where('tenant_outlet_id', $tenantOutletId)
            ->whereNotIn('id', $recentlySoldProductIds)
            ->where('stock', '>', 0)
            ->take(5)
            ->get()
            ->map(fn ($product) => [
                'name' => $product->title,
                'stock' => (int) ($product->stock ?? 0),
                'image' => $product->image,
            ]);

        $recentTransactions = TransactionTenantAllocation::query()
            ->with('transaction.cashier:id,name', 'transaction.customer:id,name')
            ->where('tenant_outlet_id', $tenantOutletId)
            ->latest('created_at')
            ->take(5)
            ->get()
            ->map(function (TransactionTenantAllocation $allocation) {
                return [
                    'invoice' => $allocation->transaction?->invoice ?? $allocation->allocation_number,
                    'date' => $allocation->transaction?->created_at
                        ? ReportTimezone::formatSourceDateTime($allocation->transaction->getRawOriginal('created_at'), 'd M Y')
                        : null,
                    'customer' => $allocation->transaction?->customer?->name ?? '-',
                    'cashier' => $allocation->transaction?->cashier?->name ?? '-',
                    'total' => (int) ($allocation->grand_total ?? 0),
                ];
            });

        $topCustomers = TransactionTenantAllocation::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_tenant_allocations.transaction_id')
            ->leftJoin('customers', 'transactions.customer_id', '=', 'customers.id')
            ->where('transaction_tenant_allocations.tenant_outlet_id', $tenantOutletId)
            ->whereNotNull('transactions.customer_id')
            ->selectRaw('transactions.customer_id, MAX(customers.name) as customer_name, COUNT(*) as orders, COALESCE(SUM(transaction_tenant_allocations.grand_total), 0) as total')
            ->groupBy('transactions.customer_id')
            ->orderByDesc('total')
            ->take(5)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->customer_name ?? 'Pelanggan',
                'orders' => (int) $row->orders,
                'total' => (int) $row->total,
            ]);

        $topLocations = TransactionTenantAllocation::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_tenant_allocations.transaction_id')
            ->join('customers', 'transactions.customer_id', '=', 'customers.id')
            ->where('transaction_tenant_allocations.tenant_outlet_id', $tenantOutletId)
            ->select('customers.village_name', DB::raw('COUNT(*) as orders'))
            ->whereNotNull('customers.village_name')
            ->groupBy('customers.village_name')
            ->orderByDesc('orders')
            ->take(5)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->village_name ?? 'Lainnya',
                'orders' => (int) $row->orders,
            ]);

        return Inertia::render('Dashboard/Index', [
            'totalCategories' => $totalCategories,
            'totalProducts' => $totalProducts,
            'totalTransactions' => $totalTransactions,
            'totalCustomers' => $totalCustomers,
            'revenueTrend' => $revenueTrend,
            'totalRevenue' => $totalRevenue,
            'totalProfit' => $totalProfit,
            'averageOrder' => $averageOrder,
            'todayTransactions' => (int) $todayTransactions,
            'walkInTransactions' => (int) $walkInTransactions,
            'memberTransactions' => (int) $memberTransactions,
            'todaySales' => $todaySales,
            'todayProfit' => $todayProfit,
            'monthlyTarget' => (int) $monthlyTarget,
            'monthlyProfitTarget' => (int) $monthlyProfitTarget,
            'currentMonthSales' => $currentMonthSales,
            'currentMonthProfit' => $currentMonthProfit,
            'topProducts' => $topProducts,
            'lowStockProducts' => $lowStockProducts,
            'slowMovingProducts' => $slowMovingProducts,
            'recentTransactions' => $recentTransactions,
            'topCustomers' => $topCustomers,
            'topLocations' => $topLocations,
            'activeShifts' => [],
            'onboardingChecklist' => [],
            'onboardingSummary' => ['total' => 0, 'completed' => 0],
            'workspace' => [
                'is_tenant_dashboard' => true,
                'active_outlet' => [
                    'id' => $tenantOutlet->id,
                    'name' => $tenantOutlet->name,
                    'code' => $tenantOutlet->code,
                    'outlet_type' => $tenantOutlet->outlet_type,
                ],
            ],
        ]);
    }

    /**
     * Profit owner dari dashboard utama (bukan tenant).
     *
     * Dua sumber:
     * 1. SUM(owner_net_total) dari transaction_details yang punya tenant_outlet_id
     *    → sudah mencakup markup owner produk tenant + markup topping tenant,
     *      setelah diskon owner level item
     * 2. SUM(profits.total) dari transaksi yang TIDAK punya detail tenant sama sekali
     *    → profit HPP normal produk milik owner sendiri
     *
     * Periode opsional: jika $start/$end diisi, query di-filter by created_at.
     */
    private function calcOwnerProfit(?int $outletId, $start, $end): int
    {
        // owner_net_total pada detail tenant sudah termasuk split markup topping
        $tenantDetailQuery = TransactionDetail::query()
            ->whereNotNull('tenant_outlet_id')
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->when($start, fn ($q) => $q->where('transaction_details.created_at', '>=', $start))
            ->when($end, fn ($q) => $q->where('transaction_details.created_at', '<=', $end));

        $tenantMarkupProfit = (int) ($tenantDetailQuery->sum('owner_net_total') ?? 0);

        // profit HPP dari transaksi yang tidak punya item tenant sama sekali
        $pureOwnerTransactionIds = Transaction::query()
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->whereDoesntHave('details', fn ($q) => $q->whereNotNull('tenant_outlet_id'))
            ->pluck('id');

        $pureOwnerProfitQuery = Profit::query()
            ->whereIn('transaction_id', $pureOwnerTransactionIds)
            ->when($start, fn ($q) => $q->where('created_at', '>=', $start))
            ->when($end, fn ($q) => $q->where('created_at', '<=', $end));

        $pureOwnerProfit = (int) ($pureOwnerProfitQuery->sum('total') ?? 0);

        return $tenantMarkupProfit + $pureOwnerProfit;
    }

    private function sumTenantAllocationCost($allocationIds): int
    {
        if (blank($allocationIds) || collect($allocationIds)->isEmpty()) {
            return 0;
        }

        return (int) (TransactionTenantAllocationItem::query()
            ->whereIn('transaction_tenant_allocation_id', collect($allocationIds))
            ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0) as total_cost')
            ->value('total_cost') ?? 0);
    }
}
