<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_tenant_allocations', function (Blueprint $table) {
            $table->foreignId('validated_by')->nullable()->after('settled_at')->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable()->after('validated_by');
            $table->unsignedBigInteger('payout_cash_amount')->default(0)->after('payout_paid_at');
            $table->unsignedBigInteger('payout_transfer_amount')->default(0)->after('payout_cash_amount');
            $table->unsignedBigInteger('payout_other_amount')->default(0)->after('payout_transfer_amount');
            $table->string('payout_other_label', 60)->nullable()->after('payout_other_amount');
            $table->string('payout_recipient_name', 120)->nullable()->after('payout_other_label');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_tenant_allocations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('validated_by');
            $table->dropColumn([
                'validated_at',
                'payout_cash_amount',
                'payout_transfer_amount',
                'payout_other_amount',
                'payout_other_label',
                'payout_recipient_name',
            ]);
        });
    }
};
