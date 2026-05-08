<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_campaigns') && ! Schema::hasColumn('customer_campaigns', 'outlet_id')) {
            Schema::table('customer_campaigns', function (Blueprint $table) {
                $table->foreignId('outlet_id')->nullable()->after('id')->constrained('outlets')->nullOnDelete();
                $table->index('outlet_id');
            });
        }

        if (Schema::hasTable('customer_campaign_logs') && ! Schema::hasColumn('customer_campaign_logs', 'outlet_id')) {
            Schema::table('customer_campaign_logs', function (Blueprint $table) {
                $table->foreignId('outlet_id')->nullable()->after('id')->constrained('outlets')->nullOnDelete();
                $table->index('outlet_id');
            });
        }

        $defaultOutletId = Schema::hasTable('outlets')
            ? DB::table('outlets')->where('is_default', true)->value('id') ?? DB::table('outlets')->min('id')
            : null;

        if ($defaultOutletId) {
            DB::table('customer_campaigns')->whereNull('outlet_id')->update(['outlet_id' => $defaultOutletId]);
            DB::table('customer_campaign_logs')->whereNull('outlet_id')->update(['outlet_id' => $defaultOutletId]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('customer_campaign_logs') && Schema::hasColumn('customer_campaign_logs', 'outlet_id')) {
            Schema::table('customer_campaign_logs', function (Blueprint $table) {
                $table->dropConstrainedForeignId('outlet_id');
            });
        }

        if (Schema::hasTable('customer_campaigns') && Schema::hasColumn('customer_campaigns', 'outlet_id')) {
            Schema::table('customer_campaigns', function (Blueprint $table) {
                $table->dropConstrainedForeignId('outlet_id');
            });
        }
    }
};
