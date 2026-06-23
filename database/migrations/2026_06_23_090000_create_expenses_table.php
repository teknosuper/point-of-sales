<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->nullable()->constrained('outlets')->nullOnDelete();
            $table->date('expense_date');
            $table->string('category', 100);
            $table->string('description', 255);
            $table->unsignedBigInteger('amount')->default(0);
            $table->string('payment_method', 50)->nullable();
            $table->string('status', 20)->default('paid');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['outlet_id', 'expense_date']);
            $table->index(['outlet_id', 'status']);
            $table->index(['outlet_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
