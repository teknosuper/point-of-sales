<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            if (! Schema::hasColumn('suppliers', 'outlet_id')) {
                $table->foreignId('outlet_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('outlets')
                    ->nullOnDelete();
                $table->index('outlet_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            if (Schema::hasColumn('suppliers', 'outlet_id')) {
                $table->dropIndex(['outlet_id']);
                $table->dropConstrainedForeignId('outlet_id');
            }
        });
    }
};
