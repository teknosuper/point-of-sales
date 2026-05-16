<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStationDevice;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class OutletManagementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if ($user?->isKitchenWorkspace()) {
            return redirect()
                ->route('settings.kitchen-devices.index')
                ->with('warning', 'Akun dapur tidak memakai manajemen outlet penuh. Gunakan menu operasional dapur.');
        }

        $lockedKitchenOutletId = $user?->isKitchenWorkspace() && $user->preferredKitchenStation?->outlet_id
            ? (int) $user->preferredKitchenStation->outlet_id
            : null;
        $accessibleOutletIds = $user && ! $user->isSuperAdmin()
            ? $user->outlets()->pluck('outlets.id')->map(fn ($id) => (int) $id)
            : null;

        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'status' => (string) $request->input('status', ''),
            'outlet_type' => (string) $request->input('outlet_type', ''),
            'default_only' => (string) $request->input('default_only', ''),
            'per_page' => (int) $request->input('per_page', 10),
        ];

        $allowedPerPage = [10, 25, 50, 100];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 10;
        }

        $outlets = Outlet::query()
            ->with(['users:id,name,email'])
            ->withCount(['users', 'transactions', 'kitchenStations'])
            ->when($lockedKitchenOutletId, fn ($query) => $query->where('id', $lockedKitchenOutletId))
            ->when(
                ! $lockedKitchenOutletId && $accessibleOutletIds,
                fn ($query) => $query->whereIn('id', $accessibleOutletIds)
            )
            ->when($filters['search'] !== '', function ($query) use ($filters) {
                $search = $filters['search'];
                $query->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('name', 'like', '%'.$search.'%')
                        ->orWhere('code', 'like', '%'.$search.'%')
                        ->orWhere('city', 'like', '%'.$search.'%')
                        ->orWhere('phone', 'like', '%'.$search.'%')
                        ->orWhere('email', 'like', '%'.$search.'%');
                });
            })
            ->when($filters['status'] !== '', function ($query) use ($filters) {
                return match ($filters['status']) {
                    'active' => $query->where('is_active', true),
                    'inactive' => $query->where('is_active', false),
                    default => $query,
                };
            })
            ->when($filters['outlet_type'] !== '', fn ($query) => $query->where('outlet_type', $filters['outlet_type']))
            ->when($filters['default_only'] === 'yes', fn ($query) => $query->where('is_default', true))
            ->ordered()
            ->paginate($filters['per_page'])
            ->withQueryString();

        $summaryOutletQuery = Outlet::query()
            ->when($lockedKitchenOutletId, fn ($query) => $query->where('id', $lockedKitchenOutletId))
            ->when(
                ! $lockedKitchenOutletId && $accessibleOutletIds,
                fn ($query) => $query->whereIn('id', $accessibleOutletIds)
            );

        $tenantOutletIds = (clone $summaryOutletQuery)
            ->where('outlet_type', 'tenant')
            ->pluck('id');

        $summary = [
            'total' => (clone $summaryOutletQuery)->count(),
            'active' => (clone $summaryOutletQuery)->where('is_active', true)->count(),
            'inactive' => (clone $summaryOutletQuery)->where('is_active', false)->count(),
            'default' => (clone $summaryOutletQuery)->where('is_default', true)->count(),
            'main' => (clone $summaryOutletQuery)->where('outlet_type', 'main')->count(),
            'tenant' => (clone $summaryOutletQuery)->where('outlet_type', 'tenant')->count(),
            'warehouse' => (clone $summaryOutletQuery)->where('outlet_type', 'warehouse')->count(),
            'tenant_products' => $tenantOutletIds->isNotEmpty()
                ? Product::whereIn('tenant_outlet_id', $tenantOutletIds)->count()
                : 0,
        ];

        $setupStatus = [
            'has_main_outlet' => $summary['main'] > 0,
            'has_tenant_outlet' => $summary['tenant'] > 0,
            'has_default_outlet' => $summary['default'] > 0,
            'has_tenant_products' => $summary['tenant_products'] > 0 || $summary['tenant'] === 0,
        ];

        return Inertia::render('Dashboard/Outlets/Index', [
            'outlets' => $outlets,
            'filters' => $filters,
            'summary' => $summary,
            'setupStatus' => $setupStatus,
            'ui' => [
                'show_form' => $request->boolean('create'),
                'preset_outlet_type' => $request->input('outlet_type'),
            ],
            'meta' => [
                'per_page_options' => $allowedPerPage,
                'users' => User::query()->orderBy('name')->get(['id', 'name', 'email']),
                'outlet_types' => [
                    ['value' => 'main', 'label' => 'Main Outlet'],
                    ['value' => 'tenant', 'label' => 'Tenant Foodcourt'],
                    ['value' => 'warehouse', 'label' => 'Warehouse / Support'],
                ],
            ],
        ]);
    }

    public function show(Request $request, Outlet $outlet)
    {
        $user = $request->user();

        if ($user?->isKitchenWorkspace()) {
            return redirect()
                ->route('settings.kitchen-devices.index')
                ->with('warning', 'Akun dapur tidak memakai detail outlet penuh. Gunakan menu operasional dapur.');
        }

        if ($user && ! $user->isSuperAdmin()) {
            $lockedKitchenOutletId = $user->isKitchenWorkspace() && $user->preferredKitchenStation?->outlet_id
                ? (int) $user->preferredKitchenStation->outlet_id
                : null;

            if ($lockedKitchenOutletId) {
                abort_unless((int) $outlet->id === $lockedKitchenOutletId, 403);
            } else {
                abort_unless($user->hasAccessToOutlet((int) $outlet->id), 403);
            }
        }

        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
        ];

        $transactionQuery = Transaction::query()->where('outlet_id', $outlet->id);
        $detailQuery = TransactionDetail::query()->where('outlet_id', $outlet->id);
        $allocationBaseQuery = TransactionTenantAllocation::query()
            ->where(function ($query) use ($outlet) {
                $query
                    ->where('outlet_id', $outlet->id)
                    ->orWhere('tenant_outlet_id', $outlet->id);
            });

        if ($filters['start_date']) {
            $transactionQuery->whereDate('created_at', '>=', $filters['start_date']);
            $detailQuery->whereHas('transaction', fn ($query) => $query->whereDate('created_at', '>=', $filters['start_date']));
            $allocationBaseQuery->whereHas('transaction', fn ($query) => $query->whereDate('created_at', '>=', $filters['start_date']));
        }

        if ($filters['end_date']) {
            $transactionQuery->whereDate('created_at', '<=', $filters['end_date']);
            $detailQuery->whereHas('transaction', fn ($query) => $query->whereDate('created_at', '<=', $filters['end_date']));
            $allocationBaseQuery->whereHas('transaction', fn ($query) => $query->whereDate('created_at', '<=', $filters['end_date']));
        }

        $summary = [
            'transactions_total' => (clone $transactionQuery)->count(),
            'revenue_total' => (int) ((clone $transactionQuery)->sum('grand_total') ?? 0),
            'items_sold' => (int) ((clone $detailQuery)->sum('qty') ?? 0),
            'users_total' => $outlet->users()->count(),
            'stations_total' => $outlet->kitchenStations()->count(),
            'devices_total' => KitchenStationDevice::query()
                ->whereHas('kitchenStation', fn ($query) => $query->where('outlet_id', $outlet->id))
                ->count(),
            'settled_total' => (int) ((clone $allocationBaseQuery)->whereNotNull('settled_at')->sum('grand_total') ?? 0),
            'outstanding_total' => (int) ((clone $allocationBaseQuery)->whereNull('settled_at')->sum('grand_total') ?? 0),
        ];

        $recentTransactions = (clone $transactionQuery)
            ->with(['cashier:id,name', 'customer:id,name'])
            ->latest()
            ->limit(10)
            ->get(['id', 'invoice', 'cashier_id', 'customer_id', 'grand_total', 'payment_status', 'created_at']);

        $stations = $outlet->kitchenStations()
            ->with(['devices'])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $recentAllocations = (clone $allocationBaseQuery)
            ->with(['tenantOutlet:id,name,code', 'transaction:id,invoice,created_at'])
            ->latest()
            ->limit(10)
            ->get([
                'id',
                'transaction_id',
                'tenant_outlet_id',
                'allocation_number',
                'grand_total',
                'payment_status',
                'settled_at',
                'payout_reference',
                'payout_paid_at',
                'created_at',
            ]);

        $tenantBreakdown = collect();
        $tenantSettlement = null;

        if ($outlet->outlet_type === 'tenant') {
            $tenantAllocations = (clone $allocationBaseQuery)
                ->where('tenant_outlet_id', $outlet->id)
                ->select('transaction_tenant_allocations.*')
                ->selectSub(
                    TransactionTenantAllocationItem::query()
                        ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0)')
                        ->whereColumn('transaction_tenant_allocation_id', 'transaction_tenant_allocations.id'),
                    'cost_total'
                )
                ->get();

            $revenueTotal = (int) $tenantAllocations->sum('grand_total');
            $costTotal = (int) $tenantAllocations->sum('cost_total');
            $profitTotal = $revenueTotal - $costTotal;
            $commissionRate = (float) ($outlet->commission_rate_percent ?? 0);
            $managementFeeTotal = (int) round(max(0, $profitTotal) * ($commissionRate / 100));

            $tenantSettlement = [
                'orders_count' => $tenantAllocations->count(),
                'revenue_total' => $revenueTotal,
                'cost_total' => $costTotal,
                'profit_total' => $profitTotal,
                'management_fee_total' => $managementFeeTotal,
                'payout_total' => $profitTotal - $managementFeeTotal,
                'outstanding_total' => (int) $tenantAllocations->whereNull('settled_at')->sum('grand_total'),
            ];
        } else {
            $tenantBreakdown = TransactionTenantAllocation::query()
                ->where('outlet_id', $outlet->id)
                ->with(['tenantOutlet:id,name,code'])
                ->selectRaw('tenant_outlet_id, COUNT(*) as orders_count, COALESCE(SUM(grand_total), 0) as revenue_total')
                ->groupBy('tenant_outlet_id')
                ->orderByDesc('revenue_total')
                ->get()
                ->map(function ($row) {
                    return [
                        'tenant_outlet_id' => $row->tenant_outlet_id,
                        'tenant_name' => $row->tenantOutlet?->name ?? 'Tenant',
                        'tenant_code' => $row->tenantOutlet?->code ?? '-',
                        'orders_count' => (int) $row->orders_count,
                        'revenue_total' => (int) $row->revenue_total,
                    ];
                });
        }

        return Inertia::render('Dashboard/Outlets/Show', [
            'outlet' => $outlet->load(['users:id,name,email', 'kitchenStations.devices']),
            'filters' => $filters,
            'summary' => $summary,
            'recentTransactions' => $recentTransactions,
            'recentAllocations' => $recentAllocations,
            'stations' => $stations,
            'tenantBreakdown' => $tenantBreakdown,
            'tenantSettlement' => $tenantSettlement,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:outlets,code'],
            'name' => ['required', 'string', 'max:150'],
            'outlet_type' => ['required', 'string', 'in:main,tenant,warehouse'],
            'legal_name' => ['nullable', 'string', 'max:150'],
            'city' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:150'],
            'website' => ['nullable', 'string', 'max:150'],
            'address' => ['nullable', 'string'],
            'commission_rate_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'primary_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        if (($data['is_default'] ?? false) === true) {
            Outlet::query()->update(['is_default' => false]);
        }

        $outlet = Outlet::create([
            ...$data,
            'slug' => Str::slug($data['name'].'-'.$data['code']),
            'is_active' => (bool) ($data['is_active'] ?? true),
            'is_default' => (bool) ($data['is_default'] ?? false),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'commission_rate_percent' => round((float) ($data['commission_rate_percent'] ?? 0), 2),
        ]);

        $this->syncOutletUsers($outlet, $data['user_ids'] ?? [], $data['primary_user_id'] ?? null);

        return back()->with('success', 'Outlet berhasil ditambahkan.');
    }

    public function update(Request $request, Outlet $outlet)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'unique:outlets,code,'.$outlet->id],
            'name' => ['required', 'string', 'max:150'],
            'outlet_type' => ['required', 'string', 'in:main,tenant,warehouse'],
            'legal_name' => ['nullable', 'string', 'max:150'],
            'city' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:150'],
            'website' => ['nullable', 'string', 'max:150'],
            'address' => ['nullable', 'string'],
            'commission_rate_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'primary_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        if (($data['is_default'] ?? false) === true) {
            Outlet::query()
                ->whereKeyNot($outlet->id)
                ->update(['is_default' => false]);
        }

        $outlet->update([
            ...$data,
            'slug' => Str::slug($data['name'].'-'.$data['code']),
            'is_active' => (bool) ($data['is_active'] ?? false),
            'is_default' => (bool) ($data['is_default'] ?? false),
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'commission_rate_percent' => round((float) ($data['commission_rate_percent'] ?? 0), 2),
        ]);

        $this->syncOutletUsers($outlet, $data['user_ids'] ?? [], $data['primary_user_id'] ?? null);

        return back()->with('success', 'Outlet berhasil diperbarui.');
    }

    public function toggle(Outlet $outlet)
    {
        $outlet->update([
            'is_active' => ! $outlet->is_active,
        ]);

        return back()->with('success', 'Status outlet berhasil diperbarui.');
    }

    private function syncOutletUsers(Outlet $outlet, array $userIds, ?int $primaryUserId = null): void
    {
        $syncPayload = collect($userIds)
            ->unique()
            ->mapWithKeys(function ($userId) use ($primaryUserId) {
                return [
                    (int) $userId => [
                        'is_primary' => $primaryUserId !== null && (int) $primaryUserId === (int) $userId,
                    ],
                ];
            })
            ->all();

        $outlet->users()->sync($syncPayload);
    }
}
