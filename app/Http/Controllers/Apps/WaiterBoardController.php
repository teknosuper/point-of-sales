<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\TransactionTenantAllocation;
use App\Models\User;
use App\Services\OutletResolver;
use App\Services\WaiterFulfillmentService;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class WaiterBoardController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver,
        private readonly WaiterFulfillmentService $waiterFulfillmentService
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');

        $user = $request->user();
        $filters = $this->filtersPayload($request);
        $canManualAssign = $this->canManualAssign($user);
        $waiters = User::query()
            ->permission('waiter-board-access')
            ->with('waiterTenantOutlets:id')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'waiter_service_scope'])
            ->map(fn (User $waiter) => $this->serializeWaiter($waiter))
            ->values();

        $baseQuery = TransactionTenantAllocation::query()
            ->with([
                'transaction.customer:id,name',
                'transaction.diningTable:id,name,code',
                'tenantOutlet:id,name,code',
                'waiter:id,name',
                'items.product:id,title',
            ])
            ->where('outlet_id', $outlet->id)
            ->whereIn('waiter_status', ['ready', 'assigned', 'picked_up']);

        if ($this->isDeliveryUser($user) && ! $user->servesAllTenantOutlets()) {
            $allowedTenantOutletIds = $user->waiterTenantOutlets()->pluck('outlets.id');

            $baseQuery->where(function ($builder) use ($allowedTenantOutletIds, $user) {
                $builder
                    ->whereIn('tenant_outlet_id', $allowedTenantOutletIds)
                    ->orWhere('waiter_id', $user->id);
            });
        }

        $summaryCounts = (clone $baseQuery)
            ->selectRaw('waiter_status, COUNT(*) as total')
            ->groupBy('waiter_status')
            ->pluck('total', 'waiter_status');

        $query = $this->applyBoardFilters(clone $baseQuery, $filters);
        $query = $this->applyBoardSorting($query, $filters['sort']);

        $allocations = $query
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(function (TransactionTenantAllocation $allocation) use ($waiters, $canManualAssign) {
                return [
                    'id' => $allocation->id,
                    'allocation_number' => $allocation->allocation_number,
                    'invoice' => $allocation->transaction?->invoice,
                    'tenant_name' => $allocation->tenantOutlet?->name ?? '-',
                    'customer_name' => $allocation->transaction?->customer?->name ?? 'Umum',
                    'table_name' => $allocation->transaction?->diningTable?->name,
                    'table_code' => $allocation->transaction?->diningTable?->code,
                    'order_type' => $allocation->transaction?->order_type ?? 'take_away',
                    'waiter_status' => $allocation->waiter_status,
                    'waiter' => $allocation->waiter ? [
                        'id' => $allocation->waiter->id,
                        'name' => $allocation->waiter->name,
                    ] : null,
                    'ready_at' => optional($allocation->ready_at)?->toIso8601String(),
                    'picked_up_at' => optional($allocation->picked_up_at)?->toIso8601String(),
                    'delivered_at' => optional($allocation->delivered_at)?->toIso8601String(),
                    'eligible_waiters' => $canManualAssign
                        ? $waiters
                            ->filter(function (array $waiter) use ($allocation) {
                                return $waiter['waiter_service_scope'] === 'outlet_all'
                                    || in_array((int) $allocation->tenant_outlet_id, $waiter['tenant_outlet_ids'], true);
                            })
                            ->values()
                            ->all()
                        : [],
                    'items' => $allocation->items->map(fn ($item) => [
                        'id' => $item->id,
                        'product_title' => $item->product?->title ?? 'Produk',
                        'qty' => (int) $item->qty,
                        'notes' => $item->notes,
                        'service_status' => $item->service_status ?? 'pending',
                        'ready_at' => optional($item->ready_at)?->toIso8601String(),
                        'picked_up_at' => optional($item->picked_up_at)?->toIso8601String(),
                        'delivered_at' => optional($item->delivered_at)?->toIso8601String(),
                    ])->values(),
                ];
            });

        $deliveredAllocations = TransactionTenantAllocation::query()
            ->with([
                'transaction.customer:id,name',
                'transaction.diningTable:id,name,code',
                'tenantOutlet:id,name,code',
                'waiter:id,name',
            ])
            ->where('outlet_id', $outlet->id)
            ->where('waiter_status', 'delivered')
            ->latest('delivered_at')
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(fn (TransactionTenantAllocation $allocation) => [
                'id' => $allocation->id,
                'invoice' => $allocation->transaction?->invoice,
                'tenant_name' => $allocation->tenantOutlet?->name ?? '-',
                'customer_name' => $allocation->transaction?->customer?->name ?? 'Umum',
                'table_name' => $allocation->transaction?->diningTable?->name,
                'table_code' => $allocation->transaction?->diningTable?->code,
                'waiter' => $allocation->waiter ? [
                    'id' => $allocation->waiter->id,
                    'name' => $allocation->waiter->name,
                ] : null,
                'ready_at' => optional($allocation->ready_at)?->toIso8601String(),
                'picked_up_at' => optional($allocation->picked_up_at)?->toIso8601String(),
                'delivered_at' => optional($allocation->delivered_at)?->toIso8601String(),
            ])
            ->values();

        return Inertia::render('Dashboard/Waiter/Index', [
            'allocations' => $allocations,
            'waiters' => $canManualAssign ? $waiters : [],
            'deliveredAllocations' => $deliveredAllocations,
            'filters' => $filters,
            'summary' => [
                'ready' => (int) ($summaryCounts['ready'] ?? 0),
                'assigned' => (int) ($summaryCounts['assigned'] ?? 0),
                'picked_up' => (int) ($summaryCounts['picked_up'] ?? 0),
            ],
            'perPageOptions' => [10, 15, 25, 50],
            'viewer' => [
                'id' => $user?->id,
                'name' => $user?->name,
                'is_delivery_user' => $this->isDeliveryUser($user),
                'can_manual_assign' => $canManualAssign,
            ],
        ]);
    }

    public function assign(Request $request, TransactionTenantAllocation $allocation)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet || (int) $allocation->outlet_id !== (int) $outlet->id, 404);

        $user = $request->user();

        if ($this->isDeliveryUser($user) && ! $this->canManualAssign($user)) {
            $waiter = $user;
            $waiter->loadMissing('waiterTenantOutlets:id');
        } else {
            $data = $request->validate([
                'waiter_id' => ['required', 'exists:users,id'],
            ]);

            $waiter = User::query()
                ->permission('waiter-board-access')
                ->with('waiterTenantOutlets:id')
                ->find($data['waiter_id']);
        }

        if (! $waiter || ! $this->waiterCanServeAllocationTenant($waiter, (int) $allocation->tenant_outlet_id)) {
            throw ValidationException::withMessages([
                'waiter_id' => 'Waiter tersebut tidak melayani dapur ini.',
            ]);
        }

        $allocation->forceFill([
            'waiter_id' => (int) $waiter->id,
        ])->save();

        $this->waiterFulfillmentService->syncAllocation($allocation->fresh('items'));

        return back()->with('success', 'Waiter berhasil ditugaskan.');
    }

    public function pickUp(Request $request, TransactionTenantAllocation $allocation)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet || (int) $allocation->outlet_id !== (int) $outlet->id, 404);

        $this->ensureAllocationAccessibleByUser($request->user(), $allocation);

        $waiterId = $allocation->waiter_id ?: $request->user()?->id;
        $validated = $request->validate([
            'item_ids' => ['nullable', 'array'],
            'item_ids.*' => ['integer'],
        ]);

        $this->waiterFulfillmentService->pickUpAllocationItems(
            $allocation,
            $validated['item_ids'] ?? [],
            $waiterId
        );

        return back()->with('success', 'Pesanan ditandai sedang diantar.');
    }

    public function deliver(Request $request, TransactionTenantAllocation $allocation)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet || (int) $allocation->outlet_id !== (int) $outlet->id, 404);

        $this->ensureAllocationAccessibleByUser($request->user(), $allocation);

        $waiterId = $allocation->waiter_id ?: $request->user()?->id;
        $validated = $request->validate([
            'item_ids' => ['nullable', 'array'],
            'item_ids.*' => ['integer'],
        ]);

        $this->waiterFulfillmentService->deliverAllocationItems(
            $allocation,
            $validated['item_ids'] ?? [],
            $waiterId
        );

        return back()->with('success', 'Pesanan berhasil diantar.');
    }

    private function ensureAllocationAccessibleByUser(User $user, TransactionTenantAllocation $allocation): void
    {
        if (! $this->isDeliveryUser($user) || $user->servesAllTenantOutlets()) {
            return;
        }

        $allowedTenantOutletIds = $user->relationLoaded('waiterTenantOutlets')
            ? $user->waiterTenantOutlets->pluck('id')
            : $user->waiterTenantOutlets()->pluck('outlets.id');

        $isAssignedToUser = (int) $allocation->waiter_id === (int) $user->id;
        $isAllowedTenant = collect($allowedTenantOutletIds)
            ->map(fn ($id) => (int) $id)
            ->contains((int) $allocation->tenant_outlet_id);

        abort_unless($isAssignedToUser || $isAllowedTenant, 403);
    }

    private function serializeWaiter(User $waiter): array
    {
        return [
            'id' => $waiter->id,
            'name' => $waiter->name,
            'email' => $waiter->email,
            'waiter_service_scope' => $waiter->waiter_service_scope ?? 'outlet_all',
            'tenant_outlet_ids' => $waiter->relationLoaded('waiterTenantOutlets')
                ? $waiter->waiterTenantOutlets->pluck('id')->map(fn ($id) => (int) $id)->values()->all()
                : [],
        ];
    }

    private function waiterCanServeAllocationTenant(User $waiter, ?int $tenantOutletId): bool
    {
        if (! $this->isDeliveryUser($waiter)) {
            return false;
        }

        if (! $tenantOutletId || $waiter->servesAllTenantOutlets()) {
            return true;
        }

        $allowedTenantOutletIds = $waiter->relationLoaded('waiterTenantOutlets')
            ? $waiter->waiterTenantOutlets->pluck('id')
            : $waiter->waiterTenantOutlets()->pluck('outlets.id');

        return collect($allowedTenantOutletIds)
            ->map(fn ($id) => (int) $id)
            ->contains((int) $tenantOutletId);
    }

    private function isDeliveryUser(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return $user->can('waiter-board-access');
    }

    private function canManualAssign(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return true;
        }

        return $user->canAny([
            'users-access',
            'roles-access',
            'permissions-access',
            'reports-access',
            'cashier-settlements-approve',
            'business-settings-update',
            'payment-settings-update',
            'outlets-update',
        ]);
    }

    private function filtersPayload(Request $request): array
    {
        $perPage = (int) $request->input('per_page', 15);
        if (! in_array($perPage, [10, 15, 25, 50], true)) {
            $perPage = 15;
        }

        $sort = (string) $request->input('sort', 'ready_oldest');
        if (! in_array($sort, ['ready_oldest', 'ready_newest', 'tenant_asc', 'customer_asc'], true)) {
            $sort = 'ready_oldest';
        }

        $status = (string) $request->input('status', 'all');
        if (! in_array($status, ['all', 'ready', 'assigned', 'picked_up'], true)) {
            $status = 'all';
        }

        return [
            'q' => trim((string) $request->input('q', '')),
            'status' => $status,
            'sort' => $sort,
            'per_page' => $perPage,
            'view' => in_array((string) $request->input('view', 'list'), ['list', 'grid'], true)
                ? (string) $request->input('view', 'list')
                : 'list',
        ];
    }

    private function applyBoardFilters(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['status'] !== 'all', fn (Builder $builder) => $builder->where('waiter_status', $filters['status']))
            ->when($filters['q'] !== '', function (Builder $builder) use ($filters) {
                $search = $filters['q'];
                $builder->where(function (Builder $scoped) use ($search) {
                    $scoped
                        ->where('allocation_number', 'like', '%'.$search.'%')
                        ->orWhereHas('transaction', function (Builder $transactionQuery) use ($search) {
                            $transactionQuery
                                ->where('invoice', 'like', '%'.$search.'%')
                                ->orWhereHas('customer', fn (Builder $customerQuery) => $customerQuery->where('name', 'like', '%'.$search.'%'))
                                ->orWhereHas('diningTable', function (Builder $tableQuery) use ($search) {
                                    $tableQuery
                                        ->where('name', 'like', '%'.$search.'%')
                                        ->orWhere('code', 'like', '%'.$search.'%');
                                });
                        })
                        ->orWhereHas('tenantOutlet', function (Builder $tenantQuery) use ($search) {
                            $tenantQuery
                                ->where('name', 'like', '%'.$search.'%')
                                ->orWhere('code', 'like', '%'.$search.'%');
                        })
                        ->orWhereHas('waiter', fn (Builder $waiterQuery) => $waiterQuery->where('name', 'like', '%'.$search.'%'))
                        ->orWhereHas('items.product', fn (Builder $productQuery) => $productQuery->where('title', 'like', '%'.$search.'%'));
                });
            });
    }

    private function applyBoardSorting(Builder $query, string $sort): Builder
    {
        return match ($sort) {
            'ready_newest' => $query->orderByDesc('ready_at')->orderByDesc('id'),
            'tenant_asc' => $query
                ->leftJoin('outlets as tenant_outlets', 'tenant_outlets.id', '=', 'transaction_tenant_allocations.tenant_outlet_id')
                ->select('transaction_tenant_allocations.*')
                ->orderBy('tenant_outlets.name')
                ->orderBy('transaction_tenant_allocations.ready_at')
                ->orderBy('transaction_tenant_allocations.id'),
            'customer_asc' => $query
                ->leftJoin('transactions', 'transactions.id', '=', 'transaction_tenant_allocations.transaction_id')
                ->leftJoin('customers', 'customers.id', '=', 'transactions.customer_id')
                ->select('transaction_tenant_allocations.*')
                ->orderByRaw('COALESCE(customers.name, ?) asc', ['Umum'])
                ->orderBy('transaction_tenant_allocations.ready_at')
                ->orderBy('transaction_tenant_allocations.id'),
            default => $query->orderBy('ready_at')->orderBy('id'),
        };
    }
}
