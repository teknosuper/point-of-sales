<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerOutletMetric;
use App\Models\Outlet;
use App\Models\CustomerSegment;
use App\Models\CustomerSegmentMembership;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Schema;

class CustomerSegmentationService
{
    public function __construct(
        private readonly CustomerOutletMetricService $customerOutletMetricService
    ) {}

    public function defaultAutoSegments(): array
    {
        return [
            [
                'name' => 'High Spender',
                'slug' => 'high_spender',
                'type' => CustomerSegment::TYPE_AUTO,
                'description' => 'Pelanggan dengan total belanja tinggi.',
                'auto_rule_type' => CustomerSegment::RULE_SPENDING,
                'rule_config' => [
                    'min_total_spent' => 1500000,
                ],
            ],
            [
                'name' => 'Frequent Buyer',
                'slug' => 'frequent_buyer',
                'type' => CustomerSegment::TYPE_AUTO,
                'description' => 'Pelanggan yang aktif berbelanja dengan frekuensi tinggi.',
                'auto_rule_type' => CustomerSegment::RULE_PURCHASE_FREQUENCY,
                'rule_config' => [
                    'min_transaction_count' => 5,
                    'recent_days' => 45,
                ],
            ],
            [
                'name' => 'Inactive Customer',
                'slug' => 'inactive_customer',
                'type' => CustomerSegment::TYPE_AUTO,
                'description' => 'Pelanggan yang sudah lama tidak melakukan pembelian ulang.',
                'auto_rule_type' => CustomerSegment::RULE_PURCHASE_FREQUENCY,
                'rule_config' => [
                    'inactivity_days_min' => 30,
                    'min_transaction_count' => 1,
                ],
            ],
            [
                'name' => 'Credit Customer',
                'slug' => 'credit_customer',
                'type' => CustomerSegment::TYPE_AUTO,
                'description' => 'Pelanggan yang masih memiliki piutang aktif.',
                'auto_rule_type' => CustomerSegment::RULE_RECEIVABLE_BEHAVIOR,
                'rule_config' => [
                    'require_outstanding_receivable' => true,
                ],
            ],
            [
                'name' => 'Overdue Customer',
                'slug' => 'overdue_customer',
                'type' => CustomerSegment::TYPE_AUTO,
                'description' => 'Pelanggan dengan piutang jatuh tempo atau overdue.',
                'auto_rule_type' => CustomerSegment::RULE_RECEIVABLE_BEHAVIOR,
                'rule_config' => [
                    'overdue_only' => true,
                ],
            ],
        ];
    }

    public function ensureDefaultAutoSegments(): void
    {
        foreach ($this->defaultAutoSegments() as $segment) {
            CustomerSegment::query()->updateOrCreate(
                ['slug' => $segment['slug']],
                [
                    ...$segment,
                    'is_active' => true,
                ]
            );
        }
    }

    public function syncAutoSegments(?CarbonInterface $at = null, ?int $outletId = null): void
    {
        $at = $at ?? now();
        $this->ensureDefaultAutoSegments();

        if ($outletId === null && Schema::hasTable('outlets')) {
            Outlet::query()
                ->active()
                ->pluck('id')
                ->each(fn ($resolvedOutletId) => $this->syncAutoSegments($at, (int) $resolvedOutletId));

            return;
        }

        $segments = CustomerSegment::query()
            ->where('type', CustomerSegment::TYPE_AUTO)
            ->where('is_active', true)
            ->get();

        Customer::query()
            ->with([
                'receivables' => fn ($query) => $query->when($outletId, fn ($receivableQuery) => $receivableQuery->where('outlet_id', $outletId)),
                'outletMetrics' => fn ($query) => $query->when($outletId, fn ($metricQuery) => $metricQuery->where('outlet_id', $outletId)),
            ])
            ->orderBy('id')
            ->chunkById(100, function ($customers) use ($segments, $at, $outletId) {
                foreach ($customers as $customer) {
                    foreach ($segments as $segment) {
                        $matches = $this->matchesAutoSegment($customer, $segment, $at, $outletId);

                        if ($matches) {
                            CustomerSegmentMembership::query()->updateOrCreate([
                                'customer_id' => $customer->id,
                                'customer_segment_id' => $segment->id,
                                'outlet_id' => $outletId,
                            ], [
                                'source' => CustomerSegmentMembership::SOURCE_AUTO,
                                'matched_at' => $at,
                            ]);
                        } else {
                            CustomerSegmentMembership::query()
                                ->where('customer_id', $customer->id)
                                ->where('customer_segment_id', $segment->id)
                                ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
                                ->delete();
                        }
                    }
                }
            });
    }

    public function syncManualSegments(Customer $customer, array $segmentIds, ?int $outletId = null): void
    {
        $segments = CustomerSegment::query()
            ->where('type', CustomerSegment::TYPE_MANUAL)
            ->whereIn('id', $segmentIds)
            ->pluck('id')
            ->all();

        $customer->segmentMemberships()
            ->where('source', CustomerSegmentMembership::SOURCE_MANUAL)
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->whereNotIn('customer_segment_id', $segments)
            ->delete();

        foreach ($segments as $segmentId) {
            CustomerSegmentMembership::query()->updateOrCreate(
                [
                    'customer_id' => $customer->id,
                    'customer_segment_id' => $segmentId,
                    'outlet_id' => $outletId,
                ],
                [
                    'source' => CustomerSegmentMembership::SOURCE_MANUAL,
                    'matched_at' => now(),
                ]
            );
        }
    }

