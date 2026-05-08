<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('transaction_details', 'tenant_outlet_id')) {
            Schema::table('transaction_details', function (Blueprint $table) {
                $table->foreignId('tenant_outlet_id')
                    ->nullable()
                    ->after('outlet_id')
                    ->constrained('outlets')
                    ->nullOnDelete();
            });
        }

        $transactionDetailIndexExists = DB::table('information_schema.statistics')
            ->where('table_schema', DB::raw('DATABASE()'))
            ->where('table_name', 'transaction_details')
            ->where('index_name', 'transaction_details_transaction_tenant_idx')
            ->exists();

        if (! $transactionDetailIndexExists) {
            Schema::table('transaction_details', function (Blueprint $table) {
                $table->index(['transaction_id', 'tenant_outlet_id'], 'transaction_details_transaction_tenant_idx');
            });
        }

        if (! Schema::hasTable('transaction_tenant_allocations')) {
            Schema::create('transaction_tenant_allocations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('transaction_id');
                $table->unsignedBigInteger('outlet_id')->nullable();
                $table->unsignedBigInteger('tenant_outlet_id');
                $table->unsignedBigInteger('cashier_id')->nullable();
                $table->unsignedBigInteger('cashier_shift_id')->nullable();
                $table->string('allocation_number')->unique();
                $table->unsignedBigInteger('subtotal')->default(0);
                $table->unsignedBigInteger('promo_discount_total')->default(0);
                $table->unsignedBigInteger('manual_discount_total')->default(0);
                $table->unsignedBigInteger('loyalty_discount_total')->default(0);
                $table->unsignedBigInteger('voucher_discount_total')->default(0);
                $table->unsignedBigInteger('grand_total')->default(0);
                $table->string('payment_status', 30)->default('paid');
                $table->string('kitchen_status', 30)->default('pending');
                $table->timestamp('settled_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->foreign('transaction_id', 'tta_transaction_fk')
                    ->references('id')
                    ->on('transactions')
                    ->cascadeOnDelete();
                $table->foreign('outlet_id', 'tta_outlet_fk')
                    ->references('id')
                    ->on('outlets')
                    ->nullOnDelete();
                $table->foreign('tenant_outlet_id', 'tta_tenant_outlet_fk')
                    ->references('id')
                    ->on('outlets')
                    ->cascadeOnDelete();
                $table->foreign('cashier_id', 'tta_cashier_fk')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
                $table->foreign('cashier_shift_id', 'tta_cashier_shift_fk')
                    ->references('id')
                    ->on('cashier_shifts')
                    ->nullOnDelete();
                $table->unique(['transaction_id', 'tenant_outlet_id'], 'transaction_tenant_allocation_unique');
                $table->index(['tenant_outlet_id', 'payment_status'], 'tta_tenant_payment_idx');
                $table->index(['tenant_outlet_id', 'kitchen_status'], 'tta_tenant_kitchen_idx');
            });
        }

        if (! Schema::hasTable('transaction_tenant_allocation_items')) {
            Schema::create('transaction_tenant_allocation_items', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('transaction_tenant_allocation_id');
                $table->unsignedBigInteger('transaction_detail_id')->nullable();
                $table->unsignedBigInteger('tenant_outlet_id');
                $table->unsignedBigInteger('product_id')->nullable();
                $table->unsignedBigInteger('kitchen_station_id')->nullable();
                $table->unsignedInteger('qty')->default(0);
                $table->unsignedBigInteger('base_unit_price')->default(0);
                $table->unsignedBigInteger('unit_price')->default(0);
                $table->unsignedBigInteger('line_total')->default(0);
                $table->unsignedBigInteger('discount_total')->default(0);
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->foreign('transaction_tenant_allocation_id', 'ttai_allocation_fk')
                    ->references('id')
                    ->on('transaction_tenant_allocations')
                    ->cascadeOnDelete();
                $table->foreign('transaction_detail_id', 'ttai_transaction_detail_fk')
                    ->references('id')
                    ->on('transaction_details')
                    ->nullOnDelete();
                $table->foreign('tenant_outlet_id', 'ttai_tenant_outlet_fk')
                    ->references('id')
                    ->on('outlets')
                    ->cascadeOnDelete();
                $table->foreign('product_id', 'ttai_product_fk')
                    ->references('id')
                    ->on('products')
                    ->nullOnDelete();
                $table->foreign('kitchen_station_id', 'ttai_kitchen_station_fk')
                    ->references('id')
                    ->on('kitchen_stations')
                    ->nullOnDelete();
                $table->index(['tenant_outlet_id', 'product_id'], 'tenant_allocation_items_tenant_product_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_tenant_allocation_items');
        Schema::dropIfExists('transaction_tenant_allocations');

        Schema::table('transaction_details', function (Blueprint $table) {
            $table->dropIndex('transaction_details_transaction_tenant_idx');
            $table->dropConstrainedForeignId('tenant_outlet_id');
        });
    }
};
