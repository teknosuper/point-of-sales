<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

class ReportModifierTotals
{
    public static function subquery(
        string $sumColumn = 'total_price',
        string $groupColumn = 'transaction_detail_id',
        string $selectAlias = 'modifier_total'
    ) {
        return DB::table('transaction_detail_modifiers')
            ->selectRaw("{$groupColumn}, COALESCE(SUM({$sumColumn}), 0) as {$selectAlias}")
            ->groupBy($groupColumn);
    }

    public static function revenueExpression(
        string $detailTable = 'transaction_details',
        string $joinedAlias = 'detail_modifier_totals',
        string $joinedColumn = 'modifier_total'
    ): string {
        return "COALESCE({$detailTable}.price, 0) + COALESCE({$joinedAlias}.{$joinedColumn}, 0)";
    }
}
