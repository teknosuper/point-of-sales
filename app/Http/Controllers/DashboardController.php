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
use App\Services\CashierShiftService;
use App\Services\OutletResolver;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(CashierShiftService $cashierShiftService)
    {
        $outletId = $this->outletResolver->resolve(request(), request()->user())?->id;
        $totalCategories = Category::count();
        $totalProducts = $outletId
            ? Product::whereHas('outletStocks', fn ($query) => $query->where('outlet_id', $outletId))->count()
            : Product::count();
        $transactionQuery = Transaction::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId));
        $profitQuery = Profit::query()
            ->when($outletId, fn ($query) => $query->whereHas('transaction', fn ($builder) => $builder->where('outlet_id', $outletId)));
        $detailQuery = TransactionDetail::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId));
        $totalTransactions = (clone $transactionQuery)->count();
        $totalCustomers = Customer::count();
        $totalRevenue = (clone $transactionQuery)->sum('grand_total');
        $totalProfit = (clone $profitQuery)->sum('total');
        $averageOrder = (clone $transactionQuery)->avg('grand_total') ?? 0;
        $todayTransactions = (clone $transactionQuery)->whereDate('created_at', Carbon::today())->count();
        $walkInTransactions = (clone $transactionQuery)->whereNull('customer_id')->count();
        $memberTransactions = max(0, $totalTransactions - $walkInTransactions);

        // New: Today's Sales and Profit
        $todaySales = (clone $transactionQuery)->whereDate('created_at', Carbon::today())->sum('grand_total');
        $todayProfit = (clone $profitQuery)->whereDate('created_at', Carbon::today())->sum('total');

        // New: Monthly Target (from settings)
        $monthlyTarget = Setting::get('monthly_sales_target', 0, $outletId);
        $currentMonthSales = (clone $transactionQuery)->whereMonth('created_at', Carbon::now()->month)
            ->whereYear('created_at', Carbon::now()->year)
            ->sum('grand_total');

        $revenueTrend = Transaction::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->selectRaw('DATE(created_at) as date, SUM(grand_total) as total')
            ->groupBy('date')
            ->orderBy('date', 'desc')
            ->take(12)
            ->get()
            ->map(function ($row) {
                return [
                    'date' => $row->date,
                    'label' => Carbon::parse($row->date)->format('d M'),
                    'total' => (int) $row->total,
                ];
            })
            ->reverse()
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
        $lowStockProducts = $outletId
            ? ProductOutletStock::query()
                ->with('product:id,title,image')
                ->where('outlet_id', $outletId)
                ->where('stock', '<', 10)
                ->orderBy('stock', 'asc')
                ->take(5)
                ->get()
                ->map(fn ($stock) => [
                    'name' => $stock->product?->title ?? 'Produk',
                    'stock' => (int) $stock->stock,
                    'image' => $stock->product?->image,
                ])
            : Product::where('stock', '<', 10)
                ->orderBy('stock', 'asc')
                ->take(5)
                ->get()
                ->map(function ($product) {
                    return [
                        'name' => $product->title,
                        'stock' => (int) $product->stock,
                        'image' => $product->image,
                    ];
                });

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
                    'stock' => (int) $product->stock,
                    'image' => $product->image,
                ];
            });

        $recentTransactions = Transaction::with('cashier:id,name', 'customer:id,name')
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->latest()
            ->take(5)
            ->get()
            ->map(function ($transaction) {
                return [
                    'invoice' => $transaction->invoice,
                    'date' => Carbon::parse($transaction->created_at)->format('d M Y'),
                    'customer' => $transaction->customer?->name ?? '-',
                    'cashier' => $transaction->cashier?->name ?? '-',
                    'total' => (int) $transaction->grand_total,
                ];
            });

        $topCustomers = Transaction::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->select('customer_id', DB::raw('COUNT(*) as orders'), DB::raw('SUM(grand_total) as total'))
            ->with('customer:id,name')
            ->whereNotNull('customer_id')
            ->groupBy('customer_id')
            ->orderByDesc('total')
            ->take(5)
            ->get()
            ->map(function ($row) {
                return [
                    'name' => $row->customer?->name ?? 'Pelanggan',
                    'orders' => (int) $row->orders,
                    'total' => (int) $row->total,
                ];
            });

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
            'currentMonthSales' => (int) $currentMonthSales,
            'topProducts' => $topProducts,
            'lowStockProducts' => $lowStockProducts,
            'slowMovingProducts' => $slowMovingProducts,
            'recentTransactions' => $recentTransactions,
            'topCustomers' => $topCustomers,
            'topLocations' => $topLocations,
            'activeShifts' => $activeShifts,
            'onboardingChecklist' => $onboardingChecklist,
            'onboardingSummary' => $onboardingSummary,
        ]);
    }
}
