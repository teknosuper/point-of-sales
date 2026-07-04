<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $table = config('permission.table_names.roles', 'roles');

        Schema::table($table, function (Blueprint $table) {
            if (! Schema::hasColumn(config('permission.table_names.roles', 'roles'), 'display_name')) {
                $table->string('display_name')->nullable()->after('name');
            }

            if (! Schema::hasColumn(config('permission.table_names.roles', 'roles'), 'description')) {
                $table->text('description')->nullable()->after('display_name');
            }
        });
    }

    public function down(): void
    {
        $tableName = config('permission.table_names.roles', 'roles');

        Schema::table($tableName, function (Blueprint $table) use ($tableName) {
            if (Schema::hasColumn($tableName, 'description')) {
                $table->dropColumn('description');
            }

            if (Schema::hasColumn($tableName, 'display_name')) {
                $table->dropColumn('display_name');
            }
        });
    }
};
