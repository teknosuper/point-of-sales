<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_tenant_allocations', function (Blueprint $table) {
            $table->string('payout_reference')->nullable()->after('settled_at');
            $table->text('payout_notes')->nullable()->after('payout_reference');
            $table->timestamp('payout_paid_at')->nullable()->after('payout_notes');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_tenant_allocations', function (Blueprint $table) {
            $table->dropColumn([
                'payout_reference',
                'payout_notes',
                'payout_paid_at',
            ]);
        });
    }
};
