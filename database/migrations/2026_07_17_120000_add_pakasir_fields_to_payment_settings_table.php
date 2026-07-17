<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_settings', function (Blueprint $table) {
            $table->boolean('pakasir_enabled')->default(false)->after('xendit_production');
            $table->string('pakasir_project_slug')->nullable()->after('pakasir_enabled');
            $table->text('pakasir_api_key')->nullable()->after('pakasir_project_slug');
            $table->string('pakasir_method')->default('qris')->after('pakasir_api_key');
        });
    }

    public function down(): void
    {
        Schema::table('payment_settings', function (Blueprint $table) {
            $table->dropColumn([
                'pakasir_enabled',
                'pakasir_project_slug',
                'pakasir_api_key',
                'pakasir_method',
            ]);
        });
    }
};
