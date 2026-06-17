<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;

class AuditLogService
{
    public function log(
        string $event,
        string $module,
        ?Model $auditable = null,
        ?string $description = null,
        ?array $before = null,
        ?array $after = null,
        ?array $meta = null
    ): ?AuditLog {
        $user = auth()->user();
        $ip = request()->ip();
        $userAgent = request()->userAgent();

        return AuditLog::create([
            'user_id' => $user?->id,
            'event' => $event,
            'module' => $module,
            'auditable_type' => $auditable ? get_class($auditable) : null,
            'auditable_id' => $auditable?->getKey(),
            'description' => $description,
            'before' => $before,
            'after' => $after,
            'meta' => $meta,
            'ip_address' => $ip,
            'user_agent' => $userAgent,
            'created_at' => now(),
        ]);
    }

    /**
     * Batch insert multiple audit logs in a single query.
     * Much more efficient than calling log() N times in a loop.
     *
     * @param  array<int, array{event: string, module: string, auditable?: Model|null, description?: string|null, before?: array|null, after?: array|null, meta?: array|null}>  $payloads
     */
    public function logBatch(array $payloads): int
    {
        if (empty($payloads)) {
            return 0;
        }

        $user = auth()->user();
        $ip = request()->ip();
        $userAgent = request()->userAgent();
        $now = now();

        $rows = [];
        foreach ($payloads as $payload) {
            $auditable = $payload['auditable'] ?? null;
            $rows[] = [
                'user_id' => $user?->id,
                'event' => $payload['event'] ?? 'unknown',
                'module' => $payload['module'] ?? 'unknown',
                'auditable_type' => $auditable ? get_class($auditable) : null,
                'auditable_id' => $auditable?->getKey(),
                'description' => $payload['description'] ?? null,
                'before' => isset($payload['before']) ? json_encode($payload['before']) : null,
                'after' => isset($payload['after']) ? json_encode($payload['after']) : null,
                'meta' => isset($payload['meta']) ? json_encode($payload['meta']) : null,
                'ip_address' => $ip,
                'user_agent' => $userAgent,
                'created_at' => $now,
            ];
        }

        return AuditLog::insert($rows) ? count($rows) : 0;
    }

    public function only(array $source, array $keys): array
    {
        $result = [];

        foreach ($keys as $key) {
            if (array_key_exists($key, $source)) {
                $result[$key] = $source[$key];
            }
        }

        return $result;
    }

    public function normalizePayload(?array $payload): ?array
    {
        if (blank($payload)) {
            return null;
        }

        $normalized = [];

        foreach ($payload as $key => $value) {
            $normalized[$key] = $this->normalizeValue($value);
        }

        return blank($normalized) ? null : $normalized;
    }

    public function maskAccountNumber(?string $value): ?string
    {
        if (blank($value)) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $value) ?: $value;
        $length = strlen($digits);

        if ($length <= 4) {
            return str_repeat('*', max($length, 1));
        }

        return str_repeat('*', $length - 4).substr($digits, -4);
    }

    public function credentialState(?string $before, ?string $after): ?string
    {
        $hadBefore = filled($before);
        $hasAfter = filled($after);

        if (! $hadBefore && ! $hasAfter) {
            return null;
        }

        if (! $hadBefore && $hasAfter) {
            return 'configured';
        }

        if ($hadBefore && ! $hasAfter) {
            return 'removed';
        }

        if ($before !== $after) {
            return 'updated';
        }

        return 'unchanged';
    }

    public function summarizeItems(iterable $items, callable $resolver): array
    {
        return collect($items)
            ->map($resolver)
            ->values()
            ->all();
    }

    public function roleNames($roles): array
    {
        return collect($roles)
            ->map(fn ($role) => is_string($role) ? $role : $role->name)
            ->filter()
            ->values()
            ->all();
    }

    public function permissionNames($permissions): array
    {
        $items = collect($permissions);
        $permissionIds = $items
            ->filter(fn ($permission) => is_int($permission) || ctype_digit((string) $permission))
            ->map(fn ($permission) => (int) $permission)
            ->values();

        $permissionNamesById = $permissionIds->isNotEmpty()
            ? Permission::query()
                ->whereIn('id', $permissionIds->all())
                ->pluck('name', 'id')
            : collect();

        return $items
            ->map(function ($permission) use ($permissionNamesById) {
                if (is_string($permission) && ! ctype_digit($permission)) {
                    return $permission;
                }

                if (is_int($permission) || ctype_digit((string) $permission)) {
                    return $permissionNamesById->get((int) $permission);
                }

                return $permission->name ?? null;
            })
            ->filter()
            ->values()
            ->all();
    }

    private function resolveTargetLabel(Model|array|null $auditable): ?string
    {
        if ($auditable instanceof Model) {
            foreach (['title', 'name', 'code', 'invoice'] as $attribute) {
                $value = $auditable->getAttribute($attribute);

                if (filled($value)) {
                    return (string) $value;
                }
            }

            return class_basename($auditable).' #'.$auditable->getKey();
        }

        if (is_array($auditable)) {
            return Arr::first([
                $auditable['target_label'] ?? null,
                $auditable['name'] ?? null,
                $auditable['code'] ?? null,
                $auditable['invoice'] ?? null,
            ]);
        }

        return null;
    }

    private function normalizeValue(mixed $value): mixed
    {
        if ($value instanceof Collection) {
            return $value->map(fn ($item) => $this->normalizeValue($item))->values()->all();
        }

        if ($value instanceof Model) {
            return [
                'id' => $value->getKey(),
                'type' => class_basename($value),
                'label' => $this->resolveTargetLabel($value),
            ];
        }

        if (is_array($value)) {
            $normalized = [];

            foreach ($value as $key => $item) {
                $normalized[$key] = $this->normalizeValue($item);
            }

            return $normalized;
        }

        if (is_bool($value) || is_null($value) || is_int($value) || is_float($value)) {
            return $value;
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return Str::limit((string) $value, 1000, '');
    }
}
