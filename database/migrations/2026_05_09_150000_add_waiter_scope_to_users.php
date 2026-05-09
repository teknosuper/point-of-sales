<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('waiter_service_scope', 32)
                ->default('outlet_all')
                ->after('preferred_kitchen_station_id');
        });

        Schema::create('user_waiter_tenant_outlet', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_outlet_id')->constrained('outlets')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'tenant_outlet_id'], 'waiter_tenant_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_waiter_tenant_outlet');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('waiter_service_scope');
        });
    }
};
