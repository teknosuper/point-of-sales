<?php

use App\Http\Controllers\Api\PrintBridgeController;
use App\Http\Controllers\Api\PaymentWebhookController;
use App\Http\Controllers\Api\PrintQueueController;
use App\Http\Controllers\Api\PublicApiDocsController;
use App\Http\Controllers\Api\PublicCatalogController;
use App\Http\Controllers\PublicMenuController;
use App\Http\Middleware\AllowPublicApiCors;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| These routes are loaded by the RouteServiceProvider and are assigned
| the "api" middleware group.
|
*/

// Payment Gateway Webhooks (no auth required)
Route::prefix('webhooks')->group(function () {
    Route::post('/midtrans', [PaymentWebhookController::class, 'midtrans'])->name('webhooks.midtrans');
    Route::post('/xendit', [PaymentWebhookController::class, 'xendit'])->name('webhooks.xendit');
    Route::post('/pakasir', [PaymentWebhookController::class, 'pakasir'])->name('webhooks.pakasir');
});

Route::prefix('print-bridge')->group(function () {
    Route::get('/health', [PrintBridgeController::class, 'health'])->name('print-bridge.health');
    Route::post('/jobs/pull', [PrintBridgeController::class, 'pull'])->name('print-bridge.jobs.pull');
    Route::post('/jobs/{printJob}/success', [PrintBridgeController::class, 'markSuccess'])->name('print-bridge.jobs.success');
    Route::post('/jobs/{printJob}/failed', [PrintBridgeController::class, 'markFailed'])->name('print-bridge.jobs.failed');
});

Route::prefix('print-queue')->group(function () {
    Route::get('/status', [PrintQueueController::class, 'status'])->name('print-queue.status');
    Route::get('/cashier', [PrintQueueController::class, 'cashier'])->name('print-queue.cashier');
    Route::get('/kitchen', [PrintQueueController::class, 'kitchen'])->name('print-queue.kitchen');
    Route::post('/{printJob}/done', [PrintQueueController::class, 'done'])->name('print-queue.done');
    Route::post('/{printJob}/fail', [PrintQueueController::class, 'fail'])->name('print-queue.fail');
});

Route::prefix('public/catalog')
    ->middleware(AllowPublicApiCors::class)
    ->group(function () {
        Route::options('/{any?}', fn () => response('', 204))
            ->where('any', '.*');
        Route::get('/meta', [PublicCatalogController::class, 'meta'])->name('public.catalog.meta');
        Route::get('/products', [PublicCatalogController::class, 'products'])->name('public.catalog.products');
        Route::get('/products/{product}', [PublicCatalogController::class, 'show'])->name('public.catalog.products.show');
        Route::get('/promos', [PublicCatalogController::class, 'promos'])->name('public.catalog.promos');
        Route::get('/display-feed', [PublicCatalogController::class, 'displayFeed'])->name('public.catalog.display-feed');
        Route::get('/promo-banners', [PublicCatalogController::class, 'promoBanners'])->name('public.catalog.promo-banners');
        Route::get('/home-sections', [PublicCatalogController::class, 'homeSections'])->name('public.catalog.home-sections');
        Route::get('/highlights', [PublicCatalogController::class, 'highlights'])->name('public.catalog.highlights');
        Route::get('/products/{product}/reviews', [PublicMenuController::class, 'productReviews'])->name('public.catalog.products.reviews');
    });

Route::get('/public/docs', PublicApiDocsController::class)
    ->middleware(AllowPublicApiCors::class)
    ->name('public.api.docs');

    // Kitchen notification endpoint - untuk polling dari hook
Route::get('/kitchen/pending-count', function (Illuminate\Http\Request $request) {
        $user = $request->user();
        $activeOutlet = app(\App\Services\OutletResolver::class)->resolve($request, $user);
        $outletId = (int) $request->query('outlet_id', 0);
        $stationSlug = $request->query('station_slug', '');

        $query = \App\Models\KitchenTicket::query();

        if ($stationSlug) {
            $station = \App\Models\KitchenStation::where('slug', $stationSlug)->first();
            if ($station) {
                abort_unless($user->hasAccessToOutlet((int) $station->outlet_id), 403);
                $query->where('kitchen_station_id', $station->id);
            }
        }

        if ($activeOutlet && $activeOutlet->outlet_type === 'tenant') {
            $query->whereRaw('transaction_id IN (
                SELECT DISTINCT td.transaction_id
                FROM transaction_details td
                WHERE td.tenant_outlet_id = ?
            )', [(int) $activeOutlet->id]);
        } elseif ($outletId > 0) {
            abort_unless($user->hasAccessToOutlet($outletId), 403);
            // Cek apakah ini outlet tenant
            $outlet = \App\Models\Outlet::find($outletId);
            if ($outlet && $outlet->outlet_type === 'tenant') {
                // Tenant: cari tickets berdasarkan tenant_outlet_id di transaction_details
                $query->whereRaw('transaction_id IN (
                    SELECT DISTINCT td.transaction_id 
                    FROM transaction_details td 
                    WHERE td.tenant_outlet_id = ?
                )', [$outletId]);
            } else {
                $query->where('outlet_id', $outletId);
            }
        }
        
        $pendingCount = (clone $query)
            ->where('status', 'pending')
            ->count();
        $activeCount = (clone $query)
            ->whereIn('status', ['pending', 'acknowledged', 'ready'])
            ->count();
        
        return response()->json([
            'success' => true,
            'pendingCount' => $pendingCount,
            'activeCount' => $activeCount,
        ]);
    })->middleware(['web', 'auth'])->name('kitchen.pending-count');
