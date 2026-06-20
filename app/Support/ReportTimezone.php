<?php

namespace App\Support;

use Carbon\Carbon;

class ReportTimezone
{
    public static function timezone(): string
    {
        return (string) config('app.timezone', 'UTC');
    }

    public static function timezoneLabel(): string
    {
        $offsetMinutes = now(self::timezone())->utcOffset();
        $sign = $offsetMinutes >= 0 ? '+' : '-';
        $absoluteMinutes = abs($offsetMinutes);
        $hours = intdiv($absoluteMinutes, 60);
        $minutes = $absoluteMinutes % 60;

        return $minutes === 0
            ? sprintf('GMT%s%d', $sign, $hours)
            : sprintf('GMT%s%d:%02d', $sign, $hours, $minutes);
    }

    public static function applyUtcDateRange($query, string $column, array $filters)
    {
        if (! empty($filters['start_date'])) {
            $query->where($column, '>=', self::localDateStartUtc($filters['start_date']));
        }

        if (! empty($filters['end_date'])) {
            $query->where($column, '<=', self::localDateEndUtc($filters['end_date']));
        }

        return $query;
    }

    public static function localDateStartUtc(string $date): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', $date, self::timezone())
            ->startOfDay()
            ->utc();
    }

    public static function localDateEndUtc(string $date): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', $date, self::timezone())
            ->endOfDay()
            ->utc();
    }

    public static function formatDateTime($value, string $format = 'Y-m-d H:i:s'): ?string
    {
        if (! $value) {
            return null;
        }

        return Carbon::parse($value)
            ->timezone(self::timezone())
            ->format($format);
    }

    public static function localDateKey($value): ?string
    {
        if (! $value) {
            return null;
        }

        return Carbon::parse($value)
            ->timezone(self::timezone())
            ->format('Y-m-d');
    }

    public static function localHourKey($value): ?string
    {
        if (! $value) {
            return null;
        }

        return Carbon::parse($value)
            ->timezone(self::timezone())
            ->format('H');
    }
}
