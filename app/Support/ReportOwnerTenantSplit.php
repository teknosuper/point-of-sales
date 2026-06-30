<?php

namespace App\Support;

use App\Models\TransactionDetail;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class ReportOwnerTenantSplit
{
    public static function modifierSelectColumns(): array
    {
        $columns = [
            'id',
            'transaction_detail_id',
            'total_price',
        ];

        foreach (['qty', 'base_price', 'markup_price'] as $column) {
            if (Schema::hasColumn('transaction_detail_modifiers', $column)) {
                $columns[] = $column;
            }
        }

        return $columns;
    }

    public static function ownerProductMarkupTotal(TransactionDetail $detail): int
    {
        return max(0, (int) ($detail->owner_markup_unit_price ?? 0)) * max(0, (int) $detail->qty);
    }

    public static function ownerToppingMarkupTotal(TransactionDetail $detail): int
    {
        if (! $detail->relationLoaded('modifiers')) {
            return 0;
        }

        if (! Schema::hasColumn('transaction_detail_modifiers', 'markup_price')) {
            return 0;
        }

        return (int) $detail->modifiers->sum(
            fn ($modifier) => max(0, (int) ($modifier->markup_price ?? 0)) * max(1, (int) ($modifier->qty ?? 0))
        );
    }

    public static function detailOwnerSplit(TransactionDetail $detail): array
    {
        $productMarkupTotal = self::ownerProductMarkupTotal($detail);
        $toppingMarkupTotal = self::ownerToppingMarkupTotal($detail);

        return [
            'owner_product_markup_total' => $productMarkupTotal,
            'owner_topping_markup_total' => $toppingMarkupTotal,
            'owner_net_total' => (int) ($detail->owner_net_total ?? 0),
        ];
    }

    public static function summarizeDetails(Collection $details): array
    {
        return $details->reduce(function (array $carry, TransactionDetail $detail) {
            $split = self::detailOwnerSplit($detail);
            $carry['owner_product_markup_total'] += (int) $split['owner_product_markup_total'];
            $carry['owner_topping_markup_total'] += (int) $split['owner_topping_markup_total'];
            $carry['owner_net_total'] += (int) $split['owner_net_total'];

            return $carry;
        }, [
            'owner_product_markup_total' => 0,
            'owner_topping_markup_total' => 0,
            'owner_net_total' => 0,
        ]);
    }

    public static function aggregateForTransactionIds(EloquentBuilder|QueryBuilder $transactionIdQuery): array
    {
        $ownerProductMarkupTotal = 0;
        $ownerToppingMarkupTotal = 0;

        if (Schema::hasColumn('transaction_details', 'owner_markup_unit_price')) {
            $ownerProductMarkupTotal = (int) TransactionDetail::query()
                ->whereIn('transaction_id', clone $transactionIdQuery)
                ->selectRaw('COALESCE(SUM(COALESCE(owner_markup_unit_price, 0) * COALESCE(qty, 0)), 0) as total')
                ->value('total');
        }

        if (
            Schema::hasColumn('transaction_detail_modifiers', 'markup_price')
            && Schema::hasColumn('transaction_detail_modifiers', 'qty')
        ) {
            $ownerToppingMarkupTotal = (int) DB::table('transaction_detail_modifiers')
                ->join('transaction_details', 'transaction_details.id', '=', 'transaction_detail_modifiers.transaction_detail_id')
                ->whereIn('transaction_details.transaction_id', clone $transactionIdQuery)
                ->selectRaw('COALESCE(SUM(COALESCE(transaction_detail_modifiers.markup_price, 0) * COALESCE(transaction_detail_modifiers.qty, 0)), 0) as total')
                ->value('total');
        }

        return [
            'owner_product_markup_total' => $ownerProductMarkupTotal,
            'owner_topping_markup_total' => $ownerToppingMarkupTotal,
            'owner_net_total' => $ownerProductMarkupTotal + $ownerToppingMarkupTotal,
        ];
    }

    public static function toppingBreakdownForTransactionIds(
        EloquentBuilder|QueryBuilder $transactionIdQuery,
        mixed $tenantOutletId = null,
        int $limit = 10
    ): array {
        if (
            ! Schema::hasColumn('transaction_detail_modifiers', 'markup_price')
            || ! Schema::hasColumn('transaction_detail_modifiers', 'qty')
        ) {
            return [];
        }

        $rows = DB::table('transaction_detail_modifiers')
            ->join('transaction_details', 'transaction_details.id', '=', 'transaction_detail_modifiers.transaction_detail_id')
            ->whereIn('transaction_details.transaction_id', clone $transactionIdQuery)
            ->when(
                $tenantOutletId && Schema::hasColumn('transaction_details', 'tenant_outlet_id'),
                fn ($query) => $query->where('transaction_details.tenant_outlet_id', $tenantOutletId)
            )
            ->selectRaw('transaction_detail_modifiers.name')
            ->selectRaw('COALESCE(SUM(COALESCE(transaction_detail_modifiers.qty, 0)), 0) as total_qty')
            ->selectRaw('COALESCE(SUM(COALESCE(transaction_detail_modifiers.total_price, 0)), 0) as topping_total')
            ->selectRaw('COALESCE(SUM(COALESCE(transaction_detail_modifiers.markup_price, 0) * COALESCE(transaction_detail_modifiers.qty, 0)), 0) as owner_markup_total')
            ->groupBy('transaction_detail_modifiers.name')
            ->orderByDesc('owner_markup_total')
            ->limit($limit)
            ->get();

        $totalOwnerMarkup = (int) collect($rows)->sum(fn ($row) => (int) ($row->owner_markup_total ?? 0));

        return collect($rows)->map(fn ($row) => [
            'name' => $row->name ?: 'Topping',
            'total_qty' => (int) ($row->total_qty ?? 0),
            'topping_total' => (int) ($row->topping_total ?? 0),
            'owner_markup_total' => (int) ($row->owner_markup_total ?? 0),
            'owner_markup_share_percent' => $totalOwnerMarkup > 0
                ? round((((int) ($row->owner_markup_total ?? 0)) / $totalOwnerMarkup) * 100, 2)
                : 0,
        ])->values()->all();
    }
}
