<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('customer_segment_memberships', 'outlet_id')) {
            Schema::table('customer_segment_memberships', function (Blueprint $table) {
                $table->foreignId('outlet_id')->nullable()->after('customer_segment_id')->constrained('outlets')->nullOnDelete();
                $table->index(['customer_segment_id', 'outlet_id'], 'cust_seg_membership_outlet_idx');
            });
        }

        $defaultOutletId = Schema::hasTable('outlets')
            ? DB::table('outlets')->where('is_default', true)->value('id') ?? DB::table('outlets')->min('id')
            : null;

        if ($defaultOutletId) {
            DB::table('customer_segment_memberships')
                ->whereNull('outlet_id')
                ->update(['outlet_id' => $defaultOutletId]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('customer_segment_memberships', 'outlet_id')) {
            Schema::table('customer_segment_memberships', function (Blueprint $table) {
                $table->dropConstrainedForeignId('outlet_id');
            });
        }
    }
};
