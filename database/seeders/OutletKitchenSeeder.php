<?php

namespace Database\Seeders;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class OutletKitchenSeeder extends Seeder
{
    public function run(): void
    {
        $name = \App\Models\Setting::get('store_name', config('app.name', 'POINZA'));
        $slug = Str::slug($name ?: 'poinza-main') ?: 'poinza-main';

        $outlet = Outlet::query()->updateOrCreate(
            ['slug' => $slug],
            [
                'code' => 'OUTLET01',
                'name' => $name,
                'legal_name' => $name,
                'address' => \App\Models\Setting::get('store_address', ''),
                'city' => \App\Models\Setting::get('store_city', ''),
                'phone' => \App\Models\Setting::get('store_phone', ''),
                'email' => \App\Models\Setting::get('store_email', ''),
                'website' => \App\Models\Setting::get('store_website', ''),
                'logo' => \App\Models\Setting::get('store_logo'),
                'is_active' => true,
                'is_default' => true,
                'sort_order' => 0,
            ]
        );

        User::query()->select('id')->each(function (User $user) use ($outlet) {
            $user->outlets()->syncWithoutDetaching([
                $outlet->id => [
                    'is_primary' => $user->outlets()->doesntExist(),
                ],
            ]);
        });
    }
}
