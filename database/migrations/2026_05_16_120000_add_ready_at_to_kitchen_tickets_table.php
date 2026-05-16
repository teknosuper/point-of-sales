<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('kitchen_tickets') || Schema::hasColumn('kitchen_tickets', 'ready_at')) {
            return;
        }

        Schema::table('kitchen_tickets', function (Blueprint $table) {
            $table->timestamp('ready_at')->nullable()->after('acknowledged_at');
            $table->index(['kitchen_station_id', 'ready_at']);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('kitchen_tickets') || ! Schema::hasColumn('kitchen_tickets', 'ready_at')) {
            return;
        }

        Schema::table('kitchen_tickets', function (Blueprint $table) {
            $table->dropIndex(['kitchen_station_id', 'ready_at']);
            $table->dropColumn('ready_at');
        });
    }
};
