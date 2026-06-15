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
            $table->foreignId('tenant_outlet_id')
                ->nullable()
                ->after('description')
                ->constrained('outlets')
                ->nullOnDelete();
            $table->index(['tenant_outlet_id', 'name']);
        });

        $tenantProductMappings = DB::table('products')
            ->select('category_id', 'tenant_outlet_id')
            ->whereNotNull('category_id')
            ->whereNotNull('tenant_outlet_id')
            ->distinct()
            ->get();

        foreach ($tenantProductMappings as $mapping) {
            $sourceCategory = DB::table('categories')->where('id', $mapping->category_id)->first();

            if (! $sourceCategory) {
                continue;
            }

            $existingTenantCategory = DB::table('categories')
                ->where('name', $sourceCategory->name)
                ->where('description', $sourceCategory->description)
                ->where('image', $sourceCategory->image)
                ->where('tenant_outlet_id', $mapping->tenant_outlet_id)
                ->first();

            if ($existingTenantCategory) {
                DB::table('products')
                    ->where('category_id', $mapping->category_id)
                    ->where('tenant_outlet_id', $mapping->tenant_outlet_id)
                    ->update(['category_id' => $existingTenantCategory->id]);

                continue;
            }

            $newCategoryId = DB::table('categories')->insertGetId([
                'image' => $sourceCategory->image,
                'name' => $sourceCategory->name,
                'description' => $sourceCategory->description,
                'tenant_outlet_id' => $mapping->tenant_outlet_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('products')
                ->where('category_id', $mapping->category_id)
                ->where('tenant_outlet_id', $mapping->tenant_outlet_id)
                ->update(['category_id' => $newCategoryId]);
        }
    }

    public function down(): void
    {
        $tenantCategories = DB::table('categories')
            ->whereNotNull('tenant_outlet_id')
            ->orderBy('id')
            ->get(['id', 'name', 'description', 'image', 'tenant_outlet_id']);

        foreach ($tenantCategories as $tenantCategory) {
            $globalCategory = DB::table('categories')
                ->where('name', $tenantCategory->name)
                ->where('description', $tenantCategory->description)
                ->where('image', $tenantCategory->image)
                ->whereNull('tenant_outlet_id')
                ->orderBy('id')
                ->first();

            if (! $globalCategory) {
                continue;
            }

            DB::table('products')
                ->where('category_id', $tenantCategory->id)
                ->update(['category_id' => $globalCategory->id]);
        }

        DB::table('categories')->whereNotNull('tenant_outlet_id')->delete();

        Schema::table('categories', function (Blueprint $table) {
            $table->dropIndex('categories_tenant_outlet_id_name_index');
            $table->dropConstrainedForeignId('tenant_outlet_id');
        });
    }
};
