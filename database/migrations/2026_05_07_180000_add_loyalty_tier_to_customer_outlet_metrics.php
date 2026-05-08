<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_outlet_metrics', function (Blueprint $table) {
            $table->string('loyalty_tier', 30)->default('regular')->after('loyalty_points_redeemed');
            $table->index(['outlet_id', 'loyalty_tier']);
        });

        DB::table('customer_outlet_metrics')
            ->join('customers', 'customers.id', '=', 'customer_outlet_metrics.customer_id')
            ->update([
                'customer_outlet_metrics.loyalty_tier' => DB::raw('customers.loyalty_tier'),
            ]);
    }

    public function down(): void
    {
        Schema::table('customer_outlet_metrics', function (Blueprint $table) {
            $table->dropIndex('customer_outlet_metrics_outlet_id_loyalty_tier_index');
            $table->dropColumn('loyalty_tier');
        });
    }
};
