<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_tenant_allocations', function (Blueprint $table) {
            $table->string('waiter_status', 20)->default('pending')->after('kitchen_status');
            $table->foreignId('waiter_id')->nullable()->after('waiter_status')->constrained('users')->nullOnDelete();
            $table->timestamp('ready_at')->nullable()->after('waiter_id');
            $table->timestamp('picked_up_at')->nullable()->after('ready_at');
            $table->timestamp('delivered_at')->nullable()->after('picked_up_at');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_tenant_allocations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('waiter_id');
            $table->dropColumn([
                'waiter_status',
                'ready_at',
                'picked_up_at',
                'delivered_at',
            ]);
        });
    }
};
