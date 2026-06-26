<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('product_modifier_options')) {
            return;
        }

        Schema::table('product_modifier_options', function (Blueprint $table) {
            if (! Schema::hasColumn('product_modifier_options', 'group_name')) {
                $table->string('group_name')->nullable()->after('product_id');
            }

            if (! Schema::hasColumn('product_modifier_options', 'selection_mode')) {
                $table->string('selection_mode', 20)->default('optional')->after('is_required');
            }

            if (! Schema::hasColumn('product_modifier_options', 'min_select')) {
                $table->unsignedInteger('min_select')->default(0)->after('selection_mode');
            }

            if (! Schema::hasColumn('product_modifier_options', 'max_select')) {
                $table->unsignedInteger('max_select')->nullable()->after('min_select');
            }

            if (! Schema::hasColumn('product_modifier_options', 'stock')) {
                $table->integer('stock')->nullable()->after('price');
            }

            if (! Schema::hasColumn('product_modifier_options', 'group_sort_order')) {
                $table->unsignedInteger('group_sort_order')->default(0)->after('sort_order');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('product_modifier_options')) {
            return;
        }

        Schema::table('product_modifier_options', function (Blueprint $table) {
            foreach ([
                'group_name',
                'selection_mode',
                'min_select',
                'max_select',
                'stock',
                'group_sort_order',
            ] as $column) {
                if (Schema::hasColumn('product_modifier_options', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
