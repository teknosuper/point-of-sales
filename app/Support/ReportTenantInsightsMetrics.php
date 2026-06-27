<?php

namespace App\Support;

use Illuminate\Support\Collection;

class ReportTenantInsightsMetrics
{
    public static function summary(Collection $allocations): object
    {
        return (object) [
            'orders_count' => (int) $allocations->count(),
            'revenue_total' => (int) $allocations->sum('grand_total'),
            'manual_discount_total' => (int) $allocations->sum('manual_discount_total'),
            'items_sold' => (int) $allocations->sum('total_items'),
            'profit_total' => (int) $allocations->sum('profit_total'),
        ];
    }

    public static function salesByHour(Collection $allocations): array
    {
        $rows = $allocations
            ->groupBy(fn ($allocation) => ReportTimezone::sourceToDisplayCarbon(
                $allocation->transaction?->getRawOriginal('created_at') ?? $allocation->transaction?->created_at
            )?->format('H'))
            ->filter(fn ($rows, $hour) => $hour !== null)
            ->map(fn (Collection $rows) => (object) [
                'orders_count' => (int) $rows->count(),
                'revenue_total' => (int) $rows->sum('grand_total'),
            ]);

        return collect(range(0, 23))
            ->map(function (int $hour) use ($rows) {
                $row = $rows->get(str_pad((string) $hour, 2, '0', STR_PAD_LEFT)) ?? $rows->get($hour);

                return [
                    'hour' => $hour,
                    'label' => sprintf('%02d:00', $hour),
                    'orders_count' => (int) ($row->orders_count ?? 0),
                    'revenue_total' => (int) round($row->revenue_total ?? 0),
                ];
            })
            ->all();
    }

    public static function salesByDay(Collection $allocations): array
    {
        return $allocations
            ->groupBy(fn ($allocation) => ReportTimezone::sourceDateKey(
                $allocation->transaction?->getRawOriginal('created_at') ?? $allocation->transaction?->created_at
            ))
            ->filter(fn ($rows, $day) => $day !== null)
            ->sortKeys()
            ->map(fn (Collection $rows, $day) => [
                'date' => $day,
                'label' => \Illuminate\Support\Carbon::parse($day, ReportTimezone::timezone())->format('d M'),
                'orders_count' => (int) $rows->count(),
                'revenue_total' => (int) round($rows->sum('grand_total')),
            ])
            ->values()
            ->all();
    }

    public static function cashierPerformance(Collection $allocations): array
    {
        return $allocations
            ->groupBy(fn ($allocation) => (int) ($allocation->transaction?->cashier_id ?? 0))
            ->filter(fn (Collection $rows, int $cashierId) => $cashierId > 0)
            ->map(function (Collection $rows, int $cashierId) {
                $ordersCount = (int) $rows->count();
                $walkInOrders = (int) $rows->filter(fn ($allocation) => blank($allocation->transaction?->customer_id))->count();
                $revenueTotal = (int) $rows->sum('grand_total');
                $walkInRevenue = (int) $rows
                    ->filter(fn ($allocation) => blank($allocation->transaction?->customer_id))
                    ->sum('grand_total');

                return [
                    'cashier_id' => $cashierId,
                    'cashier_name' => $rows->first()?->transaction?->cashier?->name,
                    'orders_count' => $ordersCount,
                    'walk_in_orders_count' => $walkInOrders,
                    'registered_orders_count' => max(0, $ordersCount - $walkInOrders),
                    'items_sold' => (int) $rows->sum('total_items'),
                    'revenue_total' => (int) round($revenueTotal),
                    'walk_in_revenue_total' => (int) round($walkInRevenue),
                    'registered_revenue_total' => max(0, (int) round($revenueTotal - $walkInRevenue)),
                    'profit_total' => (int) round($rows->sum('profit_total')),
                    'average_basket' => $ordersCount > 0 ? (int) round($revenueTotal / $ordersCount) : 0,
                    'walk_in_share' => $ordersCount > 0 ? round(($walkInOrders / $ordersCount) * 100, 2) : 0,
                ];
            })
            ->sortByDesc(fn (array $row) => [$row['items_sold'], $row['revenue_total']])
            ->values()
            ->all();
    }

    public static function orderSourceStats(Collection $allocations): array
    {
        $rows = $allocations
            ->groupBy(fn ($allocation) => (string) ($allocation->transaction?->source_channel ?: 'pos'))
            ->map(fn (Collection $rows, string $channel) => (object) [
                'source_channel' => $channel,
                'orders_count' => (int) $rows->count(),
                'revenue_total' => (int) $rows->sum('grand_total'),
                'items_sold' => (int) $rows->sum('total_items'),
            ])
            ->values();

        return self::formatOrderSourceStats($rows);
    }

