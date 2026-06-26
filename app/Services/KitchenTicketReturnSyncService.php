<?php

namespace App\Services;

use App\Models\KitchenTicket;
use App\Models\KitchenTicketItem;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use Illuminate\Support\Collection;

class KitchenTicketReturnSyncService
{
    public function syncCompletedSalesReturn(SalesReturn $salesReturn, ?int $userId = null): void
    {
        $salesReturn->loadMissing([
            'items.transactionDetail',
            'items.product',
        ]);

        $detailIds = $salesReturn->items
            ->pluck('transaction_detail_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($detailIds->isEmpty()) {
            return;
        }

        $completedReturnTotals = SalesReturnItem::query()
            ->selectRaw('transaction_detail_id, COALESCE(SUM(qty_return), 0) as total_qty')
            ->whereIn('transaction_detail_id', $detailIds->all())
            ->whereHas('salesReturn', fn ($query) => $query->where('status', 'completed'))
            ->groupBy('transaction_detail_id')
            ->pluck('total_qty', 'transaction_detail_id')
            ->map(fn ($qty) => max(0, (int) $qty));

        $kitchenItems = KitchenTicketItem::query()
            ->with(['kitchenTicket', 'transactionDetail'])
            ->whereIn('transaction_detail_id', $detailIds->all())
            ->get();

        if ($kitchenItems->isEmpty()) {
            return;
        }

        $affectedTicketIds = $kitchenItems
            ->pluck('kitchen_ticket_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $ticketSnapshots = $kitchenItems
            ->groupBy(fn (KitchenTicketItem $item) => (int) $item->kitchen_ticket_id)
            ->map(function (Collection $items) use ($completedReturnTotals, $salesReturn) {
                return $items->map(function (KitchenTicketItem $item) use ($completedReturnTotals, $salesReturn) {
                    $currentReturnItem = $salesReturn->items->firstWhere('transaction_detail_id', $item->transaction_detail_id);
                    $originalQty = max(0, (int) $item->qty);
                    $cumulativeReturnedQty = min(
                        max(0, (int) ($item->transactionDetail?->qty ?? $originalQty)),
                        max(0, (int) ($completedReturnTotals->get((int) $item->transaction_detail_id, 0) ?? 0))
                    );
                    $remainingQty = max(0, max($originalQty, (int) ($item->transactionDetail?->qty ?? $originalQty)) - $cumulativeReturnedQty);

                    return [
                        'kitchen_ticket_item_id' => (int) $item->id,
                        'transaction_detail_id' => (int) ($item->transaction_detail_id ?? 0),
                        'product_title' => (string) ($item->product_title ?? $currentReturnItem?->product?->title ?? 'Produk'),
                        'returned_qty' => max(0, (int) ($currentReturnItem?->qty_return ?? 0)),
                        'cumulative_returned_qty' => $cumulativeReturnedQty,
                        'remaining_qty' => $remainingQty,
                        'original_qty' => max(
                            $originalQty,
                            (int) ($item->transactionDetail?->qty ?? 0),
                            $cumulativeReturnedQty + $remainingQty
                        ),
                    ];
                })->values();
            });

        foreach ($kitchenItems as $item) {
            $detailQty = max(0, (int) ($item->transactionDetail?->qty ?? $item->qty ?? 0));
            $totalReturnedQty = min(
                $detailQty,
                max(0, (int) ($completedReturnTotals->get((int) $item->transaction_detail_id, 0) ?? 0))
            );
            $remainingQty = max(0, $detailQty - $totalReturnedQty);

            if ($remainingQty > 0) {
                if ((int) $item->qty !== $remainingQty) {
                    $item->forceFill([
                        'qty' => $remainingQty,
                    ])->save();
                }

                continue;
            }

            $item->delete();
        }

        $tickets = KitchenTicket::query()
            ->with('items')
            ->whereIn('id', $affectedTicketIds->all())
            ->get()
            ->keyBy('id');

        foreach ($affectedTicketIds as $ticketId) {
            /** @var KitchenTicket|null $ticket */
            $ticket = $tickets->get((int) $ticketId);
            $snapshotItems = $ticketSnapshots->get((int) $ticketId, collect())->values();

            if (! $ticket || $snapshotItems->isEmpty()) {
                continue;
            }

            $remainingItemsCount = (int) $ticket->items->count();
            $remainingQtyTotal = (int) $ticket->items->sum('qty');
            $currentReturnedQtyTotal = (int) $snapshotItems->sum('returned_qty');
            $cumulativeReturnedQtyTotal = (int) $snapshotItems->sum('cumulative_returned_qty');
            $isFullyReturned = $remainingItemsCount === 0 || $remainingQtyTotal === 0;

            $ticket->events()->create([
                'user_id' => $userId,
                'event' => $isFullyReturned ? 'ticket.returned_full' : 'ticket.returned_partial',
                'payload' => [
                    'sales_return_id' => (int) $salesReturn->id,
                    'sales_return_code' => (string) $salesReturn->code,
                    'current_returned_qty_total' => $currentReturnedQtyTotal,
                    'cumulative_returned_qty_total' => $cumulativeReturnedQtyTotal,
                    'remaining_qty_total' => $remainingQtyTotal,
                    'remaining_items_count' => $remainingItemsCount,
                    'is_fully_returned' => $isFullyReturned,
                    'items' => $snapshotItems->all(),
                ],
                'created_at' => now(),
            ]);
        }
    }
}
