<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $defaultSeeders = [
            PermissionSeeder::class,
            RoleSeeder::class,
            UserSeeder::class,
            PaymentSettingSeeder::class,
            OutletKitchenSeeder::class,
            DemoInitialSetupSeeder::class,
        ];

        $this->call($defaultSeeders);

        if (env('SEED_RETAIL_SAMPLE_DATA', false)) {
            $this->command?->warn('SEED_RETAIL_SAMPLE_DATA aktif: menjalankan sample retail lama.');

            $this->call([
                SampleDataSeeder::class,
                OperationalCoreSeeder::class,
                FeatureCoverageSeeder::class,
                DemoInitialSetupSeeder::class,
            ]);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
