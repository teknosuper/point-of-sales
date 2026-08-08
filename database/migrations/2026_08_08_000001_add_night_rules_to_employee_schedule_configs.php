<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_schedule_configs', function (Blueprint $table) {
            $table->unsignedTinyInteger('max_night_per_week')->default(3)->after('blocked_weekdays');
            $table->boolean('night_after_off')->default(true)->after('max_night_per_week');
        });
    }

    public function down(): void
    {
        Schema::table('employee_schedule_configs', function (Blueprint $table) {
            $table->dropColumn(['max_night_per_week', 'night_after_off']);
        });
    }
};
