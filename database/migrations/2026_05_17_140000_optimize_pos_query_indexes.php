<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addIndexIfMissing('carts', ['cashier_id', 'outlet_id', 'hold_id'], 'carts_cashier_outlet_hold_idx');
        $this->addIndexIfMissing('carts', ['cashier_id', 'outlet_id', 'hold_id', 'product_id'], 'carts_cashier_outlet_hold_product_idx');

        $this->addIndexIfMissing('cashier_shifts', ['user_id', 'outlet_id', 'status', 'opened_at'], 'cashier_shifts_user_outlet_status_opened_idx');

        $this->addIndexIfMissing('transactions', ['customer_id', 'outlet_id', 'created_at'], 'transactions_customer_outlet_created_idx');
        $this->addIndexIfMissing('transactions', ['cashier_id', 'outlet_id', 'created_at'], 'transactions_cashier_outlet_created_idx');
        $this->addIndexIfMissing('transactions', ['invoice'], 'transactions_invoice_index');

        $this->addIndexIfMissing('kitchen_tickets', ['kitchen_station_id', 'created_at', 'id'], 'kitchen_tickets_station_created_id_idx');

        $this->addIndexIfMissing(
            'kitchen_station_devices',
            ['kitchen_station_id', 'device_type', 'is_active', 'is_primary'],
            'kitchen_station_devices_dispatch_idx'
        );
    }

    public function down(): void
    {
        Schema::table('kitchen_station_devices', function (Blueprint $table) {
            $table->dropIndex('kitchen_station_devices_dispatch_idx');
        });

        Schema::table('kitchen_tickets', function (Blueprint $table) {
            $table->dropIndex('kitchen_tickets_station_created_id_idx');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex('transactions_customer_outlet_created_idx');
            $table->dropIndex('transactions_cashier_outlet_created_idx');
            $table->dropIndex('transactions_invoice_index');
        });

        Schema::table('cashier_shifts', function (Blueprint $table) {
            $table->dropIndex('cashier_shifts_user_outlet_status_opened_idx');
        });

        Schema::table('carts', function (Blueprint $table) {
            $table->dropIndex('carts_cashier_outlet_hold_idx');
            $table->dropIndex('carts_cashier_outlet_hold_product_idx');
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
