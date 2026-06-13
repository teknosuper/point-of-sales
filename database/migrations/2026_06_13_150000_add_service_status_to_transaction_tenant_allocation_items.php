<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('transaction_tenant_allocation_items')) {
            return;
        }

        Schema::table('transaction_tenant_allocation_items', function (Blueprint $table) {
            if (! Schema::hasColumn('transaction_tenant_allocation_items', 'service_status')) {
                $table->string('service_status', 20)->default('pending')->after('notes');
                $table->timestamp('ready_at')->nullable()->after('service_status');
                $table->timestamp('picked_up_at')->nullable()->after('ready_at');
                $table->timestamp('delivered_at')->nullable()->after('picked_up_at');
                $table->index(['transaction_tenant_allocation_id', 'service_status'], 'ttai_allocation_service_status_idx');
            }
        });

        DB::table('transaction_tenant_allocation_items')
            ->orderBy('id')
            ->chunkById(200, function ($items) {
                $allocationIds = $items->pluck('transaction_tenant_allocation_id')->filter()->unique()->values();
                $allocations = DB::table('transaction_tenant_allocations')
                    ->whereIn('id', $allocationIds)
                    ->get()
                    ->keyBy('id');

                foreach ($items as $item) {
                    $allocation = $allocations->get($item->transaction_tenant_allocation_id);
                    if (! $allocation) {
                        continue;
                    }

                    $serviceStatus = match ($allocation->waiter_status) {
                        'delivered' => 'delivered',
                        'picked_up' => 'picked_up',
                        'assigned', 'ready' => 'ready',
                        'not_required' => 'not_required',
                        default => ((int) ($item->kitchen_station_id ?? 0) > 0 ? 'pending' : 'not_required'),
                    };

                    DB::table('transaction_tenant_allocation_items')
                        ->where('id', $item->id)
                        ->update([
                            'service_status' => $serviceStatus,
                            'ready_at' => in_array($serviceStatus, ['ready', 'picked_up', 'delivered'], true)
                                ? ($allocation->ready_at ?? null)
                                : null,
                            'picked_up_at' => in_array($serviceStatus, ['picked_up', 'delivered'], true)
                                ? ($allocation->picked_up_at ?? null)
                                : null,
                            'delivered_at' => $serviceStatus === 'delivered'
                                ? ($allocation->delivered_at ?? null)
                                : null,
                        ]);
                }
            });
    }

    public function down(): void
    {
        if (! Schema::hasTable('transaction_tenant_allocation_items')) {
            return;
        }

        Schema::table('transaction_tenant_allocation_items', function (Blueprint $table) {
            if (Schema::hasColumn('transaction_tenant_allocation_items', 'service_status')) {
                $table->dropIndex('ttai_allocation_service_status_idx');
                $table->dropColumn(['service_status', 'ready_at', 'picked_up_at', 'delivered_at']);
            }
        });
    }
};
