<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('table_order_item_modifiers', function (Blueprint $table) {
            $table->unsignedBigInteger('base_price')->default(0)->after('unit_price');
            $table->unsignedBigInteger('markup_price')->default(0)->after('base_price');
        });
    }

    public function down(): void
    {
        Schema::table('table_order_item_modifiers', function (Blueprint $table) {
            $table->dropColumn(['base_price', 'markup_price']);
        });
    }
};
