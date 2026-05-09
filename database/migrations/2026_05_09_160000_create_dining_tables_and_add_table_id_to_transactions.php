<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dining_tables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code')->nullable();
            $table->unsignedInteger('capacity')->default(4);
            $table->string('status', 20)->default('active');
            $table->unsignedInteger('sort_order')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['outlet_id', 'status', 'sort_order']);
            $table->unique(['outlet_id', 'name']);
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('table_id')
                ->nullable()
                ->after('waiter_id')
                ->constrained('dining_tables')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('table_id');
        });

        Schema::dropIfExists('dining_tables');
    }
};
