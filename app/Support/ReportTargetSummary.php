<?php

namespace App\Support;

use App\Models\Setting;
use Carbon\Carbon;

class ReportTargetSummary
{
    public static function build(array $summary, ?int $outletId, array $filters, array $dailyMetrics = [], bool $withRows = true): array
    {
        $salesTarget = Setting::getInt('monthly_sales_target', 0, $outletId);
        $profitTarget = Setting::getInt('monthly_profit_target', 0, $outletId);
        $dailyItemTarget = Setting::getInt('daily_global_item_target', 0, $outletId);

        $salesActual = (int) ($summary['revenue_total'] ?? 0);
        $profitActual = (int) ($summary['target_profit_total'] ?? ($summary['profit_total'] ?? 0));
        $itemsActual = (int) ($summary['items_sold'] ?? 0);
        $bounds = self::resolveBounds($filters);
        $breakdown = $bounds !== null
            ? self::buildBreakdownRows($dailyMetrics, $salesTarget, $profitTarget, $dailyItemTarget, $bounds)
            : [];

        return array_merge(
            [
                'period_label' => self::resolvePeriodLabel($filters),
                'has_bounded_period' => $bounds !== null,
                'period_days' => $bounds['period_days'] ?? null,
                'elapsed_days' => $bounds['elapsed_days'] ?? null,
                'remaining_days' => $bounds['remaining_days'] ?? null,
            ],
            self::buildMetricSummary('sales', $salesTarget, $salesActual, $bounds),
            self::buildMetricSummary('profit', $profitTarget, $profitActual, $bounds),
            self::buildItemMetricSummary($dailyItemTarget, $itemsActual, $bounds),
            [
                'breakdown' => $withRows ? $breakdown : [],
                'breakdown_summary' => self::summarizeBreakdownRows($breakdown),
            ]
        );
    }

    public static function summarizeBreakdownRows(array $rows): array
    {
        $fullyMet = 0;
        $unmet = 0;
        $salesMet = 0;
        $profitMet = 0;
        $itemsMet = 0;

        foreach ($rows as $row) {
            $sales = $row['sales_met'] ?? null;
            $profit = $row['profit_met'] ?? null;
            $items = $row['items_met'] ?? null;

            if ($sales === true) {
                $salesMet++;
            }
            if ($profit === true) {
                $profitMet++;
            }
            if ($items === true) {
                $itemsMet++;
            }
            if ($sales === true && $profit === true && $items === true) {
                $fullyMet++;
            }
            if ($sales === false || $profit === false || $items === false) {
                $unmet++;
            }
        }

        return [
            'total_days' => count($rows),
            'fully_met_days' => $fullyMet,
            'unmet_days' => $unmet,
            'sales_met_days' => $salesMet,
            'profit_met_days' => $profitMet,
            'items_met_days' => $itemsMet,
        ];
    }

