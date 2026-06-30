<?php

namespace App\Services;

use App\Models\SalesReturn;
use App\Support\ReportCustomerProfileMetrics;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class TransactionReturnImpactService
{
    public function completedReturnMapForTransactionIds(Collection $transactionIds): Collection
    {
        $transactionIds = $transactionIds
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        if ($transactionIds->isEmpty()) {
            return collect();
        }

        return SalesReturn::query()
            ->selectRaw('transaction_id, COUNT(*) as completed_returns_count, COALESCE(SUM(total_return_amount), 0) as returned_amount_total')
            ->whereIn('transaction_id', $transactionIds->all())
            ->where('status', 'completed')
            ->groupBy('transaction_id')
            ->get()
            ->mapWithKeys(fn ($row) => [
                (int) $row->transaction_id => [
                    'completed_returns_count' => (int) ($row->completed_returns_count ?? 0),
                    'returned_amount_total' => (int) ($row->returned_amount_total ?? 0),
                ],
            ]);
    }

    public function enrichTransactions(Collection $transactions): Collection
    {
        if ($transactions->isEmpty()) {
            return $transactions;
        }

        $returnMap = $this->completedReturnMapForTransactionIds(
            $transactions->map(fn ($transaction) => (int) data_get($transaction, 'id'))
        );

        return $transactions->map(function ($transaction) use ($returnMap) {
            $transactionId = (int) data_get($transaction, 'id');
            $grandTotal = (int) data_get($transaction, 'grand_total', 0);
            $returnStats = $returnMap->get($transactionId, [
                'completed_returns_count' => 0,
                'returned_amount_total' => 0,
            ]);
            $returnedAmountTotal = min(
                $grandTotal,
                max(0, (int) ($returnStats['returned_amount_total'] ?? 0))
            );
            $netGrandTotal = max(0, $grandTotal - $returnedAmountTotal);
            $completedReturnsCount = (int) ($returnStats['completed_returns_count'] ?? 0);
            $isFullyReturned = $grandTotal > 0 && $netGrandTotal === 0 && $completedReturnsCount > 0;

            $this->setValue($transaction, 'completed_returns_count', $completedReturnsCount);
            $this->setValue($transaction, 'returned_amount_total', $returnedAmountTotal);
            $this->setValue($transaction, 'net_grand_total', $netGrandTotal);
            $this->setValue($transaction, 'is_fully_returned', $isFullyReturned);

            return $transaction;
        });
    }

    public function summarizeTransactionRows(Collection $rows): array
    {
        $rows = $this->enrichTransactions($rows);
        $activeRows = $rows->filter(fn ($row) => ! (bool) data_get($row, 'is_fully_returned', false))->values();

        $ordersCount = $activeRows->count();
        $revenueTotal = (int) $rows->sum(fn ($row) => (int) data_get($row, 'net_grand_total', data_get($row, 'grand_total', 0)));
        $discountTotal = (int) $rows->sum(fn ($row) => (int) data_get($row, 'discount', 0));
        $customerProfileSummary = ReportCustomerProfileMetrics::fromRows($activeRows);

        return [
            'orders_count' => $ordersCount,
            'revenue_total' => $revenueTotal,
            'discount_total' => $discountTotal,
            'walk_in_count' => (int) ($customerProfileSummary['walk_in_count'] ?? 0),
            'registered_customer_count' => (int) ($customerProfileSummary['registered_customer_count'] ?? 0),
            'active_customer_count' => (int) ($customerProfileSummary['active_customer_count'] ?? 0),
            'average_order' => $ordersCount > 0 ? (int) round($revenueTotal / $ordersCount) : 0,
        ];
    }

    private function setValue(mixed $target, string $key, mixed $value): void
    {
        if ($target instanceof Model) {
            $target->setAttribute($key, $value);

            return;
        }

        if (is_object($target)) {
            $target->{$key} = $value;
        }
    }
}
