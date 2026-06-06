<?php

namespace App\Http\Controllers;

use App\Http\Requests\RoleRequest;
use App\Services\AuditLogService;
use App\Support\RbacPresetCatalog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    private const SYSTEM_ROLE_NAMES = [
        'super-admin',
        'cashier',
        'waiter',
        'kitchen-operator',
        'kasir-operasional',
        'petugas-antar',
        'operator-dapur',
    ];

    private const TENANT_ROLE_NAMES = [
        'kitchen-operator',
        'operator-dapur',
        'tenant-operasional',
        'tenant-promo',
        'tenant-owner',
        'tenant-petugas-antar',
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
        $wizardTemplateKey = (string) $request->input('template', '');

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
                    'system' => $query->whereIn('name', self::SYSTEM_ROLE_NAMES),
                    'tenant' => $query->where(function ($builder) {
                        $builder
                            ->whereIn('name', self::TENANT_ROLE_NAMES)
                            ->orWhereHas('permissions', fn ($permissionQuery) => $permissionQuery->whereIn('name', [
                                'products-access',
                                'pricing-rules-access',
                                'outlets-access',
                                'waiter-board-access',
                            ]));
                    }),
                    'pricing' => $query->where(function ($builder) {
                        $builder
                            ->whereIn('name', ['tenant-promo', 'tenant-owner', 'owner-pricing'])
                            ->orWhereHas('permissions', fn ($permissionQuery) => $permissionQuery->whereIn('name', [
                                'pricing-rules-access',
                                'products-pricing-update',
                            ]));
                    }),
                    'admin' => $query
                        ->whereNotIn('name', array_merge(self::SYSTEM_ROLE_NAMES, self::TENANT_ROLE_NAMES))
                        ->whereDoesntHave('permissions', fn ($permissionQuery) => $permissionQuery->whereIn('name', [
                            'products-access',
                            'pricing-rules-access',
                            'outlets-access',
                            'waiter-board-access',
                        ])),
                    default => null,
                };
            })
            ->select('id', 'name')
            ->orderBy('name')
            ->paginate($filters['per_page'])
            ->withQueryString();

        // get all permission data
        $permissions = Permission::query()
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        $wizardTemplates = collect(RbacPresetCatalog::all());
        $wizardTemplate = $wizardTemplates->firstWhere('key', $wizardTemplateKey);

        // render view
        return Inertia::render('Dashboard/Roles/Index', [
            'roles' => $roles,
            'permissions' => $permissions,
            'filters' => $filters,
            'perPageOptions' => $allowedPerPage,
            'wizardTemplate' => $wizardTemplate,
            'wizardTemplates' => $wizardTemplates->values()->all(),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(RoleRequest $request)
    {
        // create new role data
        $role = Role::create(['name' => $request->name]);

        // give permissions to role
        $role->givePermissionTo($request->selectedPermission);

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
        $role->update(['name' => $request->name]);

        // sync role permissions
        $role->syncPermissions($request->selectedPermission);

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
