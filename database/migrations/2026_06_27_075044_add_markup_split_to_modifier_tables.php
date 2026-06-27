<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // cart_modifiers: tambah base_price dan markup_price
        Schema::table('cart_modifiers', function (Blueprint $table) {
            $table->unsignedBigInteger('base_price')->default(0)->after('unit_price');
            $table->unsignedBigInteger('markup_price')->default(0)->after('base_price');
        });

        // transaction_detail_modifiers: tambah base_price dan markup_price
        Schema::table('transaction_detail_modifiers', function (Blueprint $table) {
            $table->unsignedBigInteger('base_price')->default(0)->after('unit_price');
            $table->unsignedBigInteger('markup_price')->default(0)->after('base_price');
        });
    }

    public function down(): void
    {
        Schema::table('cart_modifiers', function (Blueprint $table) {
            $table->dropColumn(['base_price', 'markup_price']);
        });

        Schema::table('transaction_detail_modifiers', function (Blueprint $table) {
            $table->dropColumn(['base_price', 'markup_price']);
        });
    }
};
