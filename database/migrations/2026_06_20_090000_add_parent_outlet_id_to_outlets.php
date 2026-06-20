<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('outlets') || Schema::hasColumn('outlets', 'parent_outlet_id')) {
            return;
        }

        Schema::table('outlets', function (Blueprint $table) {
            $table->foreignId('parent_outlet_id')
                ->nullable()
                ->after('outlet_type')
                ->constrained('outlets')
                ->nullOnDelete();

            $table->index(['parent_outlet_id', 'outlet_type']);
        });

        $defaultMainOutletId = DB::table('outlets')
            ->where('outlet_type', 'main')
            ->orderByDesc('is_default')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->value('id');

        if (! $defaultMainOutletId) {
            return;
        }

        DB::table('outlets')
            ->where('outlet_type', 'tenant')
            ->whereNull('parent_outlet_id')
            ->update(['parent_outlet_id' => $defaultMainOutletId]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('outlets') || ! Schema::hasColumn('outlets', 'parent_outlet_id')) {
            return;
        }

        Schema::table('outlets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_outlet_id');
        });
    }
};
