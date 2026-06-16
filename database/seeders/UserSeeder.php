<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $legacySuperAdmin = User::query()->where('email', 'arya@gmail.com')->first();
        if ($legacySuperAdmin && ! User::query()->where('email', 'saifulbahri@gtc-center.my.id')->exists()) {
            $legacySuperAdmin->update(['email' => 'saifulbahri@gtc-center.my.id']);
        }

        $superAdmin = User::updateOrCreate(
            ['email' => 'saifulbahri@gtc-center.my.id'],
            [
                'name' => 'Saiful Bahri',
                'password' => Hash::make('password'),
            ]
        );

        $superAdminRole = Role::query()->where('name', 'super-admin')->first();

        if ($superAdminRole) {
            $superAdmin->syncRoles([$superAdminRole->name]);
        }

        $superAdmin->syncPermissions(Permission::all());

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