    public static function orderTypeStats(Collection $allocations): array
    {
        $rows = $allocations
            ->groupBy(fn ($allocation) => (string) ($allocation->transaction?->order_type ?: 'take_away'))
            ->map(fn (Collection $rows, string $orderType) => (object) [
                'order_type' => $orderType,
                'orders_count' => (int) $rows->count(),
                'revenue_total' => (int) $rows->sum('grand_total'),
                'items_sold' => (int) $rows->sum('total_items'),
            ])
            ->values();

        return self::formatOrderTypeStats($rows);
    }

    protected static function formatOrderSourceStats($rows): array
    {
        $stats = collect([
            'pos' => ['key' => 'pos', 'label' => 'Kasir', 'orders_count' => 0, 'revenue_total' => 0, 'items_sold' => 0, 'average_order' => 0, 'revenue_share' => 0, 'orders_share' => 0],
            'table_qr' => ['key' => 'table_qr', 'label' => 'Self Order', 'orders_count' => 0, 'revenue_total' => 0, 'items_sold' => 0, 'average_order' => 0, 'revenue_share' => 0, 'orders_share' => 0],
            'other' => ['key' => 'other', 'label' => 'Channel Lain', 'orders_count' => 0, 'revenue_total' => 0, 'items_sold' => 0, 'average_order' => 0, 'revenue_share' => 0, 'orders_share' => 0],
        ]);

        foreach ($rows as $row) {
            $rawKey = (string) ($row->source_channel ?? 'pos');
            $key = in_array($rawKey, ['pos', 'table_qr'], true) ? $rawKey : 'other';
            $current = $stats->get($key);
            $current['orders_count'] += (int) ($row->orders_count ?? 0);
            $current['revenue_total'] += (int) round($row->revenue_total ?? 0);
            $current['items_sold'] += (int) round($row->items_sold ?? 0);
            $stats->put($key, $current);
        }

        $totalOrders = (int) $stats->sum('orders_count');
        $totalRevenue = (int) $stats->sum('revenue_total');

        return [
            'summary' => ['total_orders' => $totalOrders, 'total_revenue' => $totalRevenue],
            'channels' => $stats->map(function (array $row) use ($totalOrders, $totalRevenue) {
                $row['average_order'] = $row['orders_count'] > 0 ? (int) round($row['revenue_total'] / $row['orders_count']) : 0;
                $row['revenue_share'] = $totalRevenue > 0 ? round(($row['revenue_total'] / $totalRevenue) * 100, 2) : 0;
                $row['orders_share'] = $totalOrders > 0 ? round(($row['orders_count'] / $totalOrders) * 100, 2) : 0;
                return $row;
            })->values()->all(),
        ];
    }

    protected static function formatOrderTypeStats($rows): array
    {
        $stats = collect([
            'dine_in' => ['key' => 'dine_in', 'label' => 'Dine In', 'orders_count' => 0, 'revenue_total' => 0, 'items_sold' => 0, 'average_order' => 0, 'revenue_share' => 0, 'orders_share' => 0],
            'take_away' => ['key' => 'take_away', 'label' => 'Take Away', 'orders_count' => 0, 'revenue_total' => 0, 'items_sold' => 0, 'average_order' => 0, 'revenue_share' => 0, 'orders_share' => 0],
            'other' => ['key' => 'other', 'label' => 'Order Lain', 'orders_count' => 0, 'revenue_total' => 0, 'items_sold' => 0, 'average_order' => 0, 'revenue_share' => 0, 'orders_share' => 0],
        ]);

        foreach ($rows as $row) {
            $rawKey = (string) ($row->order_type ?? 'take_away');
            $key = in_array($rawKey, ['dine_in', 'take_away'], true) ? $rawKey : 'other';
            $current = $stats->get($key);
            $current['orders_count'] += (int) ($row->orders_count ?? 0);
            $current['revenue_total'] += (int) round($row->revenue_total ?? 0);
            $current['items_sold'] += (int) round($row->items_sold ?? 0);
            $stats->put($key, $current);
        }

        $totalOrders = (int) $stats->sum('orders_count');
        $totalRevenue = (int) $stats->sum('revenue_total');

        return [
            'summary' => ['total_orders' => $totalOrders, 'total_revenue' => $totalRevenue],
            'types' => $stats->map(function (array $row) use ($totalOrders, $totalRevenue) {
                $row['average_order'] = $row['orders_count'] > 0 ? (int) round($row['revenue_total'] / $row['orders_count']) : 0;
                $row['revenue_share'] = $totalRevenue > 0 ? round(($row['revenue_total'] / $totalRevenue) * 100, 2) : 0;
                $row['orders_share'] = $totalOrders > 0 ? round(($row['orders_count'] / $totalOrders) * 100, 2) : 0;
                return $row;
            })->values()->all(),
        ];
    }
}
