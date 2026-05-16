<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kitchen_stations', function (Blueprint $table) {
            if (! Schema::hasColumn('kitchen_stations', 'processing_mode')) {
                $table->string('processing_mode', 20)
                    ->default('auto')
                    ->after('display_mode');
            }
        });
    }

    public function down(): void
    {
        Schema::table('kitchen_stations', function (Blueprint $table) {
            if (Schema::hasColumn('kitchen_stations', 'processing_mode')) {
                $table->dropColumn('processing_mode');
            }
        });
    }
};
