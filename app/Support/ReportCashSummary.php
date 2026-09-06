<?php

namespace App\Support;

use App\Models\CashierSettlementRequest;
use App\Models\Expense;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class ReportCashSummary
{
    public static function expenseSummary(array $filters, ?int $outletId): array
    {
        if (! Schema::hasTable('expenses')) {
            return [
                'expense_total' => 0,
                'expense_paid_total' => 0,
                'expense_unpaid_total' => 0,
                'expense_paid_cumulative_total' => 0,
            ];
        }

        $row = Expense::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->when($filters['start_date'] ?? null, fn ($query, $date) => $query->whereDate('expense_date', '>=', $date))
            ->when($filters['end_date'] ?? null, fn ($query, $date) => $query->whereDate('expense_date', '<=', $date))
            ->selectRaw('COALESCE(SUM(amount), 0) as expense_total')
            ->selectRaw("COALESCE(SUM(CASE WHEN status = '".Expense::STATUS_PAID."' THEN amount ELSE 0 END), 0) as expense_paid_total")
            ->selectRaw("COALESCE(SUM(CASE WHEN status = '".Expense::STATUS_UNPAID."' THEN amount ELSE 0 END), 0) as expense_unpaid_total")
            ->first();

        return [
            'expense_total' => (int) ($row?->expense_total ?? 0),
            'expense_paid_total' => (int) ($row?->expense_paid_total ?? 0),
            'expense_unpaid_total' => (int) ($row?->expense_unpaid_total ?? 0),
            'expense_paid_cumulative_total' => (int) Expense::query()
                ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
                ->when($filters['end_date'] ?? null, fn ($query, $date) => $query->whereDate('expense_date', '<=', $date))
                ->where('status', Expense::STATUS_PAID)
                ->sum('amount'),
        ];
    }

    public static function tenantPayoutSummary(
        array $filters,
        ?int $outletId,
        EloquentBuilder|QueryBuilder $balanceTransactionQuery,
        ?Collection $tenantOutletIds = null
    ): array
    {
        if (! Schema::hasTable('cashier_settlement_requests')) {
            return [
                'balance_total' => 0,
                'approved_total' => 0,
                'approved_period_total' => 0,
                'approved_cumulative_total' => 0,
                'approved_pending_payment_total' => 0,
                'paid_total' => 0,
                'paid_period_total' => 0,
                'paid_cumulative_total' => 0,
                'pending_approval_total' => 0,
                'outstanding_total' => 0,
            ];
        }

        $balanceTotal = 0;

        if (Schema::hasTable('transaction_tenant_allocations')) {
            $costSubquery = TransactionTenantAllocationItem::query()
                ->selectRaw('transaction_tenant_allocation_id')
                ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0) as cost_total')
                ->groupBy('transaction_tenant_allocation_id');

            $profitExpression = 'COALESCE(transaction_tenant_allocations.grand_total, 0) - COALESCE(allocation_costs.cost_total, 0)';
            $payoutExpression = "CASE
                WHEN {$profitExpression} > 0
                    THEN {$profitExpression} - ROUND({$profitExpression} * (COALESCE(tenant_outlets.commission_rate_percent, 0) / 100), 0)
                ELSE 0
            END";

            $balanceRow = TransactionTenantAllocation::query()
                ->leftJoinSub($costSubquery, 'allocation_costs', function ($join) {
                    $join->on('allocation_costs.transaction_tenant_allocation_id', '=', 'transaction_tenant_allocations.id');
                })
                ->leftJoin('outlets as tenant_outlets', 'tenant_outlets.id', '=', 'transaction_tenant_allocations.tenant_outlet_id')
                ->whereIn('transaction_tenant_allocations.transaction_id', clone $balanceTransactionQuery)
                ->when($outletId, fn ($query) => $query->where('transaction_tenant_allocations.outlet_id', $outletId))
                ->selectRaw("COALESCE(SUM({$payoutExpression}), 0) as balance_total")
                ->first();

            $rawBalanceTotal = (int) round($balanceRow?->balance_total ?? 0);
        } else {
            $rawBalanceTotal = 0;
        }

        $returnTotal = 0;
        if (Schema::hasTable('sales_returns') && $tenantOutletIds instanceof Collection && $tenantOutletIds->isNotEmpty()) {
            $returnQuery = \App\Models\SalesReturn::query()
                ->where('status', 'completed')
                ->whereHas('items.transactionDetail', fn ($b) => $b->whereIn('tenant_outlet_id', $tenantOutletIds->all()));

            if ($filters['end_date'] ?? null) {
                $returnQuery->whereDate('completed_at', '<=', $filters['end_date']);
            }

            $returns = $returnQuery->with(['items.transactionDetail'])->get();
            foreach ($returns as $sr) {
                $items = $sr->items->filter(fn ($item) => $tenantOutletIds->contains((int) ($item->transactionDetail?->tenant_outlet_id ?? 0)));
                foreach ($items as $item) {
                    $detail = $item->transactionDetail;
                    $qty = (int) ($item->qty_return ?? 0);
                    $customerUnitPrice = (int) ($detail?->customer_base_unit_price ?? $detail?->unit_price ?? 0);
                    $returnTotal += $customerUnitPrice * $qty;
                }
            }
        }

        $balanceTotal = max(0, $rawBalanceTotal - $returnTotal);

        $baseQuery = CashierSettlementRequest::query()
            ->whereNull('cashier_shift_id');

        if ($tenantOutletIds instanceof Collection && $tenantOutletIds->isNotEmpty()) {
            $baseQuery->whereIn('outlet_id', $tenantOutletIds->all());
        } elseif ($outletId) {
            $baseQuery->where('outlet_id', $outletId);
        }

        $settlementFilters = [
            'start_date' => $filters['start_date'] ?? null,
            'end_date' => $filters['end_date'] ?? null,
        ];
        $cumulativeSettlementFilters = [
            'start_date' => null,
            'end_date' => $filters['end_date'] ?? null,
        ];
        $approvedQuery = (clone $baseQuery)
            ->where('status', CashierSettlementRequest::STATUS_APPROVED);
        $approvedPeriodQuery = ReportTimezone::applySourceDateRange(
            (clone $approvedQuery),
            'approved_at',
            $settlementFilters
        );
        $approvedCumulativeQuery = ReportTimezone::applySourceDateRange(
            (clone $approvedQuery),
            'approved_at',
            $cumulativeSettlementFilters
        );

        $paidPeriodQuery = ReportTimezone::applySourceDateRange(
            (clone $approvedQuery),
            'paid_at',
            $settlementFilters
        );
        $paidCumulativeQuery = ReportTimezone::applySourceDateRange(
            (clone $approvedQuery),
            'paid_at',
            $cumulativeSettlementFilters
        );

        $approvedPeriodTotal = (int) round($approvedPeriodQuery->sum('approved_amount'));
        $approvedCumulativeTotal = (int) round($approvedCumulativeQuery->sum('approved_amount'));
        $paidPeriodTotal = (int) round($paidPeriodQuery->sum('approved_amount'));
        $paidCumulativeTotal = (int) round($paidCumulativeQuery->sum('approved_amount'));
        $paidTotal = $paidCumulativeTotal;
        $pendingApprovalTotal = (int) round(
            ReportTimezone::applySourceDateRange(
                (clone $baseQuery)->where('status', CashierSettlementRequest::STATUS_PENDING),
                'created_at',
                $settlementFilters
            )->sum('requested_amount')
        );
        $approvedPendingPaymentTotal = max(0, $approvedCumulativeTotal - $paidCumulativeTotal);

        return [
            'raw_balance_total' => $rawBalanceTotal,
            'return_total' => $returnTotal,
            'balance_total' => $balanceTotal,
            'approved_total' => $approvedCumulativeTotal,
            'approved_period_total' => $approvedPeriodTotal,
            'approved_cumulative_total' => $approvedCumulativeTotal,
            'approved_pending_payment_total' => $approvedPendingPaymentTotal,
            'paid_total' => $paidTotal,
            'paid_period_total' => $paidPeriodTotal,
            'paid_cumulative_total' => $paidCumulativeTotal,
            'pending_approval_total' => $pendingApprovalTotal,
            'outstanding_total' => max(0, $balanceTotal - $approvedCumulativeTotal),
        ];
    }

    public static function tenantSettlementSeries(
        array $filters,
        ?int $outletId,
        Collection $tenantOutletIds
    ): array {
        if (! Schema::hasTable('cashier_settlement_requests')) {
            return [
                'approved_by_date' => collect(),
                'paid_by_date' => collect(),
                'pending_by_date' => collect(),
            ];
        }

        $baseQuery = CashierSettlementRequest::query()
            ->whereNull('cashier_shift_id');

        if ($tenantOutletIds->isNotEmpty()) {
            $baseQuery->whereIn('outlet_id', $tenantOutletIds->all());
        } elseif ($outletId) {
            $baseQuery->where('outlet_id', $outletId);
        }

        $startDate = $filters['start_date'] ?? null;
        $endDate = $filters['end_date'] ?? null;

        $approvedByDate = ReportTimezone::applySourceDateRange(
            (clone $baseQuery)
                ->where('status', CashierSettlementRequest::STATUS_APPROVED)
                ->whereNotNull('approved_at'),
            'approved_at',
            ['start_date' => $startDate, 'end_date' => $endDate]
        )
            ->get(['approved_at', 'approved_amount'])
            ->groupBy(fn ($row) => ReportTimezone::sourceDateKey($row->getRawOriginal('approved_at')))
            ->map(fn (Collection $items) => (int) $items->sum('approved_amount'));

        $paidByDate = ReportTimezone::applySourceDateRange(
            (clone $baseQuery)
                ->where('status', CashierSettlementRequest::STATUS_APPROVED)
                ->whereNotNull('paid_at'),
            'paid_at',
            ['start_date' => $startDate, 'end_date' => $endDate]
        )
            ->get(['paid_at', 'approved_amount'])
            ->groupBy(fn ($row) => ReportTimezone::sourceDateKey($row->getRawOriginal('paid_at')))
            ->map(fn (Collection $items) => (int) $items->sum('approved_amount'));

        $pendingByDate = ReportTimezone::applySourceDateRange(
            (clone $baseQuery)
                ->where('status', CashierSettlementRequest::STATUS_PENDING),
            'created_at',
            ['start_date' => $startDate, 'end_date' => $endDate]
        )
            ->get(['created_at', 'requested_amount'])
            ->groupBy(fn ($row) => ReportTimezone::sourceDateKey($row->getRawOriginal('created_at')))
            ->map(fn (Collection $items) => (int) $items->sum('requested_amount'));

        return [
            'approved_by_date' => $approvedByDate,
            'paid_by_date' => $paidByDate,
            'pending_by_date' => $pendingByDate,
        ];
    }
}
