<?php

namespace App\Services;

use App\Models\KitchenStationDevice;
use App\Models\KitchenStation;
use App\Models\KitchenTicket;
use App\Models\ProductKitchenStationMapping;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use Illuminate\Support\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class KitchenTicketService
{
    public function __construct(
        private readonly PrintJobService $printJobService
    ) {}

    public function createForTransaction(Transaction $transaction, string $sourceChannel = 'pos'): Collection
    {
        $transaction->loadMissing([
            'details.product.kitchenStationMappings.kitchenStation',
            'details.modifiers',
            'cashierShift',
        ]);

        $groupedDetails = $transaction->details
            ->filter(fn (TransactionDetail $detail) => $detail->product)
            ->groupBy(function (TransactionDetail $detail) {
                $mapping = $detail->product->kitchenStationMappings
                    ->where('is_active', true)
                    ->sortBy('priority')
                    ->first();

                return $mapping?->kitchen_station_id;
            })
            ->filter(fn (Collection $details, $stationId) => ! empty($stationId));

        $tickets = collect();

        foreach ($groupedDetails as $stationId => $details) {
            $ticket = $this->createLockedTicket($transaction, (int) $stationId, $sourceChannel);

            if ($ticket->items()->exists()) {
                $tickets->push($ticket->load(['items', 'kitchenStation']));

                continue;
            }

            foreach ($details as $detail) {
                /** @var TransactionDetail $detail */
                $mapping = $detail->product->kitchenStationMappings
                    ->where('is_active', true)
                    ->sortBy('priority')
                    ->first();

                if ($mapping instanceof ProductKitchenStationMapping) {
                    $detail->forceFill([
                        'kitchen_station_id' => $mapping->kitchen_station_id,
                    ])->save();
                }

                $ticket->items()->create([
                    'transaction_detail_id' => $detail->id,
                    'product_id' => $detail->product_id,
                    'product_title' => $detail->product?->title ?? 'Produk',
                    'qty' => (int) $detail->qty,
                    'notes' => $this->buildItemNotes($detail),
                    'status' => 'pending',
                    'fired_at' => now(),
                ]);
            }

            $ticket->events()->create([
                'user_id' => $transaction->cashier_id,
                'event' => 'ticket.created',
                'payload' => [
                    'invoice' => $transaction->invoice,
                    'items_count' => $details->count(),
                ],
                'created_at' => now(),
            ]);

            $autoDispatchDevice = KitchenStationDevice::query()
                ->where('kitchen_station_id', (int) $stationId)
                ->where('device_type', 'printer')
                ->where('is_active', true)
                ->orderByDesc('is_primary')
                ->orderBy('name')
                ->get()
                ->first(fn (KitchenStationDevice $device) => data_get($device->meta, 'dispatch_mode', 'manual') === 'auto');

            if ($autoDispatchDevice) {
                $printJob = $this->printJobService->queueKitchenTicket($ticket, $autoDispatchDevice, $transaction->cashier_id);

                $ticket->events()->create([
                    'user_id' => $transaction->cashier_id,
                    'event' => 'ticket.dispatch_queued',
                    'payload' => [
                        'station_id' => $ticket->kitchen_station_id,
                        'device_id' => $autoDispatchDevice->id,
                        'device_name' => $autoDispatchDevice->name,
                        'device_type' => $autoDispatchDevice->device_type,
                        'connection_driver' => $autoDispatchDevice->connection_driver,
                        'endpoint' => $autoDispatchDevice->endpoint,
                        'print_job_id' => $printJob->id,
                        'print_job_status' => $printJob->status,
                        'queued_by' => 'system_auto_dispatch',
                    ],
                    'created_at' => now(),
                ]);
            }

            $tickets->push($ticket->load(['items', 'kitchenStation']));
        }

        return $tickets;
    }

    private function generateTicketNumber(Transaction $transaction, int $stationId): string
    {
        $station = KitchenStation::query()->find($stationId);
        $stationCode = strtoupper(trim((string) ($station?->code ?: "DPR{$stationId}")));
        $stationCode = preg_replace('/[^A-Z0-9]/', '', $stationCode) ?: "DPR{$stationId}";
        $now = Carbon::now();
        $date = $now->format('dmy');
        $prefix = "{$stationCode}-{$date}";

        $latestTodayTicket = KitchenTicket::query()
            ->where('kitchen_station_id', $stationId)
            ->whereBetween('created_at', [$now->copy()->startOfDay(), $now->copy()->endOfDay()])
            ->where('ticket_number', 'like', $prefix.'%')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->value('ticket_number');

        $sequence = 1;

        if ($latestTodayTicket && preg_match('/(\d{3})$/', $latestTodayTicket, $matches)) {
            $sequence = ((int) $matches[1]) + 1;
            if ($sequence > 999) {
                $sequence = 1;
            }
        }

        $maxAttempts = 100;
        $attempt = 0;

        do {
            $ticketNumber = sprintf('%s%03d', $prefix, $sequence);
            $sequence++;
            $attempt++;
        } while (
            $attempt < $maxAttempts
            && KitchenTicket::query()
                ->where('ticket_number', $ticketNumber)
                ->exists()
        );

        return $ticketNumber;
    }

    private function createLockedTicket(Transaction $transaction, int $stationId, string $sourceChannel): KitchenTicket
    {
        $date = Carbon::now()->format('dmy');
        $lockKey = sprintf('kitchen-ticket:%d:%d:%s', (int) $transaction->id, $stationId, $date);

        // Use the station's outlet_id, not the transaction's outlet_id.
        // In a foodcourt setup, the transaction belongs to the main outlet
        // but the kitchen station belongs to a tenant outlet. The display
        // query in KitchenDisplayController::ticketPayloads() filters by
        // $station->outlet_id, so the ticket must match the station's outlet.
        $station = KitchenStation::query()->find($stationId);
        $outletId = $station?->outlet_id ?? $transaction->outlet_id;

        try {
            return Cache::lock($lockKey, 10)->block(5, function () use ($transaction, $stationId, $sourceChannel, $outletId) {
                return KitchenTicket::query()->firstOrCreate([
                    'transaction_id' => $transaction->id,
                    'kitchen_station_id' => $stationId,
                ], [
                    'outlet_id' => $outletId,
                    'cashier_shift_id' => $transaction->cashier_shift_id,
                    'ticket_number' => $this->generateTicketNumber($transaction, $stationId),
                    'source_channel' => $sourceChannel,
                    'status' => 'pending',
                    'fired_at' => now(),
                ]);
            });
        } catch (\Throwable) {
            return KitchenTicket::query()->firstOrCreate([
                'transaction_id' => $transaction->id,
                'kitchen_station_id' => $stationId,
            ], [
                'outlet_id' => $outletId,
                'cashier_shift_id' => $transaction->cashier_shift_id,
                'ticket_number' => $this->generateTicketNumber($transaction, $stationId),
                'source_channel' => $sourceChannel,
                'status' => 'pending',
                'fired_at' => now(),
            ]);
        }
    }

    private function buildItemNotes(TransactionDetail $detail): ?string
    {
        $parts = [];

        if (filled($detail->notes)) {
            $parts[] = trim((string) $detail->notes);
        }

        $modifierSummary = $detail->modifiers
            ->map(function ($modifier) {
                $qty = max(1, (int) $modifier->qty);

                return $qty > 1
                    ? "{$modifier->name} x{$qty}"
                    : (string) $modifier->name;
            })
            ->filter()
            ->values();

        if ($modifierSummary->isNotEmpty()) {
            $parts[] = 'Tambahan: '.$modifierSummary->implode(', ');
        }

        return empty($parts) ? null : implode(' | ', $parts);
    }
}
