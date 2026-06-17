<?php

namespace App\Services;

use App\Models\KitchenTicket;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use Illuminate\Support\Collection;

class WaiterFulfillmentService
{
    public function markAllocationItemsReadyByDetailIds(array $detailIds): void
    {
        $detailIds = collect($detailIds)->map(fn ($id) => (int) $id)->filter()->unique()->values();

        if ($detailIds->isEmpty()) {
            return;
        }

        $items = TransactionTenantAllocationItem::query()
            ->whereIn('transaction_detail_id', $detailIds)
            ->get();

        if ($items->isEmpty()) {
            return;
        }

        $timestamp = now();

        foreach ($items as $item) {
            if (in_array($item->service_status, ['picked_up', 'delivered'], true)) {
                continue;
            }

            $item->forceFill([
                'service_status' => 'ready',
                'ready_at' => $item->ready_at ?? $timestamp,
            ])->save();
        }

        $this->syncAllocationsByIds(
            $items->pluck('transaction_tenant_allocation_id')
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values()
                ->all()
        );
    }

    public function markAllocationItemsDeliveredByDetailIds(array $detailIds, ?int $waiterId = null): void
    {
        $detailIds = collect($detailIds)->map(fn ($id) => (int) $id)->filter()->unique()->values();

        if ($detailIds->isEmpty()) {
            return;
        }

        $items = TransactionTenantAllocationItem::query()
            ->with('allocation:id,waiter_id')
            ->whereIn('transaction_detail_id', $detailIds)
            ->get();

        if ($items->isEmpty()) {
            return;
        }

        $timestamp = now();

        foreach ($items as $item) {
            $item->forceFill([
                'service_status' => 'delivered',
                'ready_at' => $item->ready_at ?? $timestamp,
                'picked_up_at' => $item->picked_up_at ?? $timestamp,
                'delivered_at' => $timestamp,
            ])->save();

            if ($waiterId && ! $item->allocation?->waiter_id) {
                $item->allocation->forceFill([
                    'waiter_id' => $waiterId,
                ])->save();
            }
        }

        $allocationIds = $items->pluck('transaction_tenant_allocation_id')
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        $this->syncAllocationsByIds($allocationIds);

        TransactionTenantAllocation::query()
            ->whereIn('id', $allocationIds)
            ->pluck('transaction_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->each(fn (int $transactionId) => $this->syncKitchenTicketsForTransaction($transactionId, $waiterId));
    }

    public function pickUpAllocationItems(TransactionTenantAllocation $allocation, array $itemIds = [], ?int $waiterId = null): void
    {
        $items = $this->resolveActionableItems($allocation, $itemIds, ['ready']);

        if ($items->isEmpty()) {
            return;
        }

        $timestamp = now();

        foreach ($items as $item) {
            $item->forceFill([
                'service_status' => 'picked_up',
                'ready_at' => $item->ready_at ?? $timestamp,
                'picked_up_at' => $timestamp,
            ])->save();
        }

        if ($waiterId) {
            $allocation->forceFill([
                'waiter_id' => $allocation->waiter_id ?: $waiterId,
            ])->save();
        }

        $this->syncAllocation($allocation->fresh('items'));
    }

    public function deliverAllocationItems(TransactionTenantAllocation $allocation, array $itemIds = [], ?int $waiterId = null): void
    {
        $items = $this->resolveActionableItems($allocation, $itemIds, ['ready', 'picked_up']);

        if ($items->isEmpty()) {
            return;
        }

        $timestamp = now();

        foreach ($items as $item) {
            $item->forceFill([
                'service_status' => 'delivered',
                'ready_at' => $item->ready_at ?? $timestamp,
                'picked_up_at' => $item->picked_up_at ?? $timestamp,
                'delivered_at' => $timestamp,
            ])->save();
        }

        if ($waiterId) {
            $allocation->forceFill([
                'waiter_id' => $allocation->waiter_id ?: $waiterId,
            ])->save();
        }

        $this->syncAllocation($allocation->fresh('items'));
        $this->syncKitchenTicketsForTransaction((int) $allocation->transaction_id, $waiterId);
    }

    public function syncAllocation(TransactionTenantAllocation $allocation): void
    {
        $allocation->loadMissing('items');

        $serviceItems = $allocation->items
            ->filter(fn (TransactionTenantAllocationItem $item) => $item->service_status !== 'not_required')
            ->values();

        if ($serviceItems->isEmpty()) {
            $allocation->forceFill([
                'waiter_status' => 'not_required',
                'ready_at' => null,
                'picked_up_at' => null,
                'delivered_at' => null,
            ])->save();

            return;
        }

        $allDelivered = $serviceItems->every(
            fn (TransactionTenantAllocationItem $item) => $item->service_status === 'delivered'
        );
        $hasPickedUp = $serviceItems->contains(
            fn (TransactionTenantAllocationItem $item) => $item->service_status === 'picked_up'
        );
        $hasReady = $serviceItems->contains(
            fn (TransactionTenantAllocationItem $item) => $item->service_status === 'ready'
        );
        $hasPending = $serviceItems->contains(
            fn (TransactionTenantAllocationItem $item) => $item->service_status === 'pending'
        );

        $nextStatus = match (true) {
            $allDelivered => 'delivered',
            $hasPickedUp => 'picked_up',
            $hasReady && (int) ($allocation->waiter_id ?? 0) > 0 => 'assigned',
            $hasReady => 'ready',
            $hasPending => 'pending',
            default => 'pending',
        };

        $readyAt = $serviceItems
            ->pluck('ready_at')
            ->filter()
            ->sort()
            ->first();

        $pickedUpAt = $serviceItems
            ->pluck('picked_up_at')
            ->filter()
            ->sort()
            ->first();

        $deliveredAt = $allDelivered
            ? $serviceItems->pluck('delivered_at')->filter()->sortDesc()->first()
            : null;

        $allocation->forceFill([
            'waiter_status' => $nextStatus,
            'ready_at' => $readyAt,
            'picked_up_at' => in_array($nextStatus, ['picked_up', 'delivered'], true) ? $pickedUpAt : null,
            'delivered_at' => $nextStatus === 'delivered' ? $deliveredAt : null,
        ])->save();
    }

    private function syncAllocationsByIds(array $allocationIds): void
    {
        TransactionTenantAllocation::query()
            ->with('items')
            ->whereIn('id', collect($allocationIds)->map(fn ($id) => (int) $id)->filter()->unique()->values())
            ->get()
            ->each(fn (TransactionTenantAllocation $allocation) => $this->syncAllocation($allocation));
    }

    private function resolveActionableItems(
        TransactionTenantAllocation $allocation,
        array $itemIds,
        array $allowedStatuses
    ): Collection {
        $allocation->loadMissing('items');

        $itemIds = collect($itemIds)->map(fn ($id) => (int) $id)->filter()->unique()->values();

        $items = $allocation->items
            ->filter(fn (TransactionTenantAllocationItem $item) => in_array($item->service_status, $allowedStatuses, true));

        if ($itemIds->isNotEmpty()) {
            $items = $items->filter(fn (TransactionTenantAllocationItem $item) => $itemIds->contains((int) $item->id));
        }

        return $items->values();
    }

    private function syncKitchenTicketsForTransaction(int $transactionId, ?int $waiterId = null): void
    {
        if ($transactionId <= 0) {
            return;
        }

        $deliveredDetailIds = TransactionTenantAllocationItem::query()
            ->whereHas('allocation', fn ($builder) => $builder->where('transaction_id', $transactionId))
            ->where('service_status', 'delivered')
            ->pluck('transaction_detail_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($deliveredDetailIds->isEmpty()) {
            return;
        }

        KitchenTicket::query()
            ->with('items:id,kitchen_ticket_id,transaction_detail_id')
            ->where('transaction_id', $transactionId)
            ->where('status', 'ready')
            ->get()
            ->each(function (KitchenTicket $ticket) use ($deliveredDetailIds, $waiterId, $transactionId) {
                $ticketDetailIds = $ticket->items
                    ->pluck('transaction_detail_id')
                    ->filter()
                    ->map(fn ($id) => (int) $id)
                    ->values();

                if (
                    $ticketDetailIds->isNotEmpty() &&
                    $ticketDetailIds->every(fn (int $detailId) => $deliveredDetailIds->contains($detailId))
                ) {
                    $ticket->forceFill([
                        'status' => 'completed',
                        'completed_at' => now(),
                    ])->save();

                    $ticket->events()->create([
                        'user_id' => $waiterId,
                        'event' => 'ticket.delivered',
                        'payload' => [
                            'transaction_id' => $transactionId,
                            'waiter_id' => $waiterId,
                        ],
                        'created_at' => now(),
                    ]);
                }
            });
    }
}
