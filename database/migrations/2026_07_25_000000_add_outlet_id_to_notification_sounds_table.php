<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_sounds', function (Blueprint $table) {
            $table->foreignId('outlet_id')
                ->nullable()
                ->constrained('outlets')
                ->nullOnDelete()
                ->after('sort_order');

            $table->index(['outlet_id', 'type', 'is_active']);
            $table->index(['outlet_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::table('notification_sounds', function (Blueprint $table) {
            $table->dropIndex(['outlet_id', 'is_active']);
            $table->dropIndex(['outlet_id', 'type', 'is_active']);
            $table->dropForeign(['outlet_id']);
            $table->dropColumn('outlet_id');
        });
    }
};
