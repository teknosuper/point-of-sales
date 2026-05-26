<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_details', function (Blueprint $table) {
            $table->unsignedBigInteger('customer_base_unit_price')->default(0)->after('base_unit_price');
            $table->unsignedBigInteger('tenant_base_unit_price')->default(0)->after('customer_base_unit_price');
            $table->unsignedBigInteger('owner_markup_unit_price')->default(0)->after('tenant_base_unit_price');
            $table->unsignedBigInteger('tenant_discount_total')->default(0)->after('discount_total');
            $table->unsignedBigInteger('owner_discount_total')->default(0)->after('tenant_discount_total');
            $table->unsignedBigInteger('tenant_net_total')->default(0)->after('owner_discount_total');
            $table->unsignedBigInteger('owner_net_total')->default(0)->after('tenant_net_total');
            $table->string('pricing_rule_price_basis', 20)->nullable()->after('pricing_rule_kind');
        });

        Schema::table('table_order_items', function (Blueprint $table) {
            $table->unsignedBigInteger('customer_base_unit_price')->default(0)->after('base_unit_price');
            $table->unsignedBigInteger('tenant_base_unit_price')->default(0)->after('customer_base_unit_price');
            $table->unsignedBigInteger('owner_markup_unit_price')->default(0)->after('tenant_base_unit_price');
            $table->unsignedBigInteger('tenant_discount_total')->default(0)->after('discount_total');
            $table->unsignedBigInteger('owner_discount_total')->default(0)->after('tenant_discount_total');
            $table->unsignedBigInteger('tenant_net_total')->default(0)->after('owner_discount_total');
            $table->unsignedBigInteger('owner_net_total')->default(0)->after('tenant_net_total');
            $table->string('pricing_rule_price_basis', 20)->nullable()->after('pricing_rule_kind');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_details', function (Blueprint $table) {
            $table->dropColumn([
                'customer_base_unit_price',
                'tenant_base_unit_price',
                'owner_markup_unit_price',
                'tenant_discount_total',
                'owner_discount_total',
                'tenant_net_total',
                'owner_net_total',
                'pricing_rule_price_basis',
            ]);
        });

        Schema::table('table_order_items', function (Blueprint $table) {
            $table->dropColumn([
                'customer_base_unit_price',
                'tenant_base_unit_price',
                'owner_markup_unit_price',
                'tenant_discount_total',
                'owner_discount_total',
                'tenant_net_total',
                'owner_net_total',
                'pricing_rule_price_basis',
            ]);
        });
    }
};
