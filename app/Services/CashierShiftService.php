<?php

namespace App\Services;

use App\Models\CashierShift;
use App\Models\SalesReturn;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CashierShiftService
{
    public function getActiveShiftForUser(int $userId, ?int $outletId = null): ?CashierShift
    {
        return $this->activeShiftQueryForUser($userId, $outletId)
            ->with(['user:id,name', 'openedBy:id,name', 'operators:id,name'])
            ->first();
    }

    public function requireActiveShiftForUser(int $userId, ?int $outletId = null, bool $lockForUpdate = false): CashierShift
    {
        // Avoid locking a range with ORDER BY ... FOR UPDATE; lock a single row by PK instead.
        $baseQuery = $this->activeShiftQueryForUser($userId, $outletId);

        if (! $lockForUpdate) {
            $shift = $baseQuery->first();
        } else {
            $shiftId = (clone $baseQuery)->value('id');
            $shift = $shiftId
                ? CashierShift::query()->whereKey($shiftId)->lockForUpdate()->first()
                : null;
        }

        if (! $shift) {
            throw ValidationException::withMessages([
                'shift' => 'Shift kasir belum dibuka.',
            ]);
        }

        return $shift;
    }

    public function getOpenShiftForOutlet(?int $outletId = null): ?CashierShift
    {
        return CashierShift::query()
            ->with(['user:id,name', 'openedBy:id,name', 'operators:id,name'])
            ->open()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId), fn ($query) => $query->whereNull('outlet_id'))
            ->latest('opened_at')
            ->first();
    }

    public function openShift(User $cashier, User $actor, int $openingCash, ?string $notes = null, ?int $outletId = null): CashierShift
    {
        $existing = $this->getActiveShiftForUser($cashier->id, $outletId);

        if ($existing) {
            throw ValidationException::withMessages([
                'opening_cash' => 'Kasir ini masih memiliki shift aktif.',
            ]);
        }

        if ($this->getOpenShiftForOutlet($outletId)) {
            throw ValidationException::withMessages([
                'opening_cash' => 'Drawer outlet ini sudah memiliki shift aktif. Gunakan gabung shift.',
            ]);
        }

        $shift = CashierShift::create([
            'user_id' => $cashier->id,
            'outlet_id' => $outletId,
            'opened_by' => $actor->id,
            'opened_at' => now(),
            'opening_cash' => $openingCash,
            'expected_cash' => $openingCash,
            'notes' => $notes,
            'status' => CashierShift::STATUS_OPEN,
        ]);

        $shift->operators()->syncWithoutDetaching([
            $cashier->id => [
                'joined_by' => $actor->id,
                'joined_at' => now(),
            ],
        ]);

        return $shift->fresh(['user:id,name', 'openedBy:id,name', 'operators:id,name']);
    }

    public function joinOpenShift(User $cashier, User $actor, ?int $outletId = null): CashierShift
    {
        $existing = $this->getActiveShiftForUser($cashier->id, $outletId);

        if ($existing) {
            return $existing;
        }

        $shift = $this->getOpenShiftForOutlet($outletId);

        if (! $shift) {
            throw ValidationException::withMessages([
                'shift' => 'Belum ada shift drawer aktif untuk outlet ini.',
            ]);
        }

        $shift->operators()->syncWithoutDetaching([
            $cashier->id => [
                'joined_by' => $actor->id,
                'joined_at' => now(),
            ],
        ]);

        return $shift->fresh(['user:id,name', 'openedBy:id,name', 'operators:id,name']);
    }

    public function calculateSummary(CashierShift $shift): array
    {
        $transactions = Transaction::query()
            ->where('cashier_shift_id', $shift->id);

        $salesReturns = SalesReturn::query()
            ->where('cashier_shift_id', $shift->id)
            ->where('status', 'completed');

        $cashSalesTotal = (int) (clone $transactions)
            ->where('payment_method', 'cash')
            ->where('payment_status', 'paid')
            ->sum('grand_total');

        $nonCashSalesTotal = (int) (clone $transactions)
            ->where('payment_method', '!=', 'cash')
            ->sum('grand_total');

        $cashRefundTotal = (int) (clone $salesReturns)
            ->where('return_type', 'refund_cash')
            ->sum('refund_amount');

        $nonCashRefundTotal = (int) (clone $salesReturns)
            ->where('return_type', '!=', 'refund_cash')
            ->sum(DB::raw('COALESCE(credited_amount, 0)'));

        $transactionsCount = (int) (clone $transactions)->count();
        $walkInTransactionsCount = (int) (clone $transactions)->whereNull('customer_id')->count();
        $registeredTransactionsCount = max(0, $transactionsCount - $walkInTransactionsCount);
        $salesReturnsCount = (int) (clone $salesReturns)->count();
        $expectedCash = (int) $shift->opening_cash + $cashSalesTotal - $cashRefundTotal;

        return [
            'cash_sales_total' => $cashSalesTotal,
            'non_cash_sales_total' => $nonCashSalesTotal,
            'cash_refund_total' => $cashRefundTotal,
            'non_cash_refund_total' => $nonCashRefundTotal,
            'transactions_count' => $transactionsCount,
            'walk_in_transactions_count' => $walkInTransactionsCount,
            'registered_transactions_count' => $registeredTransactionsCount,
            'sales_returns_count' => $salesReturnsCount,
            'expected_cash' => $expectedCash,
        ];
    }

    public function calculateBaseSettlementSummary(CashierShift $shift): array
    {
        $paidTransactions = Transaction::query()
            ->where('cashier_shift_id', $shift->id)
            ->where('payment_status', 'paid');

        $completedSalesReturns = SalesReturn::query()
            ->where('cashier_shift_id', $shift->id)
            ->where('status', 'completed');

        $grossSalesTotal = (int) ((clone $paidTransactions)->sum('grand_total') ?? 0);
        $transactionIds = (clone $paidTransactions)->pluck('id');
        $baseSalesTotal = $transactionIds->isNotEmpty()
            ? (int) (TransactionDetail::query()
                ->whereIn('transaction_id', $transactionIds)
                ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0) as total_base_value')
                ->value('total_base_value') ?? 0)
            : 0;
        $pricingDiscountTotal = $transactionIds->isNotEmpty()
            ? (int) (TransactionDetail::query()
                ->whereIn('transaction_id', $transactionIds)
                ->sum('discount_total') ?? 0)
            : 0;
        $cashReturnTotal = (int) ((clone $completedSalesReturns)->sum('refund_amount') ?? 0);
        $creditReturnTotal = (int) ((clone $completedSalesReturns)->sum('credited_amount') ?? 0);
        $totalReturnAmount = $cashReturnTotal + $creditReturnTotal;
        $netGrossSalesTotal = max(0, $grossSalesTotal - $totalReturnAmount);

        return [
            'paid_transactions_count' => (int) $transactionIds->count(),
            'gross_sales_total' => $netGrossSalesTotal,
            'base_sales_total' => max(0, $baseSalesTotal - $totalReturnAmount),
            'pricing_discount_total' => $pricingDiscountTotal,
            'pricing_reference_total' => max(0, $baseSalesTotal - $pricingDiscountTotal - $totalReturnAmount),
            'markup_total' => max(0, $netGrossSalesTotal - max(0, $baseSalesTotal - $totalReturnAmount)),
        ];
    }

    public function closeShift(
        CashierShift $shift,
        User $actor,
        int $actualCash,
        ?string $closeNotes = null,
        bool $forceClose = false
    ): CashierShift {
        if (! $shift->isOpen()) {
            throw ValidationException::withMessages([
                'shift' => 'Shift yang sudah ditutup tidak dapat diubah.',
            ]);
        }

        return DB::transaction(function () use ($shift, $actor, $actualCash, $closeNotes, $forceClose) {
            $lockedShift = CashierShift::query()->lockForUpdate()->findOrFail($shift->id);

            if (! $lockedShift->isOpen()) {
                throw ValidationException::withMessages([
                    'shift' => 'Shift yang sudah ditutup tidak dapat diubah.',
                ]);
            }

            $summary = $this->calculateSummary($lockedShift);
            $cashDifference = $actualCash - $summary['expected_cash'];

            $lockedShift->update([
                ...$summary,
                'actual_cash' => $actualCash,
                'cash_difference' => $cashDifference,
                'closed_at' => now(),
                'closed_by' => $actor->id,
                'close_notes' => $closeNotes,
                'status' => $forceClose
                    ? CashierShift::STATUS_FORCE_CLOSED
                    : CashierShift::STATUS_CLOSED,
            ]);

            return $lockedShift->fresh(['user:id,name', 'openedBy:id,name', 'closedBy:id,name']);
        });
    }

    public function summarizeForDisplay(?CashierShift $shift): ?array
    {
        if (! $shift) {
            return null;
        }

        $summary = $this->calculateSummary($shift);

        return [
            'id' => $shift->id,
            'outlet_id' => $shift->outlet_id,
            'status' => $shift->status,
            'opening_cash' => (int) $shift->opening_cash,
            'opened_at' => optional($shift->opened_at)?->toISOString(),
            'notes' => $shift->notes,
            'user' => $shift->user ? [
                'id' => $shift->user->id,
                'name' => $shift->user->name,
            ] : null,
            'operators' => $shift->operators
                ? $shift->operators
                    ->map(fn (User $operator) => [
                        'id' => $operator->id,
                        'name' => $operator->name,
                    ])
                    ->values()
                    ->all()
                : [],
            ...$summary,
        ];
    }

    public function visibleToUser(Builder $query, User $user): Builder
    {
        if ($user->isSuperAdmin() || $user->can('cashier-shifts-force-close')) {
            return $query;
        }

        return $query->where(function (Builder $builder) use ($user) {
            $builder
                ->where('user_id', $user->id)
                ->orWhereHas('operators', fn (Builder $operatorQuery) => $operatorQuery->where('users.id', $user->id));
        });
    }

    public function userAssignedToShift(CashierShift $shift, int $userId): bool
    {
        if ((int) $shift->user_id === $userId) {
            return true;
        }

        return $shift->operators()->where('users.id', $userId)->exists();
    }

    private function activeShiftQueryForUser(int $userId, ?int $outletId = null): Builder
    {
        return CashierShift::query()
            ->open()
            ->where(function (Builder $query) use ($userId) {
                $query
                    ->where('user_id', $userId)
                    ->orWhereHas('operators', fn (Builder $operatorQuery) => $operatorQuery->where('users.id', $userId));
            })
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId), fn ($query) => $query->whereNull('outlet_id'))
            ->latest('opened_at');
    }
}
