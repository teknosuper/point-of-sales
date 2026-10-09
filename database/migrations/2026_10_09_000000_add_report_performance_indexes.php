<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Hampir semua query laporan memfilter outlet_id + rentang created_at,
     * tetapi index yang ada diawali customer_id/cashier_id sehingga tidak
     * terpakai (aturan leftmost-prefix). Index ini menutup celah itu.
     */
    public function up(): void
    {
        $this->addIndexIfMissing(
            'transactions',
            ['outlet_id', 'created_at'],
            'transactions_outlet_created_idx'
        );
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex('transactions_outlet_created_idx');
        });
    }

    private function addIndexIfMissing(string $table, array $columns, string $indexName): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        $exists = DB::table('information_schema.statistics')
            ->where('table_schema', DB::raw('DATABASE()'))
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->exists();

        if ($exists) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns, $indexName) {
            $blueprint->index($columns, $indexName);
        });
    }
};
