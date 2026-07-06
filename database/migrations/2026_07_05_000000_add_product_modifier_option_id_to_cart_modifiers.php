<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cart_modifiers', function (Blueprint $table) {
            $table->unsignedBigInteger('product_modifier_option_id')->nullable()->after('cart_id');
        });
    }

    public function down(): void
    {
        Schema::table('cart_modifiers', function (Blueprint $table) {
            $table->dropColumn('product_modifier_option_id');
        });
    }
};
