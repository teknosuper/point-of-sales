<?php

namespace App\Support;

use Illuminate\Support\Collection;

class ReportTenantSalesMetrics
{
    public static function summary(Collection $allocations): array
    {
        $ordersCount = (int) $allocations->count();
        $revenueTotal = (int) $allocations->sum('grand_total');
        $discountTotal = (int) $allocations->sum('total_discount_total');
        $itemsSold = (int) $allocations->sum('total_items');
        $profitTotal = (int) $allocations->sum('profit_total');
        $customerProfileSummary = ReportCustomerProfileMetrics::fromRows(
            $allocations,
            'transaction.customer_id'
        );

        return [
            'orders_count' => $ordersCount,
            'revenue_total' => $revenueTotal,
            'discount_total' => $discountTotal,
            'tenant_discount_total' => $discountTotal,
            'owner_discount_total' => 0,
            'items_sold' => $itemsSold,
            'profit_total' => $profitTotal,
            'average_order' => $ordersCount > 0
                ? (int) round($revenueTotal / $ordersCount)
                : 0,
            'walk_in_count' => (int) ($customerProfileSummary['walk_in_count'] ?? 0),
            'registered_customer_count' => (int) ($customerProfileSummary['registered_customer_count'] ?? 0),
            'active_customer_count' => (int) ($customerProfileSummary['active_customer_count'] ?? 0),
        ];
    }

    public static function paymentMethodBreakdown(Collection $allocations): array
    {
        return $allocations
            ->groupBy(fn ($allocation) => $allocation->transaction?->payment_method ?? 'unknown')
            ->map(function (Collection $rows, $paymentMethod) {
                return [
                    'payment_method' => $paymentMethod,
                    'payment_method_label' => self::formatPaymentMethod($paymentMethod),
                    'orders_count' => (int) $rows->count(),
                    'revenue_total' => (int) $rows->sum('grand_total'),
                ];
            })
            ->sortByDesc('revenue_total')
            ->values()
            ->toArray();
    }

    public static function hourlyBreakdown(Collection $allocations): array
    {
        return $allocations
            ->groupBy(fn ($allocation) => ReportTimezone::sourceToDisplayCarbon(
                $allocation->transaction?->getRawOriginal('created_at') ?? $allocation->transaction?->created_at
            )?->format('H'))
            ->filter(fn ($rows, $hour) => $hour !== null)
            ->sortKeys()
            ->map(function (Collection $rows, $hour) {
                return [
                    'hour' => (int) $hour,
                    'label' => str_pad((string) $hour, 2, '0', STR_PAD_LEFT).':00',
                    'orders_count' => (int) $rows->count(),
                    'revenue_total' => (int) $rows->sum('grand_total'),
                    'discount_total' => (int) $rows->sum('total_discount_total'),
                ];
            })
            ->values()
            ->toArray();
    }

    public static function dailyBreakdown(Collection $allocations, int $limit = 30): array
    {
        return $allocations
            ->groupBy(fn ($allocation) => ReportTimezone::sourceDateKey(
                $allocation->transaction?->getRawOriginal('created_at') ?? $allocation->transaction?->created_at
            ))
            ->filter(fn ($rows, $date) => $date !== null)
            ->sortKeysDesc()
            ->take($limit)
            ->map(function (Collection $rows, $date) {
                return [
                    'date' => $date,
                    'label' => \Carbon\Carbon::createFromFormat('Y-m-d', $date, ReportTimezone::timezone())->translatedFormat('d M'),
                    'orders_count' => (int) $rows->count(),
                    'revenue_total' => (int) $rows->sum('grand_total'),
                    'discount_total' => (int) $rows->sum('total_discount_total'),
                ];
            })
            ->reverse()
            ->values()
            ->toArray();
    }

    protected static function formatPaymentMethod(?string $method): string
    {
        return match ($method) {
            'cash' => 'Cash',
            'bank_transfer' => 'Transfer Bank',
            'qris' => 'QRIS',
            'midtrans' => 'Midtrans',
            'xendit' => 'Xendit',
            'pay_later' => 'Bayar Nanti',
            default => ucfirst($method ?? 'Tidak Diketahui'),
        };
    }
}
