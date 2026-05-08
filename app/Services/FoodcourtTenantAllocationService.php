<?php

namespace App\Services;

use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionTenantAllocation;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class FoodcourtTenantAllocationService
{
    public function rebuildForTransaction(Transaction $transaction): Collection
    {
        $transaction->loadMissing('details');

        $details = $transaction->details
            ->filter(fn (TransactionDetail $detail) => (int) ($detail->tenant_outlet_id ?? $detail->outlet_id ?? 0) > 0)
            ->values();

        if ($details->isEmpty()) {
            TransactionTenantAllocation::query()
                ->where('transaction_id', $transaction->id)
                ->delete();

            return collect();
        }

        $allocations = collect();
        $groupedDetails = $details->groupBy(fn (TransactionDetail $detail) => (int) ($detail->tenant_outlet_id ?? $detail->outlet_id));
        $tenantOutletIds = $groupedDetails->keys()->map(fn ($id) => (int) $id)->values()->all();
        $subtotals = $groupedDetails->map(fn (Collection $tenantDetails) => (int) $tenantDetails->sum('price'));
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
            $promoDiscountTotal = (int) $tenantDetails->sum('discount_total');
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
                'kitchen_status' => $tenantDetails->contains(fn (TransactionDetail $detail) => $detail->kitchen_station_id) ? 'pending' : 'not_required',
            ]);
            $allocation->save();

            $allocation->items()->delete();

            foreach ($tenantDetails as $detail) {
                $allocation->items()->create([
                    'transaction_detail_id' => $detail->id,
                    'tenant_outlet_id' => (int) $tenantOutletId,
                    'product_id' => $detail->product_id,
                    'kitchen_station_id' => $detail->kitchen_station_id,
                    'qty' => (int) $detail->qty,
                    'base_unit_price' => (int) $detail->base_unit_price,
                    'unit_price' => (int) $detail->unit_price,
                    'line_total' => (int) $detail->price,
                    'discount_total' => (int) $detail->discount_total,
                ]);
            }

            $allocations->push($allocation->fresh('items'));
        }

        return $allocations;
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
}
