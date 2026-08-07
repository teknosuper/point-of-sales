<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_schedules', function (Blueprint $table) {
            $table->string('status', 20)->default('masuk')->after('note');
        });

        // Backfill: baris dengan shift -> masuk, tanpa shift -> libur.
        DB::table('employee_schedules')
            ->whereNull('shift_id')
            ->update(['status' => 'libur']);

        DB::table('employee_schedules')
            ->whereNotNull('shift_id')
            ->update(['status' => 'masuk']);
    }

    public function down(): void
    {
        Schema::table('employee_schedules', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};