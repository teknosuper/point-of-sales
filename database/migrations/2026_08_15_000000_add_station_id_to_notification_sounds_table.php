<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_sounds', function (Blueprint $table) {
            $table->foreignId('station_id')
                ->nullable()
                ->constrained('kitchen_stations')
                ->nullOnDelete()
                ->after('outlet_id');

            $table->index(['station_id', 'type', 'is_active']);
            $table->index(['station_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::table('notification_sounds', function (Blueprint $table) {
            $table->dropIndex(['station_id', 'is_active']);
            $table->dropIndex(['station_id', 'type', 'is_active']);
            $table->dropForeign(['station_id']);
            $table->dropColumn('station_id');
        });
    }
};
