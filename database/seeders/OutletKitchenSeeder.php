<?php

namespace Database\Seeders;

use App\Models\KitchenStation;
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

        $stations = [
            ['name' => 'Minuman', 'slug' => 'minuman', 'code' => 'ST-MINUMAN', 'sort_order' => 10],
            ['name' => 'Mie', 'slug' => 'mie', 'code' => 'ST-MIE', 'sort_order' => 20],
            ['name' => 'Ayam', 'slug' => 'ayam', 'code' => 'ST-AYAM', 'sort_order' => 30],
            ['name' => 'Ramen', 'slug' => 'ramen', 'code' => 'ST-RAMEN', 'sort_order' => 40],
            ['name' => 'Steak', 'slug' => 'steak', 'code' => 'ST-STEAK', 'sort_order' => 50],
            ['name' => 'Es Duren', 'slug' => 'es-duren', 'code' => 'ST-ESDUREN', 'sort_order' => 60],
            ['name' => 'Sate', 'slug' => 'sate', 'code' => 'ST-SATE', 'sort_order' => 70],
            ['name' => 'Salad', 'slug' => 'salad', 'code' => 'ST-SALAD', 'sort_order' => 80],
        ];

        foreach ($stations as $station) {
            KitchenStation::query()->updateOrCreate(
                [
                    'outlet_id' => $outlet->id,
                    'slug' => $station['slug'],
                ],
                [
                    'name' => $station['name'],
                    'code' => $station['code'],
                    'station_type' => 'kitchen',
                    'display_mode' => 'screen',
                    'is_active' => true,
                    'sort_order' => $station['sort_order'],
                ]
            );
        }

        User::query()->select('id')->each(function (User $user) use ($outlet) {
            $user->outlets()->syncWithoutDetaching([
                $outlet->id => [
                    'is_primary' => $user->outlets()->doesntExist(),
                ],
            ]);
        });
    }
}
