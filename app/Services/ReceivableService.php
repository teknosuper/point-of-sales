<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Receivable;
use Illuminate\Support\Collection;

class ReceivableService
{
    public function getAgingSummary(?int $outletId = null): Collection
    {
        $receivables = Receivable::where('status', '!=', 'paid')
            ->whereNotNull('due_date')
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->get();

        $buckets = ['current', '0-30', '31-60', '61-90', '90+'];

        return collect($buckets)->map(function ($bucket) use ($receivables) {
            $filtered = $receivables->filter(fn ($r) => $r->aging_bucket === $bucket);

            return [
                'bucket' => $bucket,
                'count' => $filtered->count(),
                'total' => $filtered->sum('total'),
                'paid' => $filtered->sum('paid'),
                'remaining' => $filtered->sum(fn ($r) => max(0, $r->total - $r->paid)),
            ];
        });
    }

    public function getCustomerStatement(int $customerId, ?int $outletId = null): array
    {
        $customer = Customer::findOrFail($customerId);

        $receivables = Receivable::where('customer_id', $customerId)
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->withSum('payments as total_paid', 'amount')
            ->orderBy('due_date')
            ->get();

        $receivables->transform(function ($item) {
            $item->aging_bucket = $item->aging_bucket;

            return $item;
        });

        $totalOutstanding = $receivables
            ->where('status', '!=', 'paid')
            ->sum(fn ($r) => max(0, $r->total - $r->total_paid));

        $totalPaid = $receivables->sum('total_paid');

        return [
            'customer' => $customer,
            'receivables' => $receivables,
            'total_outstanding' => $totalOutstanding,
            'total_paid' => $totalPaid,
        ];
    }

    public function getCollectionRate(?int $outletId = null): array
    {
        $receivableQuery = Receivable::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId));

        $totalReceivables = (clone $receivableQuery)->sum('total');
        $totalPaid = (clone $receivableQuery)->sum('paid');
        $paidReceivables = (clone $receivableQuery)->where('status', 'paid')->count();
        $totalReceivablesCount = (clone $receivableQuery)->count();

        return [
            'total_receivables_amount' => $totalReceivables,
            'total_paid_amount' => $totalPaid,
            'collection_rate' => $totalReceivables > 0
                ? round(($totalPaid / $totalReceivables) * 100, 2)
                : 0,
            'paid_count' => $paidReceivables,
            'total_count' => $totalReceivablesCount,
        ];
    }

    public function getTopCustomersByReceivable(int $limit = 10, ?int $outletId = null): Collection
    {
        return Customer::withSum([
            'receivables as total_receivable' => fn ($q) => $q
                ->where('status', '!=', 'paid')
                ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId)),
        ], 'total')
        ->withSum([
            'receivables as total_paid' => fn ($q) => $q
                ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId)),
        ], 'paid')
            ->orderByRaw('COALESCE(total_receivable, 0) DESC')
            ->limit($limit)
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'total_receivable' => $c->total_receivable ?? 0,
                'total_paid' => $c->total_paid ?? 0,
                'remaining' => max(0, ($c->total_receivable ?? 0) - ($c->total_paid ?? 0)),
            ])
            ->filter(fn ($c) => $c['remaining'] > 0)
            ->values();
    }
}
