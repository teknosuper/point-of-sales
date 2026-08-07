<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_schedule_configs', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('day_off_per_week')->default(1);
            $table->json('blocked_weekdays')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_schedule_configs');
    }
};
