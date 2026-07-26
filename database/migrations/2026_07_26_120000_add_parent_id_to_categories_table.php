<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->foreignId('parent_id')
                ->nullable()
                ->after('id')
                ->constrained('categories')
                ->nullOnDelete();

            $table->index(['parent_id']);
        });

        // Map existing global categories as main categories (parent_id stays null)
        // Link tenant categories to the closest global category by name heuristic
        $globalCategories = DB::table('categories')
            ->whereNull('tenant_outlet_id')
            ->get(['id', 'name'])
            ->keyBy(fn ($row) => strtolower(trim($row->name)));

        $tenantCategories = DB::table('categories')
            ->whereNotNull('tenant_outlet_id')
            ->get(['id', 'name', 'tenant_outlet_id']);

        $nameToParentMap = [
            'minuman' => 'minuman',
            'makanan berat' => 'makanan berat',
            'makanan ringan' => 'makanan ringan',
            'roti & kue' => 'roti & kue',
            'bumbu & rempah' => 'bumbu & rempah',
            'perawatan tubuh' => 'perawatan tubuh',
            'kebutuhan rumah' => 'kebutuhan rumah',
            'produk susu' => 'produk susu',
        ];

        foreach ($tenantCategories as $tenantCategory) {
            $normalizedName = strtolower(trim($tenantCategory->name));
            $parentId = null;

            if (isset($nameToParentMap[$normalizedName]) && isset($globalCategories[$nameToParentMap[$normalizedName]])) {
                $parentId = $globalCategories[$nameToParentMap[$normalizedName]]->id;
            } elseif (isset($globalCategories[$normalizedName])) {
                $parentId = $globalCategories[$normalizedName]->id;
            }

            if ($parentId !== null) {
                DB::table('categories')
                    ->where('id', $tenantCategory->id)
                    ->update(['parent_id' => $parentId]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropIndex(['parent_id']);
            $table->dropColumn('parent_id');
        });
    }
};
