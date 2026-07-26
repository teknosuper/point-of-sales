<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_featured')->default(false)->after('tenant_outlet_id');
            $table->timestamp('shadow_banned_at')->nullable()->after('is_featured');
            $table->string('shadow_ban_reason')->nullable()->after('shadow_banned_at');
            $table->string('penalty_status')->nullable()->after('shadow_ban_reason'); // under_review | accepted | rejected

            $table->index(['is_featured', 'id']);
            $table->index(['shadow_banned_at']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['shadow_banned_at']);
            $table->dropIndex(['is_featured', 'id']);

            $table->dropColumn([
                'penalty_status',
                'shadow_ban_reason',
                'shadow_banned_at',
                'is_featured',
            ]);
        });
    }
};
