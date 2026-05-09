<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('preferred_workspace', 20)->default('standard')->after('avatar');
            $table->unsignedBigInteger('preferred_kitchen_station_id')->nullable()->after('preferred_workspace');

            $table->foreign('preferred_kitchen_station_id')
                ->references('id')
                ->on('kitchen_stations')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['preferred_kitchen_station_id']);
            $table->dropColumn(['preferred_workspace', 'preferred_kitchen_station_id']);
        });
    }
};
