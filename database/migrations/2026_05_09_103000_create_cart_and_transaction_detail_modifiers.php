<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cart_modifiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cart_id')->constrained('carts')->cascadeOnDelete();
            $table->string('name');
            $table->integer('qty')->default(1);
            $table->bigInteger('unit_price')->default(0);
            $table->bigInteger('total_price')->default(0);
            $table->timestamps();
        });

        Schema::create('transaction_detail_modifiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_detail_id')->constrained('transaction_details')->cascadeOnDelete();
            $table->string('name');
            $table->integer('qty')->default(1);
            $table->bigInteger('unit_price')->default(0);
            $table->bigInteger('total_price')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_detail_modifiers');
        Schema::dropIfExists('cart_modifiers');
    }
};
