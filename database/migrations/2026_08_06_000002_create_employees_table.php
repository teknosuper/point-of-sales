<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('job_type');
            $table->string('phone', 30)->nullable();
            $table->string('notes')->nullable();
            $table->unsignedInteger('rotation_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['job_type', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
