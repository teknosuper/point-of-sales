<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'tenant_hpp_price')) {
                $table->unsignedBigInteger('tenant_hpp_price')
                    ->nullable()
                    ->after('tenant_outlet_id');
            }
        });

        DB::table('products')
            ->whereNull('tenant_hpp_price')
            ->update([
                'tenant_hpp_price' => DB::raw('buy_price'),
            ]);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'tenant_hpp_price')) {
                $table->dropColumn('tenant_hpp_price');
            }
        });
    }
};
