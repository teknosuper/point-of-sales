<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('table_order_item_modifiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('table_order_item_id')->constrained('table_order_items')->cascadeOnDelete();
            $table->foreignId('product_modifier_option_id')->nullable()->constrained('product_modifier_options')->nullOnDelete();
            $table->string('name');
            $table->unsignedInteger('qty')->default(1);
            $table->unsignedBigInteger('unit_price')->default(0);
            $table->unsignedBigInteger('total_price')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('table_order_item_modifiers');
    }
};
