<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_settings', function (Blueprint $table) {
            $table->decimal('pakasir_fee_percentage', 8, 4)->default(0)->after('pakasir_method');
            $table->unsignedInteger('pakasir_fee_fixed')->default(0)->after('pakasir_fee_percentage');
        });
    }

    public function down(): void
    {
        Schema::table('payment_settings', function (Blueprint $table) {
            $table->dropColumn([
                'pakasir_fee_percentage',
                'pakasir_fee_fixed',
            ]);
        });
    }
};
