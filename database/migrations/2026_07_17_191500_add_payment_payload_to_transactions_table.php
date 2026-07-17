<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->longText('payment_payload')->nullable()->after('payment_url');
            $table->timestamp('payment_expires_at')->nullable()->after('payment_payload');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn([
                'payment_payload',
                'payment_expires_at',
            ]);
        });
    }
};
