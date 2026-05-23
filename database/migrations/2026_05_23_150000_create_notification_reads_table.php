<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 40);
            $table->unsignedBigInteger('reference_id');
            $table->timestamps();

            $table->unique(['user_id', 'type', 'reference_id'], 'notification_reads_user_type_ref_unique');
            $table->index(['type', 'reference_id'], 'notification_reads_type_ref_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_reads');
    }
};
