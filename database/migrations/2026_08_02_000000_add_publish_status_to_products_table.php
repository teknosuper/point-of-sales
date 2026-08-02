<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // draft | pending | approved | rejected
            $table->string('publish_status')->default('pending')->after('penalty_status');
            $table->timestamp('published_at')->nullable()->after('publish_status');
            $table->unsignedBigInteger('reviewed_by')->nullable()->after('published_at');
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            $table->text('review_note')->nullable()->after('reviewed_at');

            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['publish_status', 'id']);
        });

        // Backfill: semua produk existing langsung approved & published,
        // agar tidak masuk antrian review setelah fitur ini rilis.
        DB::table('products')->update([
            'publish_status' => 'approved',
            'published_at' => DB::raw('COALESCE(updated_at, created_at, NOW())'),
        ]);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by']);
            $table->dropIndex(['publish_status', 'id']);

            $table->dropColumn([
                'review_note',
                'reviewed_at',
                'reviewed_by',
                'published_at',
                'publish_status',
            ]);
        });
    }
};
