<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('table_order_items', function (Blueprint $table) {
            if (! Schema::hasColumn('table_order_items', 'is_promo_reward')) {
                $table->boolean('is_promo_reward')->default(false)->after('pricing_group_label');
            }

            if (! Schema::hasColumn('table_order_items', 'promo_reward_rule_name')) {
                $table->string('promo_reward_rule_name')->nullable()->after('is_promo_reward');
            }

            if (! Schema::hasColumn('table_order_items', 'promo_reward_label')) {
                $table->string('promo_reward_label')->nullable()->after('promo_reward_rule_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('table_order_items', function (Blueprint $table) {
            $columns = collect([
                'is_promo_reward',
                'promo_reward_rule_name',
                'promo_reward_label',
            ])->filter(fn (string $column) => Schema::hasColumn('table_order_items', $column))
                ->values()
                ->all();

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
