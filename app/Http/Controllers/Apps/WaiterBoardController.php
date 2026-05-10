<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\TransactionTenantAllocation;
use App\Models\User;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class WaiterBoardController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');

        $user = $request->user();
        $waiters = User::query()
            ->role('waiter')
            ->with('waiterTenantOutlets:id')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'waiter_service_scope'])
            ->map(fn (User $waiter) => $this->serializeWaiter($waiter))
            ->values();

        $query = TransactionTenantAllocation::query()
            ->with([
                'transaction.customer:id,name',
                'transaction.diningTable:id,name,code',
                'tenantOutlet:id,name,code',
                'waiter:id,name',
                'items.product:id,title',
            ])
            ->where('outlet_id', $outlet->id)
            ->whereIn('waiter_status', ['ready', 'assigned', 'picked_up'])
            ->latest('ready_at')
            ->latest('id')
            ->limit(100);

        if ($user?->hasRole('waiter') && ! $user->servesAllTenantOutlets()) {
            $allowedTenantOutletIds = $user->waiterTenantOutlets()->pluck('outlets.id');

            $query->where(function ($builder) use ($allowedTenantOutletIds, $user) {
                $builder
                    ->whereIn('tenant_outlet_id', $allowedTenantOutletIds)
                    ->orWhere('waiter_id', $user->id);
            });
        }

        $allocations = $query
            ->get()
            ->map(function (TransactionTenantAllocation $allocation) use ($waiters) {
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
                    'eligible_waiters' => $waiters
                        ->filter(function (array $waiter) use ($allocation) {
                            return $waiter['waiter_service_scope'] === 'outlet_all'
                                || in_array((int) $allocation->tenant_outlet_id, $waiter['tenant_outlet_ids'], true);
                        })
                        ->values()
                        ->all(),
                    'items' => $allocation->items->map(fn ($item) => [
                        'id' => $item->id,
                        'product_title' => $item->product?->title ?? 'Produk',
                        'qty' => (int) $item->qty,
                        'notes' => $item->notes,
                    ])->values(),
                ];
            })
            ->values();

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
            'waiters' => $waiters,
            'deliveredAllocations' => $deliveredAllocations,
        ]);
    }

    public function assign(Request $request, TransactionTenantAllocation $allocation)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet || (int) $allocation->outlet_id !== (int) $outlet->id, 404);

        $data = $request->validate([
            'waiter_id' => ['required', 'exists:users,id'],
        ]);

        $waiter = User::query()
            ->role('waiter')
            ->with('waiterTenantOutlets:id')
            ->find($data['waiter_id']);

        if (! $waiter || ! $this->waiterCanServeAllocationTenant($waiter, (int) $allocation->tenant_outlet_id)) {
            throw ValidationException::withMessages([
                'waiter_id' => 'Waiter tersebut tidak melayani dapur ini.',
            ]);
        }

        $allocation->forceFill([
            'waiter_id' => (int) $waiter->id,
            'waiter_status' => 'assigned',
        ])->save();

        return back()->with('success', 'Waiter berhasil ditugaskan.');
    }

    public function pickUp(Request $request, TransactionTenantAllocation $allocation)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet || (int) $allocation->outlet_id !== (int) $outlet->id, 404);

        $this->ensureAllocationAccessibleByUser($request->user(), $allocation);

        $waiterId = $allocation->waiter_id ?: $request->user()?->id;

        $allocation->forceFill([
            'waiter_id' => $waiterId,
            'waiter_status' => 'picked_up',
            'picked_up_at' => now(),
        ])->save();

        return back()->with('success', 'Pesanan ditandai sedang diantar.');
    }

    public function deliver(Request $request, TransactionTenantAllocation $allocation)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet || (int) $allocation->outlet_id !== (int) $outlet->id, 404);

        $this->ensureAllocationAccessibleByUser($request->user(), $allocation);

        $waiterId = $allocation->waiter_id ?: $request->user()?->id;

        $allocation->forceFill([
            'waiter_id' => $waiterId,
            'waiter_status' => 'delivered',
            'delivered_at' => now(),
        ])->save();

        return back()->with('success', 'Pesanan berhasil diantar.');
    }

    private function ensureAllocationAccessibleByUser(User $user, TransactionTenantAllocation $allocation): void
    {
        if (! $user->hasRole('waiter') || $user->servesAllTenantOutlets()) {
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
        if (! $waiter->hasRole('waiter')) {
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
}
