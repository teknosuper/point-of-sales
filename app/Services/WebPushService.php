<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\PwaPushSubscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class WebPushService
{
    public function isConfigured(): bool
    {
        return filled(config('services.web_push.vapid.public_key'))
            && filled(config('services.web_push.vapid.private_key'))
            && filled(config('services.web_push.vapid.subject'));
    }

    public function publicKey(): ?string
    {
        $key = config('services.web_push.vapid.public_key');

        return filled($key) ? (string) $key : null;
    }

    public function upsertDashboardSubscription(User $user, array $subscription, ?Outlet $outlet = null): PwaPushSubscription
    {
        return PwaPushSubscription::query()->updateOrCreate(
            ['endpoint' => (string) $subscription['endpoint']],
            [
                'user_id' => $user->id,
                'outlet_id' => $outlet?->id,
                'kind' => PwaPushSubscription::KIND_DASHBOARD,
                'public_key' => (string) data_get($subscription, 'keys.p256dh'),
                'auth_token' => (string) data_get($subscription, 'keys.auth'),
                'content_encoding' => (string) ($subscription['contentEncoding'] ?? 'aes128gcm'),
                'user_agent' => request()->userAgent(),
                'last_used_at' => now(),
            ]
        );
    }

    public function removeDashboardSubscription(User $user, ?string $endpoint = null): void
    {
        PwaPushSubscription::query()
            ->where('user_id', $user->id)
            ->where('kind', PwaPushSubscription::KIND_DASHBOARD)
            ->when($endpoint, fn ($query, $value) => $query->where('endpoint', $value))
            ->delete();
    }

    public function sendToUserDashboard(User $user, array $payload): int
    {
        return $this->sendMany(
            PwaPushSubscription::query()
                ->where('user_id', $user->id)
                ->where('kind', PwaPushSubscription::KIND_DASHBOARD)
                ->get(),
            $payload
        );
    }

    public function sendMany(Collection $subscriptions, array $payload): int
    {
        if (!$this->isConfigured() || $subscriptions->isEmpty()) {
            return 0;
        }

        $webPush = new WebPush([
            'VAPID' => [
                'subject' => (string) config('services.web_push.vapid.subject'),
                'publicKey' => (string) config('services.web_push.vapid.public_key'),
                'privateKey' => (string) config('services.web_push.vapid.private_key'),
            ],
        ]);

        $encodedPayload = json_encode([
            'title' => (string) ($payload['title'] ?? 'GTC KASIR'),
            'body' => (string) ($payload['body'] ?? ''),
            'icon' => $payload['icon'] ?? '/pwa-icon.svg',
            'badge' => $payload['badge'] ?? '/pwa-icon.svg',
            'url' => $payload['url'] ?? route('dashboard'),
            'tag' => $payload['tag'] ?? 'gtc-dashboard',
            'data' => $payload['data'] ?? [],
        ], JSON_UNESCAPED_SLASHES);

        if ($encodedPayload === false) {
            return 0;
        }

        foreach ($subscriptions as $record) {
            $webPush->queueNotification(
                Subscription::create([
                    'endpoint' => $record->endpoint,
                    'publicKey' => $record->public_key,
                    'authToken' => $record->auth_token,
                    'contentEncoding' => $record->content_encoding ?: 'aes128gcm',
                ]),
                $encodedPayload
            );
        }

        $delivered = 0;

        foreach ($webPush->flush() as $report) {
            $endpoint = $report->getRequest()?->getUri()?->__toString();

            $matched = $endpoint
                ? $subscriptions->first(fn (PwaPushSubscription $item) => $item->endpoint === $endpoint)
                : null;

            if ($report->isSuccess()) {
                $delivered++;
                $matched?->forceFill(['last_used_at' => Carbon::now()])->save();
                continue;
            }

            $statusCode = $report->getResponse()?->getStatusCode();

            if (in_array($statusCode, [404, 410], true)) {
                $matched?->delete();
                continue;
            }

            Log::warning('Web push send failed.', [
                'endpoint' => $endpoint,
                'status' => $statusCode,
                'reason' => $report->getReason(),
            ]);
        }

        return $delivered;
    }
}
