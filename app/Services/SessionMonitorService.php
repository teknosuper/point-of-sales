<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SessionMonitorService
{
    public function supportsDatabaseSessions(): bool
    {
        return config('session.driver') === 'database'
            && Schema::hasTable(config('session.table', 'sessions'));
    }

    public function snapshotForUser(User $user, Request $request): array
    {
        if (! $this->supportsDatabaseSessions()) {
            return [
                'supported' => false,
                'current_session' => null,
                'other_sessions_count' => 0,
                'other_sessions' => [],
                'other_device_sessions_count' => 0,
                'other_device_sessions' => [],
                'alert' => [
                    'should_alert' => false,
                    'key' => null,
                ],
            ];
        }

        $currentSessionId = $request->session()->getId();
        $sessionLifetimeCutoff = now()->subMinutes((int) config('session.lifetime', 60))->timestamp;

        $rows = DB::table(config('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->where('last_activity', '>=', $sessionLifetimeCutoff)
            ->orderByDesc('last_activity')
            ->get([
                'id',
                'ip_address',
                'user_agent',
                'last_activity',
            ]);

        $currentSession = $rows->firstWhere('id', $currentSessionId);
        $currentFingerprint = $this->fingerprintForSession(
            $currentSession?->user_agent,
            $currentSession?->ip_address
        );

        $otherSessions = $rows
            ->filter(function ($row) use ($currentSessionId, $currentFingerprint) {
                if ((string) $row->id === (string) $currentSessionId) {
                    return false;
                }

                return true;
            })
            ->map(fn ($row) => $this->transformSessionRow(
                $row,
                $this->fingerprintForSession($row->user_agent, $row->ip_address) === $currentFingerprint
            ))
            ->values();

        $otherDeviceSessions = $otherSessions
            ->where('is_same_device', false)
            ->values();

        $alertKey = $otherSessions->isNotEmpty()
            ? sha1($otherSessions->map(
                fn (array $session) => implode('|', [
                    $session['id'],
                    $session['device_label'],
                    $session['ip_address'],
                    $session['last_activity_at'],
                ])
            )->implode('||'))
            : null;

        return [
            'supported' => true,
            'current_session' => $currentSession ? $this->transformSessionRow($currentSession) : null,
            'other_sessions_count' => $otherSessions->count(),
            'other_sessions' => $otherSessions->all(),
            'other_device_sessions_count' => $otherDeviceSessions->count(),
            'other_device_sessions' => $otherDeviceSessions->all(),
            'alert' => [
                'should_alert' => $otherSessions->isNotEmpty(),
                'key' => $alertKey,
            ],
        ];
    }

    public function logoutOtherSessions(User $user, string $currentSessionId): int
    {
        if (! $this->supportsDatabaseSessions()) {
            return 0;
        }

        return DB::table(config('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->where('id', '!=', $currentSessionId)
            ->delete();
    }

    public function logoutSpecificSession(User $user, string $currentSessionId, string $targetSessionId): bool
    {
        if (! $this->supportsDatabaseSessions()) {
            return false;
        }

        if ($targetSessionId === $currentSessionId) {
            return false;
        }

        return DB::table(config('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->where('id', $targetSessionId)
            ->delete() > 0;
    }

    private function transformSessionRow(object $row, bool $isSameDevice = false): array
    {
        $parsed = $this->parseUserAgent((string) ($row->user_agent ?? ''));
        $lastActivityAt = Carbon::createFromTimestamp((int) ($row->last_activity ?? 0));

        return [
            'id' => (string) $row->id,
            'ip_address' => (string) ($row->ip_address ?: '-'),
            'user_agent' => (string) ($row->user_agent ?? ''),
            'device_type' => $parsed['device_type'],
            'platform' => $parsed['platform'],
            'browser' => $parsed['browser'],
            'device_label' => $parsed['device_label'],
            'is_same_device' => $isSameDevice,
            'last_activity_at' => $lastActivityAt->toIso8601String(),
            'last_activity_human' => $lastActivityAt->diffForHumans(),
        ];
    }

    private function fingerprintForSession(?string $userAgent, ?string $ipAddress): string
    {
        $parsed = $this->parseUserAgent((string) $userAgent);

        return implode('|', [
            $parsed['device_type'],
            $parsed['platform'],
            $parsed['browser'],
            (string) $ipAddress,
        ]);
    }

    private function parseUserAgent(string $userAgent): array
    {
        $ua = strtolower($userAgent);

        $deviceType = match (true) {
            str_contains($ua, 'ipad'), str_contains($ua, 'tablet') => 'Tablet',
            str_contains($ua, 'mobile'), str_contains($ua, 'android'), str_contains($ua, 'iphone') => 'Mobile',
            $ua === '' => 'Perangkat tidak dikenal',
            default => 'Desktop',
        };

        $platform = match (true) {
            str_contains($ua, 'windows') => 'Windows',
            str_contains($ua, 'android') => 'Android',
            str_contains($ua, 'iphone'), str_contains($ua, 'ios') => 'iPhone',
            str_contains($ua, 'ipad') => 'iPad',
            str_contains($ua, 'mac os x'), str_contains($ua, 'macintosh') => 'macOS',
            str_contains($ua, 'linux') => 'Linux',
            default => 'OS tidak dikenal',
        };

        $browser = match (true) {
            str_contains($ua, 'edg/') => 'Edge',
            str_contains($ua, 'opr/'), str_contains($ua, 'opera') => 'Opera',
            str_contains($ua, 'samsungbrowser') => 'Samsung Internet',
            str_contains($ua, 'chrome/') && ! str_contains($ua, 'edg/') => 'Chrome',
            str_contains($ua, 'firefox/') => 'Firefox',
            str_contains($ua, 'safari/') && ! str_contains($ua, 'chrome/') => 'Safari',
            default => 'Browser tidak dikenal',
        };

        return [
            'device_type' => $deviceType,
            'platform' => $platform,
            'browser' => $browser,
            'device_label' => implode(' • ', [$deviceType, $browser, $platform]),
        ];
    }
}
