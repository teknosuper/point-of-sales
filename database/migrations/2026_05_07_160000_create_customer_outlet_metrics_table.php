<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_outlet_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('total_spent')->default(0);
            $table->unsignedInteger('transaction_count')->default(0);
            $table->unsignedBigInteger('loyalty_points_earned')->default(0);
            $table->unsignedBigInteger('loyalty_points_redeemed')->default(0);
            $table->timestamp('last_purchase_at')->nullable();
            $table->timestamps();

            $table->unique(['customer_id', 'outlet_id'], 'customer_outlet_metric_unique');
            $table->index(['outlet_id', 'total_spent']);
            $table->index(['outlet_id', 'transaction_count']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_outlet_metrics');
    }
};
