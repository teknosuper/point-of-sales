<?php

namespace App\Http\Controllers;

use App\Http\Requests\RoleRequest;
use App\Services\AuditLogService;
use App\Support\RoleMetadata;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    private const SYSTEM_PERMISSION_NAMES = [
        'users-access',
        'roles-access',
        'permissions-access',
    ];

    private const TENANT_PERMISSION_NAMES = [
        'products-access',
        'products-create',
        'products-edit',
        'products-delete',
        'products-pricing-update',
        'pricing-rules-access',
        'waiter-board-access',
        'kitchen-access',
        'kitchen-manage',
        'cashier-settlements-request',
    ];

    private const PRICING_PERMISSION_NAMES = [
        'pricing-rules-access',
        'pricing-rules-create',
        'pricing-rules-update',
        'pricing-rules-delete',
        'products-pricing-update',
    ];

    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'kind' => (string) $request->input('kind', ''),
            'per_page' => (int) $request->input('per_page', 12),
        ];
        $allowedPerPage = [8, 12, 20, 30, 50];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 12;
        }

        // get all role data
        $roles = Role::query()
            ->with('permissions')
            ->when($filters['search'] !== '', fn ($query) => $query->where('name', 'like', '%'.$filters['search'].'%'))
            ->when($filters['kind'] !== '', function ($query) use ($filters) {
                match ($filters['kind']) {
                    'system' => $query->where(function ($builder) {
                        $builder
                            ->where('name', 'super-admin')
                            ->orWhereHas('permissions', fn ($permissionQuery) => $permissionQuery->whereIn('name', self::SYSTEM_PERMISSION_NAMES));
                    }),
                    'tenant' => $query->whereHas('permissions', fn ($permissionQuery) => $permissionQuery->whereIn('name', self::TENANT_PERMISSION_NAMES)),
                    'pricing' => $query->whereHas('permissions', fn ($permissionQuery) => $permissionQuery->whereIn('name', self::PRICING_PERMISSION_NAMES)),
                    'admin' => $query
                        ->where('name', '!=', 'super-admin')
                        ->whereDoesntHave('permissions', fn ($permissionQuery) => $permissionQuery->whereIn('name', array_merge(
                            self::SYSTEM_PERMISSION_NAMES,
                            self::TENANT_PERMISSION_NAMES
                        ))),
                    default => null,
                };
            })
            ->select('id', 'name', 'display_name', 'description')
            ->orderBy('name')
            ->paginate($filters['per_page'])
            ->withQueryString();

        // get all permission data
        $permissions = Permission::query()
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        return Inertia::render('Dashboard/Roles/Index', [
            'roles' => $roles,
            'permissions' => $permissions,
            'filters' => $filters,
            'perPageOptions' => $allowedPerPage,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(RoleRequest $request)
    {
        // create new role data
        $role = Role::create([
            'name' => $request->name,
            ...RoleMetadata::forName($request->name),
        ]);

        // give permissions to role
        $role->givePermissionTo($request->selectedPermission);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->auditLogService->log(
            event: 'role.created',
            module: 'roles',
            auditable: $role,
            description: 'Role baru dibuat.',
            after: [
                'name' => $role->name,
                'permissions' => $this->auditLogService->permissionNames($request->selectedPermission),
            ],
        );

        // render view
        return back();
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(RoleRequest $request, Role $role)
    {
        $beforePermissions = $role->permissions()->pluck('name')->all();
        $before = [
            'name' => $role->name,
            'permissions' => array_values($beforePermissions),
        ];

        // update role data
        $role->update([
            'name' => $request->name,
            ...RoleMetadata::forName($request->name),
        ]);

        // sync role permissions
        $role->syncPermissions($request->selectedPermission);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $afterPermissions = $this->auditLogService->permissionNames($request->selectedPermission);

        $this->auditLogService->log(
            event: 'role.updated',
            module: 'roles',
            auditable: $role,
            description: 'Role diperbarui.',
            before: $before,
            after: [
                'name' => $role->fresh()->name,
                'permissions' => array_values($afterPermissions),
            ],
        );

        if ($beforePermissions !== $afterPermissions) {
            $this->auditLogService->log(
                event: 'role.permission_changed',
                module: 'roles',
                auditable: $role,
                description: 'Permission role diperbarui.',
                before: ['permissions' => array_values($beforePermissions)],
                after: ['permissions' => array_values($afterPermissions)],
            );
        }

        // render view
        return back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Role $role)
    {
        $before = [
            'name' => $role->name,
            'permissions' => $role->permissions()->pluck('name')->all(),
        ];

        // delete role data
        $role->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->auditLogService->log(
            event: 'role.deleted',
            module: 'roles',
            auditable: $role,
            description: 'Role dihapus.',
            before: $before,
        );

        // render view
        return back();
    }
}
