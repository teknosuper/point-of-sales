<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dining_tables', function (Blueprint $table) {
            $table->string('qr_token', 80)->nullable()->after('code');
            $table->boolean('self_order_enabled')->default(true)->after('status');
            $table->unique('qr_token');
        });

        DB::table('dining_tables')
            ->select('id')
            ->orderBy('id')
            ->get()
            ->each(function ($table) {
                DB::table('dining_tables')
                    ->where('id', $table->id)
                    ->update([
                        'qr_token' => (string) Str::uuid(),
                    ]);
            });

        Schema::create('table_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dining_table_id')->constrained('dining_tables')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('order_number')->unique();
            $table->string('access_token', 80)->unique();
            $table->string('source_channel', 30)->default('table_qr');
            $table->string('customer_name')->nullable();
            $table->string('customer_phone', 50)->nullable();
            $table->string('customer_email')->nullable();
            $table->text('notes')->nullable();
            $table->string('payment_method', 30)->default('cash');
            $table->string('status', 40)->default('pending_cashier_payment');
            $table->unsignedBigInteger('subtotal')->default(0);
            $table->unsignedBigInteger('grand_total')->default(0);
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->timestamps();

            $table->index(['outlet_id', 'status', 'created_at']);
            $table->index(['dining_table_id', 'status']);
        });

        Schema::create('table_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('table_order_id')->constrained('table_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('tenant_outlet_id')->nullable()->constrained('outlets')->nullOnDelete();
            $table->string('product_title');
            $table->unsignedInteger('qty');
            $table->unsignedBigInteger('unit_price')->default(0);
            $table->unsignedBigInteger('line_total')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('table_order_items');
        Schema::dropIfExists('table_orders');

        Schema::table('dining_tables', function (Blueprint $table) {
            $table->dropUnique(['qr_token']);
            $table->dropColumn(['qr_token', 'self_order_enabled']);
        });
    }
};
