<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pricing_rules', function (Blueprint $table) {
            if (! Schema::hasColumn('pricing_rules', 'outlet_id')) {
                $table->foreignId('outlet_id')
                    ->nullable()
                    ->after('category_id')
                    ->constrained('outlets')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('pricing_rules', 'price_basis')) {
                $table->string('price_basis', 20)
                    ->default('sell_price')
                    ->after('discount_value');
            }

            $table->index(['outlet_id', 'is_active', 'priority'], 'pricing_rules_outlet_active_priority_idx');
        });
    }

    public function down(): void
    {
        Schema::table('pricing_rules', function (Blueprint $table) {
            $table->dropIndex('pricing_rules_outlet_active_priority_idx');

            if (Schema::hasColumn('pricing_rules', 'outlet_id')) {
                $table->dropConstrainedForeignId('outlet_id');
            }

            if (Schema::hasColumn('pricing_rules', 'price_basis')) {
                $table->dropColumn('price_basis');
            }
        });
    }
};
