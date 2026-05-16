<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cashier_settlement_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->nullable()->constrained('outlets')->nullOnDelete();
            $table->foreignId('cashier_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('cashier_shift_id')->nullable()->constrained('cashier_shifts')->nullOnDelete();
            $table->string('request_number')->unique();
            $table->date('business_date')->nullable();
            $table->unsignedBigInteger('gross_sales_total')->default(0);
            $table->unsignedBigInteger('base_sales_total')->default(0);
            $table->unsignedBigInteger('markup_total')->default(0);
            $table->unsignedBigInteger('requested_amount')->default(0);
            $table->foreignId('recipient_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('recipient_name', 120)->nullable();
            $table->text('requested_notes')->nullable();
            $table->string('status', 20)->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->unsignedBigInteger('approved_amount')->default(0);
            $table->unsignedBigInteger('approved_cash_amount')->default(0);
            $table->unsignedBigInteger('approved_transfer_amount')->default(0);
            $table->unsignedBigInteger('approved_other_amount')->default(0);
            $table->string('approved_other_label', 60)->nullable();
            $table->string('approval_reference', 100)->nullable();
            $table->text('approval_notes')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cashier_settlement_requests');
    }
};
