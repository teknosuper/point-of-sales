<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $admin = User::updateOrCreate(
            ['email' => 'arya@gmail.com'],
            [
                'name' => 'Arya Dwi Putra',
                'password' => Hash::make('password'),
            ]
        );

        $superAdminRole = Role::where('name', 'super-admin')->first();
        $permissions = Permission::all();

        if ($superAdminRole) {
            $admin->syncRoles([$superAdminRole->name]);
        }

        $admin->syncPermissions($permissions);

        $cashier = User::updateOrCreate(
            ['email' => 'cashier@gmail.com'],
            [
                'name' => 'Cashier Utama',
                'password' => Hash::make('password'),
            ]
        );
        $cashierTwo = User::updateOrCreate(
            ['email' => 'cashier2@gmail.com'],
            [
                'name' => 'Cashier Dua',
                'password' => Hash::make('password'),
            ]
        );
        $waiterOneAttributes = [
            'name' => 'Waiter Satu',
            'password' => Hash::make('password'),
        ];
        $waiterTwoAttributes = [
            'name' => 'Waiter Dua',
            'password' => Hash::make('password'),
        ];

        if (Schema::hasColumn('users', 'waiter_service_scope')) {
            $waiterOneAttributes['waiter_service_scope'] = 'outlet_all';
            $waiterTwoAttributes['waiter_service_scope'] = 'tenant_only';
        }

        $waiterOne = User::updateOrCreate(
            ['email' => 'waiter@gmail.com'],
            $waiterOneAttributes
        );
        $waiterTwo = User::updateOrCreate(
            ['email' => 'waiter2@gmail.com'],
            $waiterTwoAttributes
        );
        $kitchenOne = User::updateOrCreate(
            ['email' => 'kitchen@gmail.com'],
            [
                'name' => 'Kitchen Utama',
                'password' => Hash::make('password'),
            ]
        );
        $kitchenTwo = User::updateOrCreate(
            ['email' => 'kitchen2@gmail.com'],
            [
                'name' => 'Kitchen Dua',
                'password' => Hash::make('password'),
            ]
        );

        $cashierRole = Role::where('name', 'cashier')->first();
        $waiterRole = Role::where('name', 'waiter')->first();
        $kitchenRole = Role::where('name', 'kitchen-operator')->first();

        if ($cashierRole) {
            $cashier->syncRoles([$cashierRole->name]);
            $cashierTwo->syncRoles([$cashierRole->name]);
        }
        if ($waiterRole) {
            $waiterOne->syncRoles([$waiterRole->name]);
            $waiterTwo->syncRoles([$waiterRole->name]);
        }
        if ($kitchenRole) {
            $kitchenOne->syncRoles([$kitchenRole->name]);
            $kitchenTwo->syncRoles([$kitchenRole->name]);
        }
        if ($cashierRole || $waiterRole || $kitchenRole) {
            $cashier->syncPermissions([]);
            $cashierTwo->syncPermissions([]);
            $waiterOne->syncPermissions([]);
            $waiterTwo->syncPermissions([]);
            $kitchenOne->syncPermissions([]);
            $kitchenTwo->syncPermissions([]);
            app(PermissionRegistrar::class)->forgetCachedPermissions();

            return;
        }

        $transactionsPermission = Permission::where('name', 'transactions-access')->first();
        $cashier->syncPermissions($transactionsPermission ? [$transactionsPermission] : []);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
