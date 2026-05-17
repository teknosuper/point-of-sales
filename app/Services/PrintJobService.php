<?php

namespace App\Services;

use App\Models\KitchenStationDevice;
use App\Models\KitchenTicket;
use App\Models\PrintJob;
use App\Models\Transaction;
use Illuminate\Support\Collection;

class PrintJobService
{
    public function queueReceipt(Transaction $transaction, ?KitchenStationDevice $device = null, ?int $userId = null): PrintJob
    {
        $receiptDevice = $device ?? $this->resolveReceiptDevice($transaction->outlet_id);

        return PrintJob::create([
            'outlet_id' => $transaction->outlet_id,
            'transaction_id' => $transaction->id,
            'kitchen_ticket_id' => null,
            'kitchen_station_device_id' => $receiptDevice?->id,
            'job_type' => PrintJob::TYPE_RECEIPT,
            'status' => PrintJob::STATUS_QUEUED,
            'copies' => $receiptDevice ? (int) (data_get($receiptDevice->meta, 'print_copies', 1)) : 1,
            'payload' => [
                'invoice' => $transaction->invoice,
                'device_name' => $receiptDevice?->name,
                'device_type' => $receiptDevice?->device_type,
                'paper_width' => $receiptDevice ? data_get($receiptDevice->meta, 'paper_width', '58mm') : '58mm',
            ],
            'queued_at' => now(),
            'created_by' => $userId,
        ]);
    }

    private function resolveReceiptDevice(int $outletId): ?KitchenStationDevice
    {
        return KitchenStationDevice::query()
            ->whereHas('kitchenStation', fn ($q) => $q->where('outlet_id', $outletId))
            ->where('is_active', true)
            ->where('device_type', 'receipt_printer')
            ->first();
    }

    public function queueKitchenTicket(KitchenTicket $ticket, KitchenStationDevice $device, ?int $userId = null): PrintJob
    {
        return PrintJob::create([
            'outlet_id' => $ticket->outlet_id,
            'transaction_id' => $ticket->transaction_id,
            'kitchen_ticket_id' => $ticket->id,
            'kitchen_station_device_id' => $device->id,
            'job_type' => PrintJob::TYPE_KITCHEN_TICKET,
            'status' => PrintJob::STATUS_QUEUED,
            'copies' => (int) (($device->meta ?? [])['print_copies'] ?? 1),
            'payload' => [
                'ticket_number' => $ticket->ticket_number,
                'device_name' => $device->name,
                'device_type' => $device->device_type,
                'connection_driver' => $device->connection_driver,
                'endpoint' => $device->endpoint,
                'print_profile' => data_get($device->meta, 'print_profile'),
                'paper_width' => data_get($device->meta, 'paper_width'),
                'template_style' => data_get($device->meta, 'template_style'),
                'dispatch_mode' => data_get($device->meta, 'dispatch_mode'),
                'fallback_device_id' => data_get($device->meta, 'fallback_device_id'),
                'rawbt_intent_url' => data_get($device->meta, 'rawbt_intent_url'),
                'qz_printer_name' => data_get($device->meta, 'qz_printer_name'),
                'bridge_device_key' => data_get($device->meta, 'bridge_device_key'),
            ],
            'queued_at' => now(),
            'created_by' => $userId,
        ]);
    }

    public function markSuccess(PrintJob $printJob): PrintJob
    {
        $printJob->forceFill([
            'status' => PrintJob::STATUS_SUCCESS,
            'processing_at' => $printJob->processing_at ?? now(),
            'processed_at' => now(),
            'failed_at' => null,
            'failure_reason' => null,
        ])->save();

        return $printJob->fresh();
    }

    public function markProcessing(PrintJob $printJob): PrintJob
    {
        $printJob->forceFill([
            'status' => PrintJob::STATUS_PROCESSING,
            'processing_at' => $printJob->processing_at ?? now(),
            'failed_at' => null,
            'failure_reason' => null,
        ])->save();

        return $printJob->fresh();
    }

    public function markFailed(PrintJob $printJob, ?string $reason = null): PrintJob
    {
        $printJob->forceFill([
            'status' => PrintJob::STATUS_FAILED,
            'processing_at' => $printJob->processing_at ?? now(),
            'failed_at' => now(),
            'failure_reason' => $reason ?: 'Print job gagal diproses.',
        ])->save();

        return $printJob->fresh();
    }

    public function latestQueuedKitchenTicketJob(int $ticketId, int $deviceId): ?PrintJob
    {
        return PrintJob::query()
            ->where('kitchen_ticket_id', $ticketId)
            ->where('kitchen_station_device_id', $deviceId)
            ->where('job_type', PrintJob::TYPE_KITCHEN_TICKET)
            ->where('status', PrintJob::STATUS_QUEUED)
            ->latest('queued_at')
            ->first();
    }

    public function claimQueuedJobsForDevice(KitchenStationDevice $device, int $limit = 10): Collection
    {
        $jobs = PrintJob::query()
            ->with([
                'transaction:id,invoice,customer_name,customer_phone,customer_address',
                'kitchenTicket.items:id,kitchen_ticket_id,product_name,qty,notes',
                'kitchenTicket.station:id,name,slug,code',
                'device:id,kitchen_station_id,name,device_type,connection_driver,endpoint,meta',
            ])
            ->where('kitchen_station_device_id', $device->id)
            ->where('status', PrintJob::STATUS_QUEUED)
            ->orderBy('queued_at')
            ->limit(max(1, min($limit, 20)))
            ->get();

        return $jobs->map(function (PrintJob $job) {
            return $this->markProcessing($job);
        });
    }
}
