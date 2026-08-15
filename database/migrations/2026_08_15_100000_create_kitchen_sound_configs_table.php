<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kitchen_sound_configs', function (Blueprint $table) {
            $table->id();
            $table->string('event_type')->unique();
            $table->unsignedInteger('interval_seconds')->default(0);
            $table->boolean('is_enabled')->default(false);
            $table->timestamps();
        });

        DB::table('kitchen_sound_configs')->insert([
            ['event_type' => 'print_failed',  'interval_seconds' => 0, 'is_enabled' => false, 'created_at' => now(), 'updated_at' => now()],
            ['event_type' => 'print_pending', 'interval_seconds' => 0, 'is_enabled' => false, 'created_at' => now(), 'updated_at' => now()],
            ['event_type' => 'print_reminder','interval_seconds' => 0, 'is_enabled' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('kitchen_sound_configs');
    }
};
