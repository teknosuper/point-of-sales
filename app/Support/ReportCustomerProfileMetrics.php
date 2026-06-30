<?php

namespace App\Support;

use Illuminate\Support\Collection;

class ReportCustomerProfileMetrics
{
    public static function fromRows(
        Collection $rows,
        string $customerKey = 'customer_id'
    ): array {
        $walkInCount = (int) $rows->filter(
            fn ($row) => blank(data_get($row, $customerKey))
        )->count();
        $activeCustomerCount = (int) $rows
            ->map(fn ($row) => data_get($row, $customerKey))
            ->filter(fn ($customerId) => filled($customerId))
            ->unique()
            ->count();
        $ordersCount = (int) $rows->count();

        return [
            'walk_in_count' => $walkInCount,
            'registered_customer_count' => max(0, $ordersCount - $walkInCount),
            'active_customer_count' => $activeCustomerCount,
        ];
    }
}
