<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_schedules', function (Blueprint $table) {
            $table->id();
            $table->date('schedule_date');
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('shift_id')->nullable()->constrained('employee_shifts')->nullOnDelete();
            $table->string('note')->nullable();
            $table->timestamps();
            $table->unique(['schedule_date', 'employee_id']);
            $table->index('schedule_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_schedules');
    }
};
