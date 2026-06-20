<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('products') && ! Schema::hasColumn('products', 'requires_modifier_selection')) {
            Schema::table('products', function (Blueprint $table) {
                $table->boolean('requires_modifier_selection')
                    ->default(false)
                    ->after('supports_modifiers');
            });
        }

        if (Schema::hasTable('product_modifier_options') && ! Schema::hasColumn('product_modifier_options', 'is_required')) {
            Schema::table('product_modifier_options', function (Blueprint $table) {
                $table->boolean('is_required')
                    ->default(false)
                    ->after('is_active');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('product_modifier_options') && Schema::hasColumn('product_modifier_options', 'is_required')) {
            Schema::table('product_modifier_options', function (Blueprint $table) {
                $table->dropColumn('is_required');
            });
        }

        if (Schema::hasTable('products') && Schema::hasColumn('products', 'requires_modifier_selection')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('requires_modifier_selection');
            });
        }
    }
};
