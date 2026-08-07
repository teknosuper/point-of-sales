<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_modifier_options', function (Blueprint $table) {
            $table->string('order_type_scope')->nullable()->after('group_name');
        });
    }

    public function down(): void
    {
        Schema::table('product_modifier_options', function (Blueprint $table) {
            $table->dropColumn('order_type_scope');
        });
    }
};
