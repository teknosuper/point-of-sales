<?php

namespace App\Support;

use Carbon\Carbon;

class ReportTimezone
{
    public static function sourceTimezone(): string
    {
        return (string) config('app.report_source_timezone', '-05:00');
    }

    public static function displayTimezone(): string
    {
        return (string) config('app.report_display_timezone', config('app.timezone', 'UTC'));
    }

    public static function databaseTimezone(): string
    {
        return (string) config('app.db_timezone', config('app.timezone', 'UTC'));
    }

    public static function timezone(): string
    {
        return self::displayTimezone();
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

    public static function applyStoredDateRange($query, string $column, array $filters)
    {
        if (! empty($filters['start_date'])) {
            $query->where($column, '>=', self::localDateStartInDatabaseTz($filters['start_date']));
        }

        if (! empty($filters['end_date'])) {
            $query->where($column, '<=', self::localDateEndInDatabaseTz($filters['end_date']));
        }

        return $query;
    }

    public static function applySourceDateRange($query, string $column, array $filters)
    {
        if (! empty($filters['start_date'])) {
            $query->where($column, '>=', self::localDateStartInSourceTz($filters['start_date']));
        }

        if (! empty($filters['end_date'])) {
            $query->where($column, '<=', self::localDateEndInSourceTz($filters['end_date']));
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

    public static function localDateStartInDatabaseTz(string $date): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', $date, self::timezone())
            ->startOfDay()
            ->setTimezone(self::databaseTimezone());
    }

    public static function localDateEndInDatabaseTz(string $date): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', $date, self::timezone())
            ->endOfDay()
            ->setTimezone(self::databaseTimezone());
    }

    public static function localDateStartInSourceTz(string $date): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', $date, self::displayTimezone())
            ->startOfDay()
            ->setTimezone(self::sourceTimezone());
    }

    public static function localDateEndInSourceTz(string $date): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', $date, self::displayTimezone())
            ->endOfDay()
            ->setTimezone(self::sourceTimezone());
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

    public static function utcToLocalCarbon($value): ?Carbon
    {
        if (! $value) {
            return null;
        }

        return Carbon::parse((string) $value, 'UTC')
            ->timezone(self::timezone());
    }

    public static function formatUtcDateTime($value, string $format = 'Y-m-d H:i:s'): ?string
    {
        $dateTime = self::utcToLocalCarbon($value);

        return $dateTime?->format($format);
    }

    public static function storedToLocalCarbon($value): ?Carbon
    {
        if (! $value) {
            return null;
        }

        return Carbon::parse((string) $value, self::databaseTimezone())
            ->timezone(self::timezone());
    }

    public static function formatStoredDateTime($value, string $format = 'Y-m-d H:i:s'): ?string
    {
        $dateTime = self::storedToLocalCarbon($value);

        return $dateTime?->format($format);
    }

    public static function sourceToDisplayCarbon($value): ?Carbon
    {
        if (! $value) {
            return null;
        }

        return Carbon::parse((string) $value, self::sourceTimezone())
            ->timezone(self::displayTimezone());
    }

    public static function formatSourceDateTime($value, string $format = 'Y-m-d H:i:s'): ?string
    {
        $dateTime = self::sourceToDisplayCarbon($value);

        return $dateTime?->format($format);
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
