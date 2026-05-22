<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('table_order_items', function (Blueprint $table) {
            $table->unsignedBigInteger('base_unit_price')->default(0)->after('qty');
            $table->unsignedBigInteger('discount_total')->default(0)->after('line_total');
            $table->foreignId('pricing_rule_id')->nullable()->after('discount_total')->constrained('pricing_rules')->nullOnDelete();
            $table->string('pricing_rule_name')->nullable()->after('pricing_rule_id');
            $table->string('pricing_rule_kind', 40)->nullable()->after('pricing_rule_name');
            $table->string('pricing_group_key')->nullable()->after('pricing_rule_kind');
            $table->string('pricing_group_label')->nullable()->after('pricing_group_key');
        });
    }

    public function down(): void
    {
        Schema::table('table_order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pricing_rule_id');
            $table->dropColumn([
                'base_unit_price',
                'discount_total',
                'pricing_rule_name',
                'pricing_rule_kind',
                'pricing_group_key',
                'pricing_group_label',
            ]);
        });
    }
};
