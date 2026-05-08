<?php

use App\Http\Controllers\Api\PrintBridgeController;
use App\Http\Controllers\Api\PaymentWebhookController;
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
});

Route::prefix('print-bridge')->group(function () {
    Route::get('/health', [PrintBridgeController::class, 'health'])->name('print-bridge.health');
    Route::post('/jobs/pull', [PrintBridgeController::class, 'pull'])->name('print-bridge.jobs.pull');
    Route::post('/jobs/{printJob}/success', [PrintBridgeController::class, 'markSuccess'])->name('print-bridge.jobs.success');
    Route::post('/jobs/{printJob}/failed', [PrintBridgeController::class, 'markFailed'])->name('print-bridge.jobs.failed');
});
