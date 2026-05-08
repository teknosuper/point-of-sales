<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->foreignId('outlet_id')->nullable()->after('id')->constrained('outlets')->nullOnDelete();
            $table->dropUnique('settings_key_unique');
            $table->index(['key', 'outlet_id'], 'settings_key_outlet_lookup_index');
        });

        Schema::table('payment_settings', function (Blueprint $table) {
            $table->foreignId('outlet_id')->nullable()->after('id')->constrained('outlets')->nullOnDelete();
            $table->index('outlet_id', 'payment_settings_outlet_lookup_index');
        });
    }

    public function down(): void
    {
        Schema::table('payment_settings', function (Blueprint $table) {
            $table->dropIndex('payment_settings_outlet_lookup_index');
            $table->dropConstrainedForeignId('outlet_id');
        });

        Schema::table('settings', function (Blueprint $table) {
            $table->dropIndex('settings_key_outlet_lookup_index');
            $table->unique('key');
            $table->dropConstrainedForeignId('outlet_id');
        });
    }
};
