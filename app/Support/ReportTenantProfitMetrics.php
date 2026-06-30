<?php

namespace App\Support;

use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class ReportTenantProfitMetrics
{
    public static function appendMetrics(Collection|LengthAwarePaginator $allocations): Collection|LengthAwarePaginator
    {
        if ($allocations instanceof LengthAwarePaginator) {
            $allocations->setCollection(self::appendMetrics($allocations->getCollection()));

            return $allocations;
        }

        return $allocations->map(function (TransactionTenantAllocation $allocation) {
            $revenueTotal = (int) ($allocation->grand_total ?? 0);
            $costTotal = (int) $allocation->items->sum(function (TransactionTenantAllocationItem $item) {
                $tenantHppPrice = (int) ($item->product?->tenant_hpp_price ?? $item->base_unit_price ?? 0);

                return $tenantHppPrice * (int) ($item->qty ?? 0);
            });
            $profitTotal = $revenueTotal - $costTotal;
            $discountTotal = (int) ($allocation->promo_discount_total ?? 0)
                + (int) ($allocation->voucher_discount_total ?? 0)
                + (int) ($allocation->loyalty_discount_total ?? 0)
                + (int) ($allocation->manual_discount_total ?? 0);

            $allocation->setAttribute('cost_total', $costTotal);
            $allocation->setAttribute('profit_total', $profitTotal);
            $allocation->setAttribute('pre_promo_subtotal', (int) ($allocation->subtotal ?? 0) + (int) ($allocation->promo_discount_total ?? 0));
            $allocation->setAttribute('discount_total', $discountTotal);

            return $allocation;
        });
    }

    public static function summary(Collection $allocations): array
    {
        $ordersCount = (int) $allocations->count();
        $revenueTotal = (int) $allocations->sum('grand_total');
        $profitTotal = (int) $allocations->sum('profit_total');
        $customerProfileSummary = ReportCustomerProfileMetrics::fromRows(
            $allocations,
            'transaction.customer_id'
        );

        return [
            'profit_total' => $profitTotal,
            'revenue_total' => $revenueTotal,
            'orders_count' => $ordersCount,
            'items_sold' => (int) $allocations->sum('total_items'),
            'walk_in_count' => (int) ($customerProfileSummary['walk_in_count'] ?? 0),
            'average_profit' => $ordersCount > 0 ? (int) round($profitTotal / $ordersCount) : 0,
            'margin' => $revenueTotal > 0 ? round(($profitTotal / $revenueTotal) * 100, 2) : 0,
            'best_invoice' => $allocations->sortByDesc('profit_total')->first()?->transaction?->invoice,
            'best_profit' => (int) ($allocations->sortByDesc('profit_total')->first()?->profit_total ?? 0),
            'base_cost_total' => (int) $allocations->sum('cost_total'),
            'markup_total' => $profitTotal,
            'tenant_revenue_total' => $revenueTotal,
            'tenant_discount_total' => (int) $allocations->sum('discount_total'),
            'owner_discount_total' => 0,
            'owner_direct_revenue_total' => 0,
            'owner_direct_markup_total' => 0,
            'tenant_markup_total' => $profitTotal,
            'tenant_profit_total' => $profitTotal,
            'registered_customer_count' => (int) ($customerProfileSummary['registered_customer_count'] ?? 0),
            'active_customer_count' => (int) ($customerProfileSummary['active_customer_count'] ?? 0),
        ];
    }

    public static function cashierSummary(Collection $allocations): array
    {
        return $allocations
            ->groupBy(fn (TransactionTenantAllocation $allocation) => (int) ($allocation->transaction?->cashier_id ?? 0))
            ->filter(fn (Collection $rows, int $cashierId) => $cashierId > 0)
            ->map(function (Collection $rows, int $cashierId) {
                $ordersCount = (int) $rows->count();
                $customerProfileSummary = ReportCustomerProfileMetrics::fromRows(
                    $rows,
                    'transaction.customer_id'
                );
                $walkInCount = (int) ($customerProfileSummary['walk_in_count'] ?? 0);
                $profitTotal = (int) $rows->sum('profit_total');

                return [
                    'cashier_id' => $cashierId,
                    'cashier_name' => $rows->first()?->transaction?->cashier?->name,
                    'orders_count' => $ordersCount,
                    'walk_in_count' => $walkInCount,
                    'registered_customer_count' => (int) ($customerProfileSummary['registered_customer_count'] ?? 0),
                    'revenue_total' => (int) $rows->sum('grand_total'),
                    'profit_total' => $profitTotal,
                    'walk_in_share' => $ordersCount > 0 ? round(($walkInCount / $ordersCount) * 100, 2) : 0,
                    'average_profit' => $ordersCount > 0 ? (int) round($profitTotal / $ordersCount) : 0,
                ];
            })
            ->sortByDesc('profit_total')
            ->values()
            ->all();
    }

    public static function dailyTrend(Collection $allocations, callable $dayLabelFormatter): Collection
    {
        return $allocations
            ->groupBy(fn (TransactionTenantAllocation $allocation) => ReportTimezone::sourceDateKey($allocation->transaction?->getRawOriginal('created_at')))
            ->filter(fn (Collection $rows, ?string $day) => filled($day))
            ->map(function (Collection $rows, string $day) use ($dayLabelFormatter) {
                $revenueTotal = (int) $rows->sum('grand_total');
                $baseCostTotal = (int) $rows->sum('cost_total');

                return [
                    'day' => $day,
                    'label' => $dayLabelFormatter($day),
                    'orders_count' => (int) $rows->count(),
                    'revenue_total' => $revenueTotal,
                    'profit_total' => (int) $rows->sum('profit_total'),
                    'base_cost_total' => $baseCostTotal,
                    'markup_total' => max(0, $revenueTotal - $baseCostTotal),
                    'discount_total' => (int) $rows->sum('discount_total'),
                    'owner_direct_revenue_total' => 0,
                    'owner_direct_markup_total' => 0,
                    'tenant_after_promo_total' => $revenueTotal,
                    'tenant_discount_total' => (int) $rows->sum('discount_total'),
                ];
            })
            ->sortBy('day')
            ->values();
    }
}
