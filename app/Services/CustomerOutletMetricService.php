<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerOutletMetric;
use App\Models\Setting;
use App\Models\Transaction;
use Illuminate\Support\Collection;

class CustomerOutletMetricService
{
    public function syncForCustomer(Customer $customer, int $outletId): CustomerOutletMetric
    {
        $aggregate = Transaction::query()
            ->where('customer_id', $customer->id)
            ->where('outlet_id', $outletId)
            ->selectRaw('
                COALESCE(SUM(grand_total), 0) as total_spent,
                COUNT(*) as transaction_count,
                COALESCE(SUM(loyalty_points_earned), 0) as loyalty_points_earned,
                COALESCE(SUM(loyalty_points_redeemed), 0) as loyalty_points_redeemed,
                MAX(created_at) as last_purchase_at
            ')
            ->first();

        return CustomerOutletMetric::query()->updateOrCreate(
            [
                'customer_id' => $customer->id,
                'outlet_id' => $outletId,
            ],
            [
                'total_spent' => (int) ($aggregate->total_spent ?? 0),
                'transaction_count' => (int) ($aggregate->transaction_count ?? 0),
                'loyalty_points_earned' => (int) ($aggregate->loyalty_points_earned ?? 0),
                'loyalty_points_redeemed' => (int) ($aggregate->loyalty_points_redeemed ?? 0),
                'loyalty_tier' => $this->resolveTierForTotalSpent((int) ($aggregate->total_spent ?? 0), $outletId),
                'last_purchase_at' => $aggregate->last_purchase_at,
            ]
        );
    }

    public function syncForCustomers(iterable $customers, int $outletId): void
    {
        foreach ($customers as $customer) {
            if ($customer instanceof Customer) {
                $this->syncForCustomer($customer, $outletId);
            }
        }
    }

    public function metricsForCustomer(Customer $customer, ?int $outletId = null): array
    {
        if (! $outletId) {
            return [
                'total_spent' => (int) $customer->loyalty_total_spent,
                'transaction_count' => (int) $customer->loyalty_transaction_count,
                'loyalty_tier' => (string) ($customer->loyalty_tier ?: LoyaltyService::TIER_REGULAR),
                'last_purchase_at' => $customer->last_purchase_at,
            ];
        }

        $metric = CustomerOutletMetric::query()
            ->where('customer_id', $customer->id)
            ->where('outlet_id', $outletId)
            ->first();

        if (! $metric) {
            $metric = $this->syncForCustomer($customer, $outletId);
        }

        return [
            'total_spent' => (int) $metric->total_spent,
            'transaction_count' => (int) $metric->transaction_count,
            'loyalty_tier' => (string) ($metric->loyalty_tier ?: $customer->loyalty_tier ?: LoyaltyService::TIER_REGULAR),
            'last_purchase_at' => $metric->last_purchase_at,
        ];
    }

    public function setTier(Customer $customer, int $outletId, string $tier): CustomerOutletMetric
    {
        $metric = CustomerOutletMetric::query()->firstOrCreate(
            [
                'customer_id' => $customer->id,
                'outlet_id' => $outletId,
            ],
            [
                'total_spent' => 0,
                'transaction_count' => 0,
                'loyalty_points_earned' => 0,
                'loyalty_points_redeemed' => 0,
                'loyalty_tier' => $tier,
            ]
        );

        if ($metric->loyalty_tier !== $tier) {
            $metric->forceFill(['loyalty_tier' => $tier])->save();
        }

        return $metric->refresh();
    }

    public function topMembers(?int $outletId = null, int $limit = 5): Collection
    {
        if (! $outletId) {
            return Customer::query()
                ->where('is_loyalty_member', true)
                ->orderByDesc('loyalty_total_spent')
                ->limit($limit)
                ->get();
        }

        return CustomerOutletMetric::query()
            ->with('customer:id,name,is_loyalty_member')
            ->where('outlet_id', $outletId)
            ->whereHas('customer', fn ($query) => $query->where('is_loyalty_member', true))
            ->orderByDesc('total_spent')
            ->limit($limit)
            ->get();
    }

    private function resolveTierForTotalSpent(int $totalSpent, ?int $outletId = null): string
    {
        $thresholds = [
            LoyaltyService::TIER_REGULAR => Setting::getInt('loyalty_tier_regular_threshold', 0, $outletId),
            LoyaltyService::TIER_SILVER => Setting::getInt('loyalty_tier_silver_threshold', 500000, $outletId),
            LoyaltyService::TIER_GOLD => Setting::getInt('loyalty_tier_gold_threshold', 1500000, $outletId),
            LoyaltyService::TIER_PLATINUM => Setting::getInt('loyalty_tier_platinum_threshold', 3000000, $outletId),
        ];

        $tier = LoyaltyService::TIER_REGULAR;

        foreach ($thresholds as $candidate => $minimumTotalSpent) {
            if ($totalSpent >= $minimumTotalSpent) {
                $tier = $candidate;
            }
        }

        return $tier;
    }
}
