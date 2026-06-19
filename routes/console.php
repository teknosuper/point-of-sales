<?php

use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductOutletStock;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Artisan::command('stocks:sync-unified', function () {
    $outletIds = Outlet::query()
        ->active()
        ->pluck('id')
        ->map(fn ($id) => (int) $id)
        ->all();

    $updatedProducts = 0;

    Product::query()
        ->select(['id', 'stock'])
        ->chunkById(100, function ($products) use ($outletIds, &$updatedProducts) {
            foreach ($products as $product) {
                foreach ($outletIds as $outletId) {
                    ProductOutletStock::query()->updateOrCreate(
                        [
                            'outlet_id' => $outletId,
                            'product_id' => $product->id,
                        ],
                        [
                            'stock' => (int) $product->stock,
                            'reorder_level' => 0,
                            'last_counted_at' => now(),
                        ]
                    );
                }

                $updatedProducts++;
            }
        });

    $this->info("Unified stock synced for {$updatedProducts} products across ".count($outletIds).' outlets.');
})->purpose('Sync unified product stock to all active outlet stock rows');

Schedule::command('crm:sync-segments')->dailyAt('01:00');
Schedule::command('crm:generate-reminders')->dailyAt('01:15');
