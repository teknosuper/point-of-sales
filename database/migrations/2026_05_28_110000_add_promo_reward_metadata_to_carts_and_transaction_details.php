<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->boolean('is_promo_reward')->default(false)->after('notes');
            $table->string('promo_reward_rule_name')->nullable()->after('is_promo_reward');
            $table->string('promo_reward_label')->nullable()->after('promo_reward_rule_name');
        });

        Schema::table('transaction_details', function (Blueprint $table) {
            $table->boolean('is_promo_reward')->default(false)->after('pricing_group_label');
            $table->string('promo_reward_rule_name')->nullable()->after('is_promo_reward');
            $table->string('promo_reward_label')->nullable()->after('promo_reward_rule_name');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_details', function (Blueprint $table) {
            $table->dropColumn([
                'is_promo_reward',
                'promo_reward_rule_name',
                'promo_reward_label',
            ]);
        });

        Schema::table('carts', function (Blueprint $table) {
            $table->dropColumn([
                'is_promo_reward',
                'promo_reward_rule_name',
                'promo_reward_label',
            ]);
        });
    }
};
