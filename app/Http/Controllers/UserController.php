<?php

namespace App\Http\Controllers;

use App\Http\Requests\UserRequest;
use App\Models\KitchenStation;
use App\Models\Outlet;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        // get all users data
        $users = User::query()
            ->with([
                'roles',
                'outlets' => fn ($query) => $query->select('outlets.id', 'name', 'code'),
                'waiterTenantOutlets' => fn ($query) => $query->select('outlets.id', 'name', 'code'),
            ])
            ->when(request()->search, fn ($query) => $query->where('name', 'like', '%'.request()->search.'%'))
            ->select('id', 'name', 'avatar', 'email')
            ->latest()
            ->paginate(7)
            ->withQueryString();

        // render view
        return Inertia::render('Dashboard/Users/Index', [
            'users' => $users,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        // get all role data
        $roles = Role::query()
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        $outlets = Outlet::query()
            ->active()
            ->ordered()
            ->get(['id', 'name', 'code', 'outlet_type']);
        $tenantOutlets = $outlets
            ->where('outlet_type', 'tenant')
            ->values();
        $kitchenStations = KitchenStation::query()
            ->where('is_active', true)
            ->with('outlet:id,name,code')
            ->orderBy('outlet_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'outlet_id', 'name', 'code']);

        // render view
        return Inertia::render('Dashboard/Users/Create', [
            'roles' => $roles,
            'outlets' => $outlets,
            'tenantOutlets' => $tenantOutlets,
            'kitchenStations' => $kitchenStations,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(UserRequest $request)
    {
        $avatarPath = null;

        if ($request->file('avatar')) {
            $avatarPath = $request->file('avatar')->store('avatars', 'public');
        }

        $this->ensurePreferredKitchenStationIsAccessible(
            $request->input('preferred_workspace', 'standard'),
            $request->input('preferred_kitchen_station_id'),
            $request->input('selectedOutlets', [])
        );

        // create new user data
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => bcrypt($request->password),
            'avatar' => $avatarPath,
            'preferred_workspace' => $request->input('preferred_workspace', 'standard'),
            'preferred_kitchen_station_id' => $request->input('preferred_workspace') === 'kitchen'
                ? ($request->input('preferred_kitchen_station_id') ?: null)
                : null,
            'waiter_service_scope' => in_array('waiter', $request->input('selectedRoles', []), true)
                ? $request->input('waiter_service_scope', 'outlet_all')
                : 'outlet_all',
        ]);

        // assign role to user
        $user->assignRole($request->selectedRoles);
        $this->syncUserOutlets($user, $request->input('selectedOutlets', []), $request->input('primary_outlet_id'));
        $this->syncWaiterTenantOutlets(
            $user,
            $request->input('selectedRoles', []),
            $request->input('waiter_service_scope', 'outlet_all'),
            $request->input('waiter_tenant_outlet_ids', [])
        );

        $this->auditLogService->log(
            event: 'user.created',
            module: 'users',
            auditable: $user,
            description: 'Pengguna baru dibuat.',
            after: $this->userPayload(
                $user->fresh(['outlets:id,name,code', 'waiterTenantOutlets:id,name,code']),
                $this->auditLogService->roleNames($request->selectedRoles),
                $avatarPath !== null
            ),
        );

        // render view
        return to_route('users.index');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(User $user)
    {
        // get all role data
        $roles = Role::query()
            ->select('id', 'name')
            ->orderBy('name')
            ->get();
        $outlets = Outlet::query()
            ->active()
            ->ordered()
            ->get(['id', 'name', 'code', 'outlet_type']);
        $tenantOutlets = $outlets
            ->where('outlet_type', 'tenant')
            ->values();
        $kitchenStations = KitchenStation::query()
            ->where('is_active', true)
            ->with('outlet:id,name,code')
            ->orderBy('outlet_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'outlet_id', 'name', 'code']);

        // load relationship
        $user->load([
            'roles' => fn ($query) => $query->select('id', 'name'),
            'roles.permissions' => fn ($query) => $query->select('id', 'name'),
            'outlets' => fn ($query) => $query->select('outlets.id', 'name', 'code'),
            'waiterTenantOutlets' => fn ($query) => $query->select('outlets.id', 'name', 'code'),
        ]);

        // render view
        return Inertia::render('Dashboard/Users/Edit', [
            'roles' => $roles,
            'user' => $user,
            'outlets' => $outlets,
            'tenantOutlets' => $tenantOutlets,
            'kitchenStations' => $kitchenStations,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UserRequest $request, User $user)
    {
        $beforeRoles = $user->roles()->pluck('name')->all();
        $before = $this->userPayload($user, $beforeRoles, false);
        $avatarPath = $user->getRawOriginal('avatar');
        $avatarChanged = false;

        if ($request->file('avatar')) {
            if ($avatarPath) {
                Storage::disk('public')->delete($avatarPath);
            }

            $avatarPath = $request->file('avatar')->store('avatars', 'public');
            $avatarChanged = true;
        }

        $this->ensurePreferredKitchenStationIsAccessible(
            $request->input('preferred_workspace', 'standard'),
            $request->input('preferred_kitchen_station_id'),
            $request->input('selectedOutlets', [])
        );

        // check if user send request password
        if ($request->password) {
            // update user data password
            $user->update([
                'password' => bcrypt($request->password),
            ]);
        }

        // update user data name
        $user->update([
            'name' => $request->name,
            'email' => $request->email,
            'avatar' => $avatarPath,
            'preferred_workspace' => $request->input('preferred_workspace', 'standard'),
            'preferred_kitchen_station_id' => $request->input('preferred_workspace') === 'kitchen'
                ? ($request->input('preferred_kitchen_station_id') ?: null)
                : null,
            'waiter_service_scope' => in_array('waiter', $request->input('selectedRoles', []), true)
                ? $request->input('waiter_service_scope', 'outlet_all')
                : 'outlet_all',
        ]);

        // assign role to user
        $user->syncRoles($request->selectedRoles);
        $this->syncUserOutlets($user, $request->input('selectedOutlets', []), $request->input('primary_outlet_id'));
        $this->syncWaiterTenantOutlets(
            $user,
            $request->input('selectedRoles', []),
            $request->input('waiter_service_scope', 'outlet_all'),
            $request->input('waiter_tenant_outlet_ids', [])
        );

        $afterRoles = $this->auditLogService->roleNames($request->selectedRoles);
        $after = $this->userPayload(
            $user->fresh(['outlets:id,name,code', 'waiterTenantOutlets:id,name,code']),
            $afterRoles,
            $avatarChanged
        );

        $this->auditLogService->log(
            event: 'user.updated',
            module: 'users',
            auditable: $user,
            description: 'Data pengguna diperbarui.',
            before: $before,
            after: $after,
        );

        if ($beforeRoles !== $afterRoles) {
            $this->auditLogService->log(
                event: 'user.role_changed',
                module: 'users',
                auditable: $user,
                description: 'Role pengguna diperbarui.',
                before: ['roles' => array_values($beforeRoles)],
                after: ['roles' => array_values($afterRoles)],
            );
        }

        // render view
        return to_route('users.index');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $ids = explode(',', $id);
        $users = User::query()->with('roles')->whereIn('id', $ids)->get();

        foreach ($users as $user) {
            $this->auditLogService->log(
                event: 'user.deleted',
                module: 'users',
                auditable: $user,
                description: 'Pengguna dihapus.',
                before: $this->userPayload($user, $user->roles->pluck('name')->all(), false),
            );
        }

        User::whereIn('id', $ids)->delete();

        // render view
        return back();
    }

    private function userPayload(User $user, array $roles, bool $avatarChanged): array
    {
        return [
            'name' => $user->name,
            'email' => $user->email,
            'avatar_changed' => $avatarChanged,
            'roles' => array_values($roles),
            'preferred_workspace' => $user->preferred_workspace,
            'preferred_kitchen_station_id' => $user->preferred_kitchen_station_id,
            'waiter_service_scope' => $user->waiter_service_scope ?? 'outlet_all',
            'outlets' => $user->relationLoaded('outlets')
                ? $user->outlets->map(fn ($outlet) => [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                    'code' => $outlet->code,
                ])->values()->all()
                : [],
            'waiter_tenant_outlets' => $user->relationLoaded('waiterTenantOutlets')
                ? $user->waiterTenantOutlets->map(fn ($outlet) => [
                    'id' => $outlet->id,
                    'name' => $outlet->name,
                    'code' => $outlet->code,
                ])->values()->all()
                : [],
        ];
    }

    private function syncUserOutlets(User $user, array $selectedOutlets = [], mixed $primaryOutletId = null): void
    {
        $selectedOutletIds = collect($selectedOutlets)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $primaryOutletId = $primaryOutletId ? (int) $primaryOutletId : null;

        if ($primaryOutletId && ! $selectedOutletIds->contains($primaryOutletId)) {
            $selectedOutletIds->push($primaryOutletId);
        }

        $syncPayload = $selectedOutletIds
            ->mapWithKeys(fn (int $outletId) => [
                $outletId => ['is_primary' => $primaryOutletId === $outletId],
            ])
            ->all();

        $user->outlets()->sync($syncPayload);
    }

    private function ensurePreferredKitchenStationIsAccessible(
        string $preferredWorkspace,
        mixed $preferredKitchenStationId,
        array $selectedOutlets = []
    ): void {
        if ($preferredWorkspace !== 'kitchen' || ! $preferredKitchenStationId) {
            return;
        }

        $station = KitchenStation::query()
            ->select('id', 'outlet_id')
            ->find($preferredKitchenStationId);

        if (! $station) {
            return;
        }

        $selectedOutletIds = collect($selectedOutlets)
            ->filter()
            ->map(fn ($id) => (int) $id);

        if (! $selectedOutletIds->contains((int) $station->outlet_id)) {
            throw ValidationException::withMessages([
                'preferred_kitchen_station_id' => 'Station dapur default harus berada di salah satu outlet yang dipilih.',
            ]);
        }
    }

    private function syncWaiterTenantOutlets(
        User $user,
        array $selectedRoles = [],
        string $scope = 'outlet_all',
        array $tenantOutletIds = []
    ): void {
        if (! in_array('waiter', $selectedRoles, true) || $scope !== 'tenant_only') {
            $user->waiterTenantOutlets()->sync([]);

            return;
        }

        $allowedOutletIds = $user->outlets()->pluck('outlets.id')->map(fn ($id) => (int) $id);

        $syncIds = collect($tenantOutletIds)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->filter(fn (int $id) => $allowedOutletIds->contains($id))
            ->values()
            ->all();

        $user->waiterTenantOutlets()->sync($syncIds);
    }
}
