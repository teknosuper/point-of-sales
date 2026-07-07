<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_item_feedbacks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transaction_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transaction_detail_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('rating')->nullable();
            $table->text('feedback_text')->nullable();
            $table->string('delivery_status', 20)->default('received');
            $table->text('customer_alert_message')->nullable();
            $table->timestamp('customer_alert_requested_at')->nullable();
            $table->unsignedInteger('customer_alert_count')->default(0);
            $table->foreignId('kitchen_ticket_event_id')->nullable()->constrained('kitchen_ticket_events')->nullOnDelete();
            $table->timestamps();

            $table->unique('transaction_detail_id');
            $table->index(['transaction_id', 'delivery_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_item_feedbacks');
    }
};
