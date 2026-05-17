<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class Setting extends Model
{
    use BelongsToOutlet, HasFactory;

    /**
     * Request-local cache to avoid repeated setting lookups in the same request.
     *
     * @var array<string, mixed>
     */
    protected static array $resolvedCache = [];

    protected $fillable = [
        'outlet_id',
        'key',
        'value',
        'description',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
    ];

    /**
     * Get a setting value by key
     */
    public static function get(string $key, $default = null, ?int $outletId = null)
    {
        $values = static::getMany([$key => $default], $outletId);

        return $values[$key] ?? $default;
    }

    public static function getMany(array $defaults, ?int $outletId = null): array
    {
        if ($defaults === []) {
            return [];
        }

        $resolved = [];
        $missingKeys = [];

        foreach ($defaults as $key => $default) {
            $cacheKey = static::cacheKey($key, $outletId);

            if (array_key_exists($cacheKey, static::$resolvedCache)) {
                $resolved[$key] = static::$resolvedCache[$cacheKey];
                continue;
            }

            $missingKeys[$key] = $default;
        }

        if ($missingKeys !== []) {
            $rows = static::queryForKeys(array_keys($missingKeys), $outletId)
                ->get(['key', 'value', 'outlet_id']);

            $grouped = $rows->groupBy('key');

            foreach ($missingKeys as $key => $default) {
                $row = $grouped->get($key)?->first();
                $value = $row?->value ?? $default;
                static::$resolvedCache[static::cacheKey($key, $outletId)] = $value;
                $resolved[$key] = $value;
            }
        }

        return $resolved;
    }

    public static function getInt(string $key, int $default = 0, ?int $outletId = null): int
    {
        return (int) static::get($key, $default, $outletId);
    }

    public static function getBool(string $key, bool $default = false, ?int $outletId = null): bool
    {
        return filter_var(static::get($key, $default ? '1' : '0', $outletId), FILTER_VALIDATE_BOOL);
    }

    /**
     * Set a setting value by key
     */
    public static function set(string $key, $value, ?string $description = null, ?int $outletId = null)
    {
        $setting = static::updateOrCreate(
            static::usesOutletScope()
                ? ['key' => $key, 'outlet_id' => $outletId]
                : ['key' => $key],
            [
                'outlet_id' => static::usesOutletScope() ? $outletId : null,
                'value' => $value,
                'description' => $description,
            ]
        );

        unset(static::$resolvedCache[static::cacheKey($key, $outletId)]);

        return $setting;
    }

    public static function setMany(array $settings, ?int $outletId = null): void
    {
        foreach ($settings as $key => $payload) {
            static::set(
                $key,
                $payload['value'] ?? null,
                $payload['description'] ?? null,
                $outletId
            );
        }
    }

    private static function queryForKey(string $key, ?int $outletId = null)
    {
        $query = static::query()->where('key', $key);

        if (! static::usesOutletScope()) {
            return $query;
        }

        if ($outletId !== null) {
            return $query
                ->where(function ($builder) use ($outletId) {
                    $builder
                        ->where('outlet_id', $outletId)
                        ->orWhereNull('outlet_id');
                })
                ->orderByRaw('CASE WHEN outlet_id = ? THEN 0 ELSE 1 END', [$outletId]);
        }

        return $query->whereNull('outlet_id');
    }

    private static function queryForKeys(array $keys, ?int $outletId = null)
    {
        $query = static::query()->whereIn('key', $keys);

        if (! static::usesOutletScope()) {
            return $query;
        }

        if ($outletId !== null) {
            return $query
                ->where(function ($builder) use ($outletId) {
                    $builder
                        ->where('outlet_id', $outletId)
                        ->orWhereNull('outlet_id');
                })
                ->orderByRaw('CASE WHEN outlet_id = ? THEN 0 ELSE 1 END', [$outletId]);
        }

        return $query->whereNull('outlet_id');
    }

    private static function usesOutletScope(): bool
    {
        return Schema::hasColumn('settings', 'outlet_id');
    }

    private static function cacheKey(string $key, ?int $outletId = null): string
    {
        return ($outletId ?? 'global').':'.$key;
    }
}
