<?php

namespace App\Support;

use App\Models\TransactionTenantAllocationItem;
use Illuminate\Support\Collection;

class TenantWalletMetrics
{
    public static function sumTenantNetValueForAllocationIds(Collection $allocationIds): int
    {
        if ($allocationIds->isEmpty()) {
            return 0;
        }

        return (int) (self::tenantNetTotalsByAllocationIds($allocationIds)->sum() ?? 0);
    }

    public static function sumOwnerMarkupValueForAllocationIds(Collection $allocationIds): int
    {
        if ($allocationIds->isEmpty()) {
            return 0;
        }

        return (int) (self::ownerMarkupTotalsByAllocationIds($allocationIds)->sum() ?? 0);
    }

    public static function tenantNetTotalsByAllocationIds(Collection $allocationIds): Collection
    {
        if ($allocationIds->isEmpty()) {
            return collect();
        }

        $productBase = TransactionTenantAllocationItem::query()
            ->join('transaction_details', 'transaction_details.id', '=', 'transaction_tenant_allocation_items.transaction_detail_id')
            ->whereIn('transaction_tenant_allocation_id', $allocationIds->all())
            ->selectRaw('
                transaction_tenant_allocation_id,
                COALESCE(SUM(
                    -- Hak tenant per item tidak boleh melebihi harga bayar pelanggan.
                    -- LEAST() melindungi dari kasus tenant_base_unit_price > customer_base_unit_price
                    -- yang terjadi jika HPP produk di-set lebih tinggi dari harga jual ke pelanggan.
                    -- Jika customer_base_unit_price = 0 (data belum terisi), gunakan nilai tenant langsung
                    -- agar tidak menghasilkan 0 akibat LEAST(x, 0).
                    CASE WHEN COALESCE(transaction_details.customer_base_unit_price, transaction_details.unit_price, 0) > 0
                        THEN LEAST(
                            CASE WHEN transaction_details.tenant_base_unit_price > 0
                                THEN transaction_details.tenant_base_unit_price * transaction_tenant_allocation_items.qty
                                ELSE COALESCE(transaction_tenant_allocation_items.base_unit_price, 0) * transaction_tenant_allocation_items.qty
                            END,
                            COALESCE(transaction_details.customer_base_unit_price, transaction_details.unit_price, 0) * transaction_tenant_allocation_items.qty
                        )
                        ELSE CASE WHEN transaction_details.tenant_base_unit_price > 0
                            THEN transaction_details.tenant_base_unit_price * transaction_tenant_allocation_items.qty
                            ELSE COALESCE(transaction_tenant_allocation_items.base_unit_price, 0) * transaction_tenant_allocation_items.qty
                        END
                    END
                ), 0) as total_tenant_base
            ')
            ->groupBy('transaction_tenant_allocation_id')
            ->pluck('total_tenant_base', 'transaction_tenant_allocation_id')
            ->map(fn ($value) => (int) $value);

        $modifierBase = TransactionTenantAllocationItem::query()
            ->join('transaction_details', 'transaction_details.id', '=', 'transaction_tenant_allocation_items.transaction_detail_id')
            ->join('transaction_detail_modifiers', 'transaction_detail_modifiers.transaction_detail_id', '=', 'transaction_details.id')
            ->whereIn('transaction_tenant_allocation_id', $allocationIds->all())
            ->where('transaction_detail_modifiers.base_price', '>', 0)
            ->selectRaw('
                transaction_tenant_allocation_id,
                COALESCE(SUM(transaction_detail_modifiers.base_price * transaction_detail_modifiers.qty), 0) as total_modifier_base
            ')
            ->groupBy('transaction_tenant_allocation_id')
            ->pluck('total_modifier_base', 'transaction_tenant_allocation_id')
            ->map(fn ($value) => (int) $value);

        return $allocationIds->mapWithKeys(fn ($id) => [
            $id => (int) ($productBase->get($id, 0) ?? 0) + (int) ($modifierBase->get($id, 0) ?? 0),
        ]);
    }

    public static function ownerMarkupTotalsByAllocationIds(Collection $allocationIds): Collection
    {
        if ($allocationIds->isEmpty()) {
            return collect();
        }

        $productMarkup = TransactionTenantAllocationItem::query()
            ->join('transaction_details', 'transaction_details.id', '=', 'transaction_tenant_allocation_items.transaction_detail_id')
            ->whereIn('transaction_tenant_allocation_id', $allocationIds->all())
            ->selectRaw('
                transaction_tenant_allocation_id,
                COALESCE(SUM(
                    CASE WHEN transaction_details.owner_markup_unit_price > 0
                        THEN transaction_details.owner_markup_unit_price * transaction_tenant_allocation_items.qty
                        ELSE GREATEST(
                            COALESCE(transaction_tenant_allocation_items.line_total, 0)
                            - (COALESCE(transaction_tenant_allocation_items.base_unit_price, 0) * transaction_tenant_allocation_items.qty),
                            0
                        )
                    END
                ), 0) as total_owner_markup
            ')
            ->groupBy('transaction_tenant_allocation_id')
            ->pluck('total_owner_markup', 'transaction_tenant_allocation_id')
            ->map(fn ($value) => (int) $value);

        $modifierMarkup = TransactionTenantAllocationItem::query()
            ->join('transaction_details', 'transaction_details.id', '=', 'transaction_tenant_allocation_items.transaction_detail_id')
            ->join('transaction_detail_modifiers', 'transaction_detail_modifiers.transaction_detail_id', '=', 'transaction_details.id')
            ->whereIn('transaction_tenant_allocation_id', $allocationIds->all())
            ->where('transaction_detail_modifiers.markup_price', '>', 0)
            ->selectRaw('
                transaction_tenant_allocation_id,
                COALESCE(SUM(transaction_detail_modifiers.markup_price * transaction_detail_modifiers.qty), 0) as total_modifier_markup
            ')
            ->groupBy('transaction_tenant_allocation_id')
            ->pluck('total_modifier_markup', 'transaction_tenant_allocation_id')
            ->map(fn ($value) => (int) $value);

        return $allocationIds->mapWithKeys(fn ($id) => [
            $id => (int) ($productMarkup->get($id, 0) ?? 0) + (int) ($modifierMarkup->get($id, 0) ?? 0),
        ]);
    }
}
