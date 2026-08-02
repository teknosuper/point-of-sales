<?php

namespace Database\Seeders;

use App\Support\RoleMetadata;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    // Refactor the RoleSeeder to improve readability and avoid repetitive code
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->normalizeLegacyPermissionRole();
        $this->deleteLegacyGeneratedAccessRoles();

        $superAdminRole = Role::firstOrCreate(['name' => 'super-admin']);
        $superAdminRole->update(RoleMetadata::forName('super-admin'));
        $superAdminRole->syncPermissions(Permission::all());

        // Create cashier role with basic permissions for public registration
        $cashierRole = Role::firstOrCreate(['name' => 'cashier']);
        $cashierRole->update(RoleMetadata::forName('cashier'));
        $cashierPermissions = Permission::whereIn('name', [
            'dashboard-access',
            'transactions-access',
            'transactions-history-access',
            'table-orders-access',
            'table-orders-approve',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
            'dining-tables-access',
            'customers-access',
            'customers-create',
        ])->get();
        $cashierRole->syncPermissions($cashierPermissions);

        $waiterRole = Role::firstOrCreate(['name' => 'waiter']);
        $waiterRole->update(RoleMetadata::forName('waiter'));
        $waiterPermissions = Permission::whereIn('name', [
            'dashboard-access',
            'waiter-board-access',
        ])->get();
        $waiterRole->syncPermissions($waiterPermissions);

        $kitchenRole = Role::firstOrCreate(['name' => 'kitchen-operator']);
        $kitchenRole->update(RoleMetadata::forName('kitchen-operator'));
        $kitchenPermissions = Permission::whereIn('name', [
            'dashboard-access',
            'kitchen-access',
            'products-access',
            'products-stock-update',
        ])->get();
        $kitchenRole->syncPermissions($kitchenPermissions);

        $this->syncPresetRoles();
        $this->syncOutletOwnerRole();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function normalizeLegacyPermissionRole(): void
    {
        $legacyRole = Role::where('name', 'permission-access')->first();

        if (! $legacyRole) {
            return;
        }

        $finalRole = Role::firstOrCreate([
            'name' => 'permissions-access',
            'guard_name' => $legacyRole->guard_name,
        ]);

        if (DB::getSchemaBuilder()->hasTable('model_has_roles')) {
            DB::table('model_has_roles')
                ->where('role_id', $legacyRole->id)
                ->update(['role_id' => $finalRole->id]);
        }

        if (DB::getSchemaBuilder()->hasTable('role_has_permissions')) {
            DB::table('role_has_permissions')
                ->where('role_id', $legacyRole->id)
                ->update(['role_id' => $finalRole->id]);
        }

        $legacyRole->delete();
    }

    private function deleteLegacyGeneratedAccessRoles(): void
    {
        $legacyRoleNames = [
            'users-access',
            'roles-access',
            'permissions-access',
            'categories-access',
            'products-access',
            'products-stock-update',
            'dining-tables-access',
            'pricing-rules-access',
            'outlets-access',
            'customers-access',
            'customer-vouchers-access',
            'customer-segments-access',
            'crm-campaigns-access',
            'crm-reminders-access',
            'transactions-access',
            'transactions-confirm-payment',
            'kitchen-access',
            'kitchen-manage',
            'waiter-board-access',
            'table-orders-access',
            'table-orders-approve',
            'receivables-access',
            'payables-access',
            'suppliers-access',
            'reports-access',
            'profits-access',
            'payment-settings-access',
            'payment-settings-update',
            'business-settings-access',
            'business-settings-update',
            'stock-opnames-access',
            'stock-mutations-access',
            'sales-returns-access',
            'cashier-shifts-access',
            'cashier-settlements-access',
            'cashier-settlements-approve',
            'audit-logs-access',
            'purchase-orders-access',
            'goods-receivings-access',
            'supplier-returns-access',
        ];

        Role::query()->whereIn('name', $legacyRoleNames)->delete();
    }

    private function syncPresetRoles(): void
    {
        $rolePermissions = [
            'kasir-operasional' => [
                'dashboard-access',
                'transactions-access',
                'transactions-history-access',
                'table-orders-access',
                'table-orders-approve',
                'cashier-shifts-access',
                'cashier-shifts-open',
                'cashier-shifts-close',
                'dining-tables-access',
                'customers-access',
                'customers-create',
            ],
            'petugas-antar' => [
                'dashboard-access',
                'waiter-board-access',
            ],
            'operator-dapur' => [
                'dashboard-access',
                'kitchen-access',
                'products-access',
                'products-stock-update',
            ],
            'tenant-operasional' => [
                'dashboard-access',
                'products-access',
                'products-stock-update',
                'stock-mutations-access',
            ],
            'tenant-petugas-antar' => [
                'dashboard-access',
                'waiter-board-access',
            ],
            'tenant-promo' => [
                'pricing-rules-access',
                'pricing-rules-create',
                'pricing-rules-update',
            ],
            'tenant-owner' => [
                'dashboard-access',
                'products-access',
                'products-edit',
                'products-stock-update',
                'products-pricing-update',
                'categories-access',
                'categories-create',
                'categories-edit',
                'categories-delete',
                'pricing-rules-access',
                'pricing-rules-create',
                'pricing-rules-update',
                'pricing-rules-delete',
                'outlets-access',
                'outlets-update',
                'kitchen-access',
                'kitchen-manage',
                'waiter-board-access',
                'reports-access',
                'profits-access',
                'cashier-settlements-access',
                'cashier-settlements-approve',
                'cashier-settlements-repair',
                'sales-returns-access',
                'sales-returns-delete',
            ],
            'owner-pricing' => [
                'products-access',
                'products-pricing-update',
                'pricing-rules-access',
                'pricing-rules-create',
                'pricing-rules-update',
                'pricing-rules-delete',
            ],
            'admin-stok' => [
                'products-access',
                'products-stock-update',
                'stock-opnames-access',
                'stock-opnames-create',
                'stock-opnames-finalize',
                'stock-mutations-access',
                'purchase-orders-access',
                'purchase-orders-create',
                'purchase-orders-update',
                'goods-receivings-access',
                'goods-receivings-create',
                'supplier-returns-access',
                'supplier-returns-create',
                'supplier-returns-update',
                'suppliers-access',
            ],
            'admin-laporan' => [
                'dashboard-access',
                'reports-access',
                'profits-access',
                'cashier-shifts-access',
            ],
            'admin-owner-outlet' => [
                'dashboard-access',
                'customers-access',
                'customers-create',
                'categories-access',
                'categories-create',
                'categories-edit',
                'categories-delete',
                'kitchen-access',
                'kitchen-manage',
                'cashier-settlements-access',
                'cashier-settlements-approve',
                'cashier-settlements-repair',
                'products-access',
                'products-edit',
                'products-stock-update',
                'outlets-access',
                'outlets-update',
                'business-settings-access',
                'business-settings-update',
                'reports-access',
                'cashier-shifts-access',
                'sales-returns-access',
                'sales-returns-delete',
            ],
            'admin-sistem' => [
                'dashboard-access',
                'users-access',
                'users-create',
                'users-update',
                'users-delete',
                'roles-access',
                'roles-create',
                'roles-update',
                'roles-delete',
                'permissions-access',
                'permissions-create',
                'permissions-update',
                'permissions-delete',
                'audit-logs-access',
                'payment-settings-access',
                'payment-settings-update',
                'business-settings-access',
                'business-settings-update',
                'reports-access',
            ],
        ];

        foreach ($rolePermissions as $roleName => $permissionNames) {
            $permissions = Permission::query()
                ->whereIn('name', $permissionNames)
                ->get();

            $role = Role::firstOrCreate(['name' => $roleName]);
            $role->update(RoleMetadata::forName($roleName));
            $role->syncPermissions($permissions);
        }
    }

    private function syncOutletOwnerRole(): void
    {
        $permissions = Permission::query()
            ->whereIn('name', [
                'dashboard-access',
                'waiter-board-access',
                'cashier-shifts-access',
                'cashier-shifts-open',
                'cashier-shifts-close',
                'cashier-settlements-access',
                'cashier-settlements-approve',
                'cashier-settlements-repair',
                'kitchen-access',
                'kitchen-manage',
                'dining-tables-access',
                'dining-tables-create',
                'dining-tables-update',
                'customers-access',
                'customers-create',
                'products-access',
                'products-create',
                'products-edit',
                'products-stock-update',
                'products-delete',
                'products-pricing-update',
                'products-review',
                'categories-access',
                'categories-create',
                'categories-edit',
                'categories-delete',
                'pricing-rules-access',
                'pricing-rules-create',
                'pricing-rules-update',
                'pricing-rules-delete',
                'outlets-access',
                'outlets-update',
                'outlets-toggle',
                'payment-settings-access',
                'payment-settings-update',
                'business-settings-access',
                'business-settings-update',
                'stock-opnames-access',
                'stock-opnames-create',
                'stock-opnames-finalize',
                'stock-mutations-access',
                'purchase-orders-access',
                'purchase-orders-create',
                'purchase-orders-update',
                'purchase-orders-delete',
                'goods-receivings-access',
                'goods-receivings-create',
                'supplier-returns-access',
                'supplier-returns-create',
                'supplier-returns-update',
                'suppliers-access',
                'receivables-access',
                'payables-access',
                'reports-access',
                'profits-access',
                'sales-returns-access',
                'sales-returns-delete',
            ])
            ->get();

        $role = Role::firstOrCreate(['name' => 'outlet-owner']);
        $role->update(RoleMetadata::forName('outlet-owner'));
        $role->syncPermissions($permissions);
    }
}
