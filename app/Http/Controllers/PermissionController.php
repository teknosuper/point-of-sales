<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'group' => (string) $request->input('group', ''),
            'per_page' => (int) $request->input('per_page', 20),
        ];

        $allowedPerPage = [15, 20, 30, 50, 100];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 20;
        }

        $permissions = Permission::query()
            ->when($filters['search'] !== '', fn ($query) => $query->where('name', 'like', '%'.$filters['search'].'%'))
            ->when($filters['group'] !== '', fn ($query) => $this->applyGroupFilter($query, $filters['group']))
            ->select('id', 'name')
            ->orderBy('name')
            ->paginate($filters['per_page'])
            ->withQueryString();

        $groupCounts = Permission::query()
            ->select('id', 'name')
            ->orderBy('name')
            ->get()
            ->map(fn (Permission $permission) => $this->mapPermissionGroup($permission->name))
            ->countBy()
            ->map(fn ($count, $group) => [
                'key' => $group,
                'count' => $count,
                'label' => $this->mapPermissionGroupLabel($group),
            ])
            ->values()
            ->sortBy('label', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        return Inertia::render('Dashboard/Permissions/Index', [
            'permissions' => $permissions,
            'filters' => $filters,
            'groupCounts' => $groupCounts,
            'groupOptions' => $groupCounts->values()->all(),
            'perPageOptions' => $allowedPerPage,
        ]);
    }

    public function wizard(Request $request): RedirectResponse
    {
        return redirect()
            ->route('roles.index')
            ->with('info', 'Template role sudah dihapus. Kelola akses langsung dari role dan permission.');
    }

    private function applyGroupFilter($query, string $group)
    {
        return match ($group) {
            'dashboard' => $query->where('name', 'dashboard-access'),
            'users' => $query->where('name', 'like', 'users-%'),
            'roles' => $query->where('name', 'like', 'roles-%'),
            'permissions' => $query->where('name', 'like', 'permissions-%'),
            'categories' => $query->where('name', 'like', 'categories-%'),
            'products' => $query->where('name', 'like', 'products-%'),
            'pricing' => $query->where('name', 'like', 'pricing-rules-%'),
            'outlets' => $query->where('name', 'like', 'outlets-%'),
            'customers' => $query->where(function ($builder) {
                $builder
                    ->where('name', 'like', 'customers-%')
                    ->orWhere('name', 'like', 'customer-vouchers-%')
                    ->orWhere('name', 'like', 'customer-segments-%')
                    ->orWhere('name', 'like', 'crm-%');
            }),
            'transactions' => $query->where(function ($builder) {
                $builder
                    ->where('name', 'like', 'transactions-%')
                    ->orWhere('name', 'like', 'dining-tables-%')
                    ->orWhere('name', 'like', 'cashier-settlements-%');
            }),
            'finance' => $query->where(function ($builder) {
                $builder
                    ->where('name', 'like', 'receivables-%')
                    ->orWhere('name', 'like', 'payables-%')
                    ->orWhere('name', 'like', 'suppliers-%');
            }),
            'reports' => $query->where(function ($builder) {
                $builder
                    ->where('name', 'like', 'reports-%')
                    ->orWhere('name', 'like', 'profits-%');
            }),
            'settings' => $query->where(function ($builder) {
                $builder
                    ->where('name', 'like', 'payment-settings-%')
                    ->orWhere('name', 'like', 'business-settings-%');
            }),
            'inventory' => $query->where(function ($builder) {
                $builder
                    ->where('name', 'like', 'stock-opnames-%')
                    ->orWhere('name', 'like', 'stock-mutations-%');
            }),
            'returns' => $query->where('name', 'like', 'sales-returns-%'),
            'shifts' => $query->where('name', 'like', 'cashier-shifts-%'),
            'audit' => $query->where('name', 'like', 'audit-logs-%'),
            'purchasing' => $query->where(function ($builder) {
                $builder
                    ->where('name', 'like', 'purchase-orders-%')
                    ->orWhere('name', 'like', 'goods-receivings-%')
                    ->orWhere('name', 'like', 'supplier-returns-%');
            }),
            'kitchen' => $query->where(function ($builder) {
                $builder
                    ->where('name', 'like', 'kitchen-%')
                    ->orWhere('name', 'waiter-board-access')
                    ->orWhere('name', 'table-orders-access')
                    ->orWhere('name', 'table-orders-approve');
            }),
            default => $query,
        };
    }

    private function mapPermissionGroup(string $name): string
    {
        return match (true) {
            str_starts_with($name, 'users-') => 'users',
            str_starts_with($name, 'roles-') => 'roles',
            str_starts_with($name, 'permissions-') => 'permissions',
            str_starts_with($name, 'categories-') => 'categories',
            str_starts_with($name, 'products-') => 'products',
            str_starts_with($name, 'pricing-rules-') => 'pricing',
            str_starts_with($name, 'outlets-') => 'outlets',
            str_starts_with($name, 'customers-'),
            str_starts_with($name, 'customer-vouchers-'),
            str_starts_with($name, 'customer-segments-'),
            str_starts_with($name, 'crm-') => 'customers',
            str_starts_with($name, 'transactions-'),
            str_starts_with($name, 'dining-tables-'),
            str_starts_with($name, 'cashier-settlements-') => 'transactions',
            str_starts_with($name, 'receivables-'),
            str_starts_with($name, 'payables-'),
            str_starts_with($name, 'suppliers-') => 'finance',
            str_starts_with($name, 'reports-'),
            str_starts_with($name, 'profits-') => 'reports',
            str_starts_with($name, 'payment-settings-'),
            str_starts_with($name, 'business-settings-') => 'settings',
            str_starts_with($name, 'stock-opnames-'),
            str_starts_with($name, 'stock-mutations-') => 'inventory',
            str_starts_with($name, 'sales-returns-') => 'returns',
            str_starts_with($name, 'cashier-shifts-') => 'shifts',
            str_starts_with($name, 'audit-logs-') => 'audit',
            str_starts_with($name, 'purchase-orders-'),
            str_starts_with($name, 'goods-receivings-'),
            str_starts_with($name, 'supplier-returns-') => 'purchasing',
            $name === 'dashboard-access' => 'dashboard',
            str_starts_with($name, 'kitchen-'),
            $name === 'waiter-board-access',
            str_starts_with($name, 'table-orders-') => 'kitchen',
            default => 'other',
        };
    }

    private function mapPermissionGroupLabel(string $group): string
    {
        return match ($group) {
            'dashboard' => 'Dashboard',
            'users' => 'Pengguna',
            'roles' => 'Group Akses',
            'permissions' => 'Daftar Izin',
            'categories' => 'Kategori',
            'products' => 'Produk',
            'pricing' => 'Harga dan Promo',
            'outlets' => 'Outlet dan Tenant',
            'customers' => 'Pelanggan dan CRM',
            'transactions' => 'POS dan Operasional',
            'finance' => 'Piutang dan Hutang',
            'reports' => 'Laporan',
            'settings' => 'Pengaturan',
            'inventory' => 'Stok dan Gudang',
            'returns' => 'Retur',
            'shifts' => 'Shift Kasir',
            'audit' => 'Audit',
            'purchasing' => 'Pembelian',
            'kitchen' => 'Dapur dan Antar',
            default => 'Lainnya',
        };
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
