<?php

namespace App\Support;

use App\Models\CashierSettlementRequest;
use App\Models\Expense;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;
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

    public static function tenantPayoutSummary(array $filters, ?int $outletId, EloquentBuilder|QueryBuilder $balanceTransactionQuery): array
    {
        if (! Schema::hasTable('cashier_settlement_requests')) {
            return [
                'balance_total' => 0,
                'approved_total' => 0,
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

            $balanceTotal = (int) round($balanceRow?->balance_total ?? 0);
        }

        $baseQuery = CashierSettlementRequest::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->whereNull('cashier_shift_id');

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

        $approvedTotal = (int) round($paidCumulativeQuery->sum('approved_amount'));
        $paidPeriodTotal = (int) round($paidPeriodQuery->sum('approved_amount'));
        $paidCumulativeTotal = $approvedTotal;
        $paidTotal = $approvedTotal;
        $pendingApprovalTotal = (int) round(
            ReportTimezone::applySourceDateRange(
                (clone $baseQuery)->where('status', CashierSettlementRequest::STATUS_PENDING),
                'created_at',
                $settlementFilters
            )->sum('requested_amount')
        );

        return [
            'balance_total' => $balanceTotal,
            'approved_total' => $approvedTotal,
            'paid_total' => $paidTotal,
            'paid_period_total' => $paidPeriodTotal,
            'paid_cumulative_total' => $paidCumulativeTotal,
            'pending_approval_total' => $pendingApprovalTotal,
            'outstanding_total' => max(0, $balanceTotal - $paidTotal),
        ];
    }
}