    /**
     * Breakdown per tanggal untuk konsumsi ajax: filter q + status, lalu paginasi.
     * $dailyMetrics format sama seperti build(): list ['date'=>, 'revenue_total'=>, ...].
     */
    public static function paginateBreakdown(
        array $dailyMetrics,
        array $filters,
        ?int $outletId,
        int $page = 1,
        int $perPage = 31,
        ?string $q = null,
        string $status = 'all'
    ): array {
        $salesTarget = Setting::getInt('monthly_sales_target', 0, $outletId);
        $profitTarget = Setting::getInt('monthly_profit_target', 0, $outletId);
        $dailyItemTarget = Setting::getInt('daily_global_item_target', 0, $outletId);
        $bounds = self::resolveBounds($filters);
        $rows = $bounds !== null
            ? self::buildBreakdownRows($dailyMetrics, $salesTarget, $profitTarget, $dailyItemTarget, $bounds)
            : [];

        $needle = mb_strtolower(trim((string) ($q ?? '')));
        $filtered = array_values(array_filter($rows, function ($row) use ($needle, $status) {
            if ($needle !== '' && ! str_contains(mb_strtolower(($row['date'] ?? '').' '.($row['label'] ?? '')), $needle)) {
                return false;
            }

            if ($status === 'tercapai') {
                return ($row['sales_met'] ?? null) === true
                    && ($row['profit_met'] ?? null) === true
                    && ($row['items_met'] ?? null) === true;
            }

            if ($status === 'tertinggal') {
                return ($row['sales_met'] ?? null) === false
                    || ($row['profit_met'] ?? null) === false
                    || ($row['items_met'] ?? null) === false;
            }

            return true;
        }));

        $total = count($filtered);
        $perPage = max(1, min(100, $perPage));
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, $page), $lastPage);

        return [
            'data' => array_slice($filtered, ($page - 1) * $perPage, $perPage),
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'period_label' => self::resolvePeriodLabel($filters),
                'summary' => self::summarizeBreakdownRows($filtered),
            ],
        ];
    }

    protected static function buildMetricSummary(string $prefix, int $monthlyTarget, int $actual, ?array $bounds): array
    {
        $target = $monthlyTarget;
        $expectedToDate = null;
        $dailyTarget = null;
        $dailyActual = null;
        $requiredDaily = null;
        $onTrack = null;
        $statusLabel = $monthlyTarget > 0 ? 'Butuh rentang tanggal' : 'Belum diatur';
        $statusTone = $monthlyTarget > 0 ? 'slate' : 'amber';

        if ($monthlyTarget > 0 && $bounds !== null) {
            $target = self::proratedTargetForPeriod($monthlyTarget, $bounds['start'], $bounds['end']);
            $expectedToDate = self::proratedTargetForPeriod($monthlyTarget, $bounds['start'], $bounds['elapsed_end']);
            $dailyTarget = $bounds['period_days'] > 0 ? (int) round($target / $bounds['period_days']) : 0;
            $dailyActual = $bounds['elapsed_days'] > 0 ? (int) round($actual / $bounds['elapsed_days']) : 0;
            $requiredDaily = $bounds['remaining_days'] > 0
                ? (int) ceil(max(0, $target - $actual) / $bounds['remaining_days'])
                : 0;
            $onTrack = $actual >= $expectedToDate;

            if ($actual >= $target) {
                $statusLabel = 'Target tercapai';
                $statusTone = 'emerald';
            } elseif ($onTrack) {
                $statusLabel = 'On track';
                $statusTone = 'blue';
            } else {
                $statusLabel = 'Tertinggal';
                $statusTone = 'rose';
            }
        }

        return [
            $prefix.'_target' => $target,
            $prefix.'_actual' => $actual,
            $prefix.'_gap' => $target > 0 ? $actual - $target : 0,
            $prefix.'_progress_percent' => $target > 0
                ? round(($actual / $target) * 100, 2)
                : null,
            $prefix.'_met' => $target > 0 ? $actual >= $target : null,
            $prefix.'_monthly_target' => $monthlyTarget,
            $prefix.'_expected_to_date' => $expectedToDate,
            $prefix.'_daily_target' => $dailyTarget,
            $prefix.'_daily_actual' => $dailyActual,
            $prefix.'_required_daily' => $requiredDaily,
            $prefix.'_daily_gap' => ($dailyTarget !== null && $dailyActual !== null)
                ? $dailyActual - $dailyTarget
                : null,
            $prefix.'_on_track' => $onTrack,
            $prefix.'_status_label' => $statusLabel,
            $prefix.'_status_tone' => $statusTone,
        ];
    }

    protected static function buildItemMetricSummary(int $dailyItemTarget, int $actual, ?array $bounds): array
    {
        $target = 0;
        $expectedToDate = null;
        $dailyActual = null;
        $requiredDaily = null;
        $onTrack = null;
        $statusLabel = $dailyItemTarget > 0 ? 'Butuh rentang tanggal' : 'Belum diatur';
        $statusTone = $dailyItemTarget > 0 ? 'slate' : 'amber';

        if ($dailyItemTarget > 0 && $bounds !== null) {
            $target = $dailyItemTarget * max(0, (int) ($bounds['period_days'] ?? 0));
            $expectedToDate = $dailyItemTarget * max(0, (int) ($bounds['elapsed_days'] ?? 0));
            $dailyActual = ($bounds['elapsed_days'] ?? 0) > 0
                ? (int) round($actual / $bounds['elapsed_days'])
                : 0;
            $requiredDaily = ($bounds['remaining_days'] ?? 0) > 0
                ? (int) ceil(max(0, $target - $actual) / $bounds['remaining_days'])
                : 0;
            $onTrack = $actual >= $expectedToDate;

            if ($actual >= $target) {
                $statusLabel = 'Target tercapai';
                $statusTone = 'emerald';
            } elseif ($onTrack) {
                $statusLabel = 'On track';
                $statusTone = 'blue';
            } else {
                $statusLabel = 'Tertinggal';
                $statusTone = 'rose';
            }
        }

        return [
            'items_target' => $target,
            'items_actual' => $actual,
            'items_gap' => $target > 0 ? $actual - $target : 0,
            'items_progress_percent' => $target > 0
                ? round(($actual / $target) * 100, 2)
                : null,
            'items_met' => $target > 0 ? $actual >= $target : null,
            'items_daily_target' => $dailyItemTarget > 0 ? $dailyItemTarget : null,
            'items_expected_to_date' => $expectedToDate,
            'items_daily_actual' => $dailyActual,
            'items_required_daily' => $requiredDaily,
            'items_daily_gap' => ($dailyItemTarget > 0 && $dailyActual !== null)
                ? $dailyActual - $dailyItemTarget
                : null,
            'items_on_track' => $onTrack,
            'items_status_label' => $statusLabel,
            'items_status_tone' => $statusTone,
        ];
    }

    protected static function buildBreakdownRows(array $dailyMetrics, int $monthlySalesTarget, int $monthlyProfitTarget, int $dailyItemTarget, ?array $bounds): array
    {
        if ($bounds === null) {
            return [];
        }

        $metricsByDate = collect($dailyMetrics)->keyBy('date');
        $cursor = $bounds['start']->copy()->startOfDay();
        $lastDay = $bounds['end']->copy()->startOfDay();
        $rows = [];

        while ($cursor->lte($lastDay)) {
            $dateKey = $cursor->format('Y-m-d');
            $metric = $metricsByDate->get($dateKey, []);
            $salesTarget = self::proratedTargetForPeriod($monthlySalesTarget, $cursor, $cursor);
            $profitTarget = self::proratedTargetForPeriod($monthlyProfitTarget, $cursor, $cursor);
            $itemTarget = $dailyItemTarget > 0 ? $dailyItemTarget : 0;
            $salesActual = (int) ($metric['revenue_total'] ?? 0);
            $profitActual = (int) ($metric['target_profit_total'] ?? ($metric['profit_total'] ?? 0));
            $itemsActual = (int) ($metric['items_sold'] ?? 0);

            $rows[] = [
                'date' => $dateKey,
                'label' => $cursor->translatedFormat('d M Y'),
                'sales_target' => $salesTarget,
                'sales_actual' => $salesActual,
                'sales_met' => $salesTarget > 0 ? $salesActual >= $salesTarget : null,
                'sales_progress_percent' => $salesTarget > 0 ? round(($salesActual / $salesTarget) * 100, 2) : null,
                'profit_target' => $profitTarget,
                'profit_actual' => $profitActual,
                'profit_met' => $profitTarget > 0 ? $profitActual >= $profitTarget : null,
                'profit_progress_percent' => $profitTarget > 0 ? round(($profitActual / $profitTarget) * 100, 2) : null,
                'items_target' => $itemTarget,
                'items_actual' => $itemsActual,
                'items_met' => $itemTarget > 0 ? $itemsActual >= $itemTarget : null,
                'items_progress_percent' => $itemTarget > 0 ? round(($itemsActual / $itemTarget) * 100, 2) : null,
            ];

            $cursor->addDay();
        }

        return $rows;
    }

    protected static function resolveBounds(array $filters): ?array
    {
        if (empty($filters['start_date']) || empty($filters['end_date'])) {
            return null;
        }

        $start = Carbon::createFromFormat('Y-m-d', $filters['start_date'], ReportTimezone::timezone())->startOfDay();
        $end = Carbon::createFromFormat('Y-m-d', $filters['end_date'], ReportTimezone::timezone())->endOfDay();

        if ($end->lt($start)) {
            [$start, $end] = [$end->copy()->startOfDay(), $start->copy()->endOfDay()];
        }

        $today = now(ReportTimezone::timezone())->endOfDay();
        $elapsedEnd = $today->lt($start)
            ? null
            : ($today->lt($end) ? $today->copy() : $end->copy());

        $periodDays = $start->diffInDays($end) + 1;
        $elapsedDays = $elapsedEnd ? ($start->diffInDays($elapsedEnd) + 1) : 0;
        $remainingDays = max(0, $periodDays - $elapsedDays);

        return [
            'start' => $start,
            'end' => $end,
            'elapsed_end' => $elapsedEnd,
            'period_days' => $periodDays,
            'elapsed_days' => $elapsedDays,
            'remaining_days' => $remainingDays,
        ];
    }

    protected static function proratedTargetForPeriod(int $monthlyTarget, Carbon $start, ?Carbon $end): int
    {
        if ($monthlyTarget <= 0 || $end === null || $end->lt($start)) {
            return 0;
        }

        $cursor = $start->copy()->startOfDay();
        $lastDay = $end->copy()->startOfDay();
        $target = 0.0;

        while ($cursor->lte($lastDay)) {
            $target += $monthlyTarget / max(1, $cursor->daysInMonth);
            $cursor->addDay();
        }

        return (int) round($target);
    }

    protected static function resolvePeriodLabel(array $filters): string
    {
        if (! empty($filters['start_date']) && ! empty($filters['end_date'])) {
            return Carbon::parse($filters['start_date'], ReportTimezone::timezone())->format('d M Y').' - '.Carbon::parse($filters['end_date'], ReportTimezone::timezone())->format('d M Y').' ('.ReportTimezone::timezoneLabel().')';
        }

        if (! empty($filters['start_date'])) {
            return 'Sejak '.Carbon::parse($filters['start_date'], ReportTimezone::timezone())->format('d M Y').' ('.ReportTimezone::timezoneLabel().')';
        }

        if (! empty($filters['end_date'])) {
            return 'Sampai '.Carbon::parse($filters['end_date'], ReportTimezone::timezone())->format('d M Y').' ('.ReportTimezone::timezoneLabel().')';
        }

        return 'Periode berjalan ('.ReportTimezone::timezoneLabel().')';
    }
}
