<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pricing_rules', function (Blueprint $table) {
            if (! Schema::hasColumn('pricing_rules', 'active_days')) {
                $table->json('active_days')->nullable()->after('ends_at');
            }

            if (! Schema::hasColumn('pricing_rules', 'daily_start_time')) {
                $table->time('daily_start_time')->nullable()->after('active_days');
            }

            if (! Schema::hasColumn('pricing_rules', 'daily_end_time')) {
                $table->time('daily_end_time')->nullable()->after('daily_start_time');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pricing_rules', function (Blueprint $table) {
            $table->dropColumn([
                'active_days',
                'daily_start_time',
                'daily_end_time',
            ]);
        });
    }
};
