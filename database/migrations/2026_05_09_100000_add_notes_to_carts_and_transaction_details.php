<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('carts') && ! Schema::hasColumn('carts', 'notes')) {
            Schema::table('carts', function (Blueprint $table) {
                $table->text('notes')->nullable()->after('price');
            });
        }

        if (Schema::hasTable('transaction_details') && ! Schema::hasColumn('transaction_details', 'notes')) {
            Schema::table('transaction_details', function (Blueprint $table) {
                $table->text('notes')->nullable()->after('price');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('transaction_details') && Schema::hasColumn('transaction_details', 'notes')) {
            Schema::table('transaction_details', function (Blueprint $table) {
                $table->dropColumn('notes');
            });
        }

        if (Schema::hasTable('carts') && Schema::hasColumn('carts', 'notes')) {
            Schema::table('carts', function (Blueprint $table) {
                $table->dropColumn('notes');
            });
        }
    }
};
