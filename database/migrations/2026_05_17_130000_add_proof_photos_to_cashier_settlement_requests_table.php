<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cashier_settlement_requests', function (Blueprint $table) {
            $table->json('request_proof_photos')->nullable()->after('requested_notes');
            $table->json('approval_proof_photos')->nullable()->after('approval_notes');
        });
    }

    public function down(): void
    {
        Schema::table('cashier_settlement_requests', function (Blueprint $table) {
            $table->dropColumn([
                'request_proof_photos',
                'approval_proof_photos',
            ]);
        });
    }
};
