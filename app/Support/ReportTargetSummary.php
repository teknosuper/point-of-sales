<?php

namespace App\Support;

use App\Models\Setting;
use Carbon\Carbon;

class ReportTargetSummary
{
    public static function build(array $summary, ?int $outletId, array $filters): array
    {
        $salesTarget = Setting::getInt('monthly_sales_target', 0, $outletId);
        $profitTarget = Setting::getInt('monthly_profit_target', 0, $outletId);

        $salesActual = (int) ($summary['revenue_total'] ?? 0);
        $profitActual = (int) ($summary['profit_total'] ?? 0);
        $bounds = self::resolveBounds($filters);

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
        );
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
