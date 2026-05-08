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
            $table->foreignId('tenant_outlet_id')
                ->nullable()
                ->after('category_id')
                ->constrained('outlets')
                ->nullOnDelete();
            $table->index('tenant_outlet_id');
        });

        Schema::table('carts', function (Blueprint $table) {
            $table->foreignId('tenant_outlet_id')
                ->nullable()
                ->after('outlet_id')
                ->constrained('outlets')
                ->nullOnDelete();
            $table->index(['cashier_id', 'outlet_id', 'tenant_outlet_id'], 'carts_cashier_outlet_tenant_idx');
        });

        if (Schema::hasTable('outlets') && DB::table('outlets')->exists()) {
            $defaultOutletId = DB::table('outlets')
                ->orderByDesc('is_default')
                ->orderBy('id')
                ->value('id');

            if ($defaultOutletId) {
                DB::table('products')->whereNull('tenant_outlet_id')->update([
                    'tenant_outlet_id' => $defaultOutletId,
                ]);

                DB::table('carts')->whereNull('tenant_outlet_id')->update([
                    'tenant_outlet_id' => $defaultOutletId,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->dropIndex('carts_cashier_outlet_tenant_idx');
            $table->dropConstrainedForeignId('tenant_outlet_id');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['tenant_outlet_id']);
            $table->dropConstrainedForeignId('tenant_outlet_id');
        });
    }
};
