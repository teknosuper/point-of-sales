<?php

namespace App\Services;

use App\Models\KitchenStationDevice;
use App\Models\KitchenTicket;
use App\Models\ProductKitchenStationMapping;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class KitchenTicketService
{
    public function __construct(
        private readonly PrintJobService $printJobService
    ) {}

    public function createForTransaction(Transaction $transaction): Collection
    {
        $transaction->loadMissing([
            'details.product.kitchenStationMappings.kitchenStation',
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
            $ticket = KitchenTicket::create([
                'outlet_id' => $transaction->outlet_id,
                'transaction_id' => $transaction->id,
                'cashier_shift_id' => $transaction->cashier_shift_id,
                'kitchen_station_id' => (int) $stationId,
                'ticket_number' => $this->generateTicketNumber($transaction, (int) $stationId),
                'source_channel' => 'pos',
                'status' => 'pending',
                'fired_at' => now(),
            ]);

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
                ->first(function (KitchenStationDevice $device) {
                    return data_get($device->meta, 'dispatch_mode', 'manual') === 'auto';
                });

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
        return Str::upper(sprintf(
            'KT-%s-%s-%s',
            $transaction->outlet_id,
            $stationId,
            Str::random(8)
        ));
    }
}