    public function serializeCustomerSegments(Customer $customer, ?int $outletId = null): array
    {
        return $customer->segments()
            ->when($outletId, fn ($query) => $query->wherePivot('outlet_id', $outletId))
            ->get()
            ->sortBy('name')
            ->values()
            ->map(fn (CustomerSegment $segment) => [
                'id' => $segment->id,
                'name' => $segment->name,
                'slug' => $segment->slug,
                'type' => $segment->type,
                'source' => $segment->pivot?->source,
                'outlet_id' => $segment->pivot?->outlet_id,
                'matched_at' => optional($segment->pivot?->matched_at)->toIso8601String(),
            ])
            ->all();
    }

    public function segmentOptions(string $type = 'all'): array
    {
        return CustomerSegment::query()
            ->when($type !== 'all', fn ($query) => $query->where('type', $type))
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (CustomerSegment $segment) => [
                'value' => $segment->id,
                'label' => $segment->name,
                'type' => $segment->type,
            ])
            ->all();
    }

    public function segmentStats(CustomerSegment $segment, ?int $outletId = null): array
    {
        $memberships = $segment->memberships()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->with('customer:id')
            ->get();

        return [
            'total_members' => $memberships->count(),
            'manual_members' => $memberships->where('source', CustomerSegmentMembership::SOURCE_MANUAL)->count(),
            'auto_members' => $memberships->where('source', CustomerSegmentMembership::SOURCE_AUTO)->count(),
        ];
    }

    private function matchesAutoSegment(
        Customer $customer,
        CustomerSegment $segment,
        CarbonInterface $at,
        ?int $outletId = null
    ): bool {
        $config = $segment->rule_config ?? [];
        $metrics = $this->customerMetrics($customer, $outletId);

        return match ($segment->slug) {
            'high_spender' => (int) $metrics['total_spent'] >= (int) ($config['min_total_spent'] ?? 1500000),
            'frequent_buyer' => $this->matchesFrequentBuyer($metrics, $config, $at),
            'inactive_customer' => $this->matchesInactiveCustomer($metrics, $config, $at),
            'credit_customer' => $this->matchesCreditCustomer($customer, $outletId),
            'overdue_customer' => $this->matchesOverdueCustomer($customer, $outletId),
            default => false,
        };
    }

    private function matchesFrequentBuyer(array $metrics, array $config, CarbonInterface $at): bool
    {
        $recentDays = (int) ($config['recent_days'] ?? 45);
        $minTransactionCount = (int) ($config['min_transaction_count'] ?? 5);

        if ((int) ($metrics['transaction_count'] ?? 0) < $minTransactionCount) {
            return false;
        }

        $lastPurchaseAt = $metrics['last_purchase_at'] ?? null;
        if (! $lastPurchaseAt) {
            return false;
        }

        return $lastPurchaseAt->gte($at->copy()->subDays($recentDays));
    }

    private function matchesInactiveCustomer(array $metrics, array $config, CarbonInterface $at): bool
    {
        $minTransactionCount = (int) ($config['min_transaction_count'] ?? 1);
        $inactivityDays = (int) ($config['inactivity_days_min'] ?? 30);

        if ((int) ($metrics['transaction_count'] ?? 0) < $minTransactionCount) {
            return false;
        }

        $lastPurchaseAt = $metrics['last_purchase_at'] ?? null;
        if (! $lastPurchaseAt) {
            return true;
        }

        return $lastPurchaseAt->lt($at->copy()->subDays($inactivityDays));
    }

    private function matchesCreditCustomer(Customer $customer, ?int $outletId = null): bool
    {
        return $customer->receivables
            ->when($outletId, fn ($receivables) => $receivables->where('outlet_id', $outletId))
            ->filter(fn ($receivable) => $receivable->status !== 'paid' && $receivable->remaining > 0)
            ->isNotEmpty();
    }

    private function matchesOverdueCustomer(Customer $customer, ?int $outletId = null): bool
    {
        return $customer->receivables
            ->when($outletId, fn ($receivables) => $receivables->where('outlet_id', $outletId))
            ->filter(fn ($receivable) => $receivable->status !== 'paid' && $receivable->due_date && now()->gt($receivable->due_date))
            ->isNotEmpty();
    }

    private function customerMetrics(Customer $customer, ?int $outletId = null): array
    {
        if (! $outletId) {
            return $this->customerOutletMetricService->metricsForCustomer($customer);
        }

        $metric = $customer->outletMetrics->firstWhere('outlet_id', $outletId);

        if ($metric instanceof CustomerOutletMetric) {
            return [
                'total_spent' => (int) $metric->total_spent,
                'transaction_count' => (int) $metric->transaction_count,
                'last_purchase_at' => $metric->last_purchase_at,
            ];
        }

        return $this->customerOutletMetricService->metricsForCustomer($customer, $outletId);
    }
}
