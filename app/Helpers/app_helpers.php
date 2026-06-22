<?php

/**
 * Global Helper Functions for Timezone-Aware Date/Time Formatting
 * 
 * Use these helpers instead of direct Carbon::parse() calls for consistent
 * timezone handling across all reports and filters.
 */

use App\Support\ReportTimezone;
use Carbon\Carbon;

/**
 * Parse and format a datetime value for display in reports/filters.
 * 
 * @param mixed $value The datetime value (string, Carbon, etc.)
 * @param string $format The output format (default: 'Y-m-d H:i:s')
 * @return string|null Formatted datetime string
 */
if (! function_exists('report_datetime')) {
    function report_datetime(mixed $value, string $format = 'Y-m-d H:i:s'): ?string
    {
        return ReportTimezone::formatDateTime($value, $format);
    }
}

/**
 * Format datetime for PDF/print display.
 * 
 * @param mixed $value The datetime value
 * @return string|null Formatted string 'd/m/Y H:i:s'
 */
if (! function_exists('report_date_pdf')) {
    function report_date_pdf(mixed $value): ?string
    {
        return ReportTimezone::formatDateTime($value, 'd/m/Y H:i:s');
    }
}

/**
 * Format date only for display.
 * 
 * @param mixed $value The datetime value
 * @param string $format The output format (default: 'd/m/Y')
 * @return string|null Formatted date string
 */
if (! function_exists('report_date')) {
    function report_date(mixed $value, string $format = 'd/m/Y'): ?string
    {
        return ReportTimezone::formatDateTime($value, $format);
    }
}

/**
 * Format time only for display.
 * 
 * @param mixed $value The datetime value
 * @param string $format The output format (default: 'H:i:s')
 * @return string|null Formatted time string
 */
if (! function_exists('report_time')) {
    function report_time(mixed $value, string $format = 'H:i:s'): ?string
    {
        return ReportTimezone::formatDateTime($value, $format);
    }
}

/**
 * Get current datetime in report timezone.
 * 
 * @param string $format The output format
 * @return string Formatted current datetime
 */
if (! function_exists('report_now')) {
    function report_now(string $format = 'Y-m-d H:i:s'): string
    {
        return Carbon::now(ReportTimezone::timezone())->format($format);
    }
}

/**
 * Get report timezone label (e.g., "GMT+7").
 * 
 * @return string Timezone label
 */
if (! function_exists('report_timezone_label')) {
    function report_timezone_label(): string
    {
        return ReportTimezone::timezoneLabel();
    }
}

/**
 * Convert stored datetime to display timezone.
 * Assumes stored datetime is in database timezone.
 * 
 * @param mixed $value The datetime value
 * @param string $format The output format
 * @return string|null Formatted datetime
 */
if (! function_exists('stored_to_display')) {
    function stored_to_display(mixed $value, string $format = 'd/m/Y H:i:s'): ?string
    {
        return ReportTimezone::formatStoredDateTime($value, $format);
    }
}

/**
 * Convert UTC datetime to display timezone.
 * 
 * @param mixed $value The datetime value (assumed UTC)
 * @param string $format The output format
 * @return string|null Formatted datetime
 */
if (! function_exists('utc_to_display')) {
    function utc_to_display(mixed $value, string $format = 'd/m/Y H:i:s'): ?string
    {
        return ReportTimezone::formatUtcDateTime($value, $format);
    }
}

/**
 * Convert source timezone datetime to display timezone.
 * Used for parsing filter inputs from UI.
 * 
 * @param mixed $value The datetime value
 * @param string $format The output format
 * @return string|null Formatted datetime
 */
if (! function_exists('source_to_display')) {
    function source_to_display(mixed $value, string $format = 'd/m/Y H:i:s'): ?string
    {
        return ReportTimezone::formatSourceDateTime($value, $format);
    }
}

/**
 * Get start of day in display timezone for date filtering.
 * 
 * @param string $date Date string in 'Y-m-d' format
 * @return Carbon
 */
if (! function_exists('report_day_start')) {
    function report_day_start(string $date): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', $date, ReportTimezone::timezone())
            ->startOfDay();
    }
}

/**
 * Get end of day in display timezone for date filtering.
 * 
 * @param string $date Date string in 'Y-m-d' format
 * @return Carbon
 */
if (! function_exists('report_day_end')) {
    function report_day_end(string $date): Carbon
    {
        return Carbon::createFromFormat('Y-m-d', $date, ReportTimezone::timezone())
            ->endOfDay();
    }
}

/**
 * Format a Carbon instance in report timezone.
 * 
 * @param Carbon|string $value
 * @param string $format
 * @return string|null
 */
if (! function_exists('carbon_in_report_tz')) {
    function carbon_in_report_tz(Carbon|string $value, string $format = 'd/m/Y H:i:s'): ?string
    {
        if (is_string($value)) {
            $value = Carbon::parse($value);
        }
        
        return $value->timezone(ReportTimezone::timezone())->format($format);
    }
}
