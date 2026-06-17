<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Services\OutletResolver;
use App\Services\WebPushService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PwaPushSubscriptionController extends Controller
{
    public function __construct(
        private readonly WebPushService $webPushService,
        private readonly OutletResolver $outletResolver,
    ) {
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => ['required', 'url'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
            'contentEncoding' => ['nullable', 'string', 'max:32'],
        ]);

        abort_unless($this->webPushService->isConfigured(), 422, 'Web push belum dikonfigurasi di server.');

        $record = $this->webPushService->upsertDashboardSubscription(
            $request->user(),
            $validated,
            $this->outletResolver->resolve($request, $request->user())
        );

        return response()->json([
            'ok' => true,
            'subscription_id' => $record->id,
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => ['nullable', 'url'],
        ]);

        $this->webPushService->removeDashboardSubscription(
            $request->user(),
            $validated['endpoint'] ?? null
        );

        return response()->json([
            'ok' => true,
        ]);
    }

    public function test(Request $request): JsonResponse
    {
        abort_unless($this->webPushService->isConfigured(), 422, 'Web push belum dikonfigurasi di server.');

        $sent = $this->webPushService->sendToUserDashboard($request->user(), [
            'title' => 'Tes notifikasi GTC KASIR',
            'body' => 'Push notification native berhasil tersambung ke perangkat ini.',
            'url' => route('guides.pwa-setup'),
            'tag' => 'gtc-dashboard-test',
            'data' => [
                'kind' => 'dashboard-test',
            ],
        ]);

        return response()->json([
            'ok' => true,
            'sent' => $sent,
        ]);
    }
}
