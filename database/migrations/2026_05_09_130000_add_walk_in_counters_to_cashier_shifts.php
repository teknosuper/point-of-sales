<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('cashier_shifts')) {
            return;
        }

        Schema::table('cashier_shifts', function (Blueprint $table) {
            if (! Schema::hasColumn('cashier_shifts', 'walk_in_transactions_count')) {
                $table->unsignedInteger('walk_in_transactions_count')
                    ->default(0)
                    ->after('transactions_count');
            }

            if (! Schema::hasColumn('cashier_shifts', 'registered_transactions_count')) {
                $table->unsignedInteger('registered_transactions_count')
                    ->default(0)
                    ->after('walk_in_transactions_count');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('cashier_shifts')) {
            return;
        }

        Schema::table('cashier_shifts', function (Blueprint $table) {
            $columnsToDrop = [];

            if (Schema::hasColumn('cashier_shifts', 'registered_transactions_count')) {
                $columnsToDrop[] = 'registered_transactions_count';
            }

            if (Schema::hasColumn('cashier_shifts', 'walk_in_transactions_count')) {
                $columnsToDrop[] = 'walk_in_transactions_count';
            }

            if ($columnsToDrop !== []) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
