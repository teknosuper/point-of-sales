<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('print_jobs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('outlet_id')->nullable();
            $table->unsignedBigInteger('transaction_id')->nullable();
            $table->unsignedBigInteger('kitchen_ticket_id')->nullable();
            $table->unsignedBigInteger('kitchen_station_device_id')->nullable();
            $table->string('job_type', 40);
            $table->string('status', 30)->default('queued');
            $table->unsignedTinyInteger('copies')->default(1);
            $table->json('payload')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('processing_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->string('failure_reason', 255)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['outlet_id', 'status'], 'print_jobs_outlet_status_idx');
            $table->index(['kitchen_station_device_id', 'status'], 'print_jobs_device_status_idx');
            $table->index(['kitchen_ticket_id', 'status'], 'print_jobs_ticket_status_idx');

            $table->foreign('outlet_id', 'print_jobs_outlet_fk')
                ->references('id')->on('outlets')
                ->nullOnDelete();
            $table->foreign('transaction_id', 'print_jobs_transaction_fk')
                ->references('id')->on('transactions')
                ->nullOnDelete();
            $table->foreign('kitchen_ticket_id', 'print_jobs_kitchen_ticket_fk')
                ->references('id')->on('kitchen_tickets')
                ->nullOnDelete();
            $table->foreign('kitchen_station_device_id', 'print_jobs_device_fk')
                ->references('id')->on('kitchen_station_devices')
                ->nullOnDelete();
            $table->foreign('created_by', 'print_jobs_created_by_fk')
                ->references('id')->on('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('print_jobs');
    }
};
