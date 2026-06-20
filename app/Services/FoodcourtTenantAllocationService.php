<?php

namespace App\Services;

use App\Models\SalesReturnItem;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class FoodcourtTenantAllocationService
{
    public function rebuildForTransaction(Transaction $transaction): Collection
    {
        return $this->syncAllocationsForTransaction($transaction);
    }

    public function reconcileCompletedReturns(Transaction $transaction): Collection
    {
        $returnedQtyMap = SalesReturnItem::query()
            ->selectRaw('transaction_detail_id, COALESCE(SUM(qty_return), 0) as qty_returned')
            ->whereHas('salesReturn', fn ($query) => $query
                ->where('transaction_id', $transaction->id)
                ->where('status', 'completed'))
            ->groupBy('transaction_detail_id')
            ->pluck('qty_returned', 'transaction_detail_id')
            ->map(fn ($qty) => (int) $qty);

        return $this->syncAllocationsForTransaction($transaction, $returnedQtyMap);
    }

    private function syncAllocationsForTransaction(Transaction $transaction, ?Collection $returnedQtyMap = null): Collection
    {
        $transaction->loadMissing('details');
        $returnedQtyMap ??= collect();

        $details = $transaction->details
            ->map(function (TransactionDetail $detail) use ($returnedQtyMap) {
                $returnedQty = min(
                    (int) $detail->qty,
                    max(0, (int) ($returnedQtyMap->get($detail->id, 0) ?? 0))
                );
                $remainingQty = max(0, (int) $detail->qty - $returnedQty);

                return [
                    'detail' => $detail,
                    'tenant_outlet_id' => (int) ($detail->tenant_outlet_id ?? $detail->outlet_id ?? 0),
                    'remaining_qty' => $remainingQty,
                    'tenant_line_total' => $this->proratedValue($this->tenantLineTotal($detail), (int) $detail->qty, $remainingQty),
                    'tenant_discount_total' => $this->proratedValue($this->tenantDiscountTotal($detail), (int) $detail->qty, $remainingQty),
                    'tenant_base_unit_price' => $this->tenantBaseUnitPrice($detail),
                ];
            })
            ->filter(fn (array $row) => $row['tenant_outlet_id'] > 0 && $row['remaining_qty'] > 0)
            ->values();

        if ($details->isEmpty()) {
            TransactionTenantAllocation::query()
                ->where('transaction_id', $transaction->id)
                ->delete();

            return collect();
        }

        $allocations = collect();
        $groupedDetails = $details->groupBy(fn (array $row) => $row['tenant_outlet_id']);
        $tenantOutletIds = $groupedDetails->keys()->map(fn ($id) => (int) $id)->values()->all();
        $subtotals = $groupedDetails->map(
            fn (Collection $tenantDetails) => (int) $tenantDetails->sum('tenant_line_total')
        );
        $voucherShares = $this->allocateAcrossTenants($subtotals, (int) ($transaction->customer_voucher_discount ?? 0));
        $afterVoucher = $subtotals->map(fn (int $subtotal, int|string $tenantOutletId) => max(0, $subtotal - (int) $voucherShares->get($tenantOutletId, 0)));
        $loyaltyShares = $this->allocateAcrossTenants($afterVoucher, (int) ($transaction->loyalty_discount_total ?? 0));
        $afterLoyalty = $afterVoucher->map(fn (int $subtotal, int|string $tenantOutletId) => max(0, $subtotal - (int) $loyaltyShares->get($tenantOutletId, 0)));
        $manualShares = $this->allocateAcrossTenants($afterLoyalty, (int) ($transaction->discount ?? 0));
        $afterManual = $afterLoyalty->map(fn (int $subtotal, int|string $tenantOutletId) => max(0, $subtotal - (int) $manualShares->get($tenantOutletId, 0)));
        $shippingShares = $this->allocateAcrossTenants($afterManual, (int) ($transaction->shipping_cost ?? 0));

        TransactionTenantAllocation::query()
            ->where('transaction_id', $transaction->id)
            ->whereNotIn('tenant_outlet_id', $tenantOutletIds)
            ->delete();

        foreach ($groupedDetails as $tenantOutletId => $tenantDetails) {
            $tenantDetails = $tenantDetails->values();
            $tenantOutletId = (int) $tenantOutletId;
            $subtotal = (int) $subtotals->get($tenantOutletId, 0);
            $promoDiscountTotal = (int) $tenantDetails->sum('tenant_discount_total');
            $voucherDiscountTotal = (int) $voucherShares->get($tenantOutletId, 0);
            $loyaltyDiscountTotal = (int) $loyaltyShares->get($tenantOutletId, 0);
            $manualDiscountTotal = (int) $manualShares->get($tenantOutletId, 0);
            $shippingShare = (int) $shippingShares->get($tenantOutletId, 0);
            $grandTotal = max(
                0,
                $subtotal
                - $voucherDiscountTotal
                - $loyaltyDiscountTotal
                - $manualDiscountTotal
                + $shippingShare
            );

            $allocation = TransactionTenantAllocation::query()->firstOrNew([
                'transaction_id' => $transaction->id,
                'tenant_outlet_id' => $tenantOutletId,
            ]);

            $allocation->fill([
                'outlet_id' => $transaction->outlet_id,
                'cashier_id' => $transaction->cashier_id,
                'cashier_shift_id' => $transaction->cashier_shift_id,
                'allocation_number' => $allocation->allocation_number ?: $this->allocationNumber($transaction, $tenantOutletId),
                'subtotal' => $subtotal,
                'promo_discount_total' => $promoDiscountTotal,
                'manual_discount_total' => $manualDiscountTotal,
                'loyalty_discount_total' => $loyaltyDiscountTotal,
                'voucher_discount_total' => $voucherDiscountTotal,
                'grand_total' => $grandTotal,
                'payment_status' => (string) ($transaction->payment_status ?: 'paid'),
                'kitchen_status' => $tenantDetails->contains(fn (array $row) => (bool) ($row['detail']?->kitchen_station_id ?? null)) ? 'pending' : 'not_required',
                'waiter_status' => $tenantDetails->contains(fn (array $row) => (bool) ($row['detail']?->kitchen_station_id ?? null)) ? ($allocation->waiter_status ?: 'pending') : 'not_required',
            ]);
            $allocation->save();

            $existingItems = $allocation->items()
                ->get()
                ->keyBy(fn ($item) => (int) ($item->transaction_detail_id ?? 0));

            $allocation->items()->delete();

            foreach ($tenantDetails as $detailRow) {
                /** @var TransactionDetail $detail */
                $detail = $detailRow['detail'];
                $remainingQty = (int) $detailRow['remaining_qty'];
                $existingItem = $existingItems->get((int) $detail->id);
                $defaultServiceStatus = $detail->kitchen_station_id ? 'pending' : 'not_required';

                $allocation->items()->create([
                    'transaction_detail_id' => $detail->id,
                    'tenant_outlet_id' => (int) $tenantOutletId,
                    'product_id' => $detail->product_id,
                    'kitchen_station_id' => $detail->kitchen_station_id,
                    'qty' => $remainingQty,
                    'base_unit_price' => (int) $detailRow['tenant_base_unit_price'],
                    'unit_price' => (int) max(0, round(((int) $detailRow['tenant_line_total']) / max(1, $remainingQty))),
                    'line_total' => (int) $detailRow['tenant_line_total'],
                    'discount_total' => (int) $detailRow['tenant_discount_total'],
                    'service_status' => $existingItem?->service_status ?: $defaultServiceStatus,
                    'ready_at' => $existingItem?->ready_at,
                    'picked_up_at' => $existingItem?->picked_up_at,
                    'delivered_at' => $existingItem?->delivered_at,
                ]);
            }

            $allocations->push($allocation->fresh('items'));
        }

        return $allocations;
    }

    private function proratedValue(int $totalValue, int $originalQty, int $remainingQty): int
    {
        if ($originalQty <= 0 || $remainingQty <= 0 || $totalValue <= 0) {
            return 0;
        }

        if ($remainingQty >= $originalQty) {
            return $totalValue;
        }

        return (int) round(($totalValue / $originalQty) * $remainingQty);
    }

    private function allocateAcrossTenants(Collection $bases, int $amount): Collection
    {
        $amount = max(0, $amount);
        $shares = $bases->map(fn () => 0);

        if ($shares->isEmpty() || $amount === 0) {
            return $shares;
        }

        $normalizedBases = $bases->map(fn ($base) => max(0, (int) $base));
        $baseTotal = (int) $normalizedBases->sum();

        if ($baseTotal <= 0) {
            $firstKey = $normalizedBases->keys()->first();
            $shares->put($firstKey, $amount);

            return $shares;
        }

        $running = 0;
        $lastKey = $normalizedBases->keys()->last();

        foreach ($normalizedBases as $tenantOutletId => $base) {
            $share = (string) $tenantOutletId === (string) $lastKey
                ? $amount - $running
                : (int) floor($amount * ($base / $baseTotal));

            $share = max(0, min($amount - $running, $share));
            $shares->put($tenantOutletId, $share);
            $running += $share;
        }

        return $shares;
    }

    private function allocationNumber(Transaction $transaction, int $tenantOutletId): string
    {
        return 'TA-'.$transaction->id.'-'.$tenantOutletId.'-'.Str::upper(Str::random(4));
    }

    private function tenantLineTotal(TransactionDetail $detail): int
    {
        $tenantNetTotal = (int) ($detail->tenant_net_total ?? 0);

        return $tenantNetTotal > 0
            ? $tenantNetTotal
            : (int) ($detail->price ?? 0);
    }

    private function tenantBaseUnitPrice(TransactionDetail $detail): int
    {
        $tenantBaseUnitPrice = (int) ($detail->tenant_base_unit_price ?? 0);

        return $tenantBaseUnitPrice > 0
            ? $tenantBaseUnitPrice
            : (int) ($detail->base_unit_price ?? 0);
    }

    private function tenantDiscountTotal(TransactionDetail $detail): int
    {
        $tenantDiscountTotal = (int) ($detail->tenant_discount_total ?? 0);

        return $tenantDiscountTotal > 0
            ? $tenantDiscountTotal
            : (int) ($detail->discount_total ?? 0);
    }
}
