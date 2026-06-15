<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cashier_shift_operators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cashier_shift_id')->constrained('cashier_shifts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('joined_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();

            $table->unique(['cashier_shift_id', 'user_id']);
            $table->index(['user_id', 'cashier_shift_id']);
        });

        DB::table('cashier_shift_operators')->insertUsing(
            ['cashier_shift_id', 'user_id', 'joined_by', 'joined_at', 'created_at', 'updated_at'],
            DB::table('cashier_shifts')->selectRaw(
                'id as cashier_shift_id, user_id, opened_by as joined_by, opened_at as joined_at, CURRENT_TIMESTAMP as created_at, CURRENT_TIMESTAMP as updated_at'
            )
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('cashier_shift_operators');
    }
};
