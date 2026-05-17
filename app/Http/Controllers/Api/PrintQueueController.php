<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KitchenStationDevice;
use App\Models\PrintJob;
use App\Models\Transaction;
use App\Services\PrintJobService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Simplified print queue endpoints for ESC/POS Web Direct integration.
 *
 * These endpoints are designed to be polled by external print clients
 * (e.g. https://esc-pos-web-direct.lovable.app/) that need a URL to
 * fetch pending print jobs.
 *
 * Authentication: X-Print-Bridge-Token header or ?token= query param.
 */
class PrintQueueController extends Controller
{
    public function __construct(
        private readonly PrintJobService $printJobService
    ) {}

    /**
     * GET /api/print-queue/cashier
     *
     * Poll for new transactions that need receipt printing.
     * Uses transactions table directly — no print_jobs insert needed at checkout.
     */
    public function cashier(Request $request): JsonResponse
    {
        $this->authorize($request);

        $outletId = (int) $request->query('outlet_id', 0);
        $lastId = (int) $request->query('last_id', 0);

        $query = Transaction::query()
            ->with([
                'details:id,transaction_id,product_id,qty,price,unit_price,discount_total,notes',
                'details.product:id,title',
                'details.modifiers:id,transaction_detail_id,name,unit_price',
                'cashier:id,name',
                'customer:id,name,no_telp',
                'diningTable:id,name,code',
            ])
            ->when($outletId > 0, fn ($q) => $q->where('outlet_id', $outletId))
            ->where('payment_status', 'paid')
            ->when($lastId > 0, fn ($q) => $q->where('id', '>', $lastId))
            ->orderBy('id')
            ->limit(5);

        $transactions = $query->get();

        if ($transactions->isEmpty()) {
            return response()->json([
                'success' => true,
                'jobs' => [],
                'count' => 0,
                'last_id' => $lastId,
            ]);
        }

        $outletProfile = $outletId > 0 ? \App\Models\Outlet::find($outletId)?->profilePayload() : [];

        $jobs = $transactions->map(fn (Transaction $tx) => [
            'id' => $tx->id,
            'type' => 'receipt',
            'copies' => 1,
            'paper_width' => '58mm',
            'store' => [
                'name' => $outletProfile['name'] ?? '',
                'address' => $outletProfile['address'] ?? '',
                'phone' => $outletProfile['phone'] ?? '',
            ],
            'transaction' => [
                'invoice' => $tx->invoice,
                'date' => $tx->created_at ? \Carbon\Carbon::parse($tx->created_at)->format('d/m/Y H:i') : null,
                'cashier' => $tx->cashier?->name ?? '-',
                'customer' => $tx->customer?->name ?? 'Pelanggan Umum',
                'order_type' => $tx->order_type,
                'payment_method' => $tx->payment_method,
                'table' => $tx->diningTable?->name ?? $tx->diningTable?->code ?? null,
                'subtotal' => (int) ($tx->grand_total + ($tx->discount ?? 0)),
                'discount' => (int) ($tx->discount ?? 0),
                'grand_total' => (int) $tx->grand_total,
                'items' => $tx->details->map(fn ($detail) => [
                    'name' => $detail->product?->title ?? 'Item',
                    'qty' => (int) $detail->qty,
                    'price' => (int) $detail->unit_price,
                    'total' => (int) $detail->price,
                    'discount' => (int) ($detail->discount_total ?? 0),
                    'notes' => $detail->notes,
                    'modifiers' => $detail->modifiers->map(fn ($mod) => [
                        'name' => $mod->name,
                        'price' => (int) $mod->unit_price,
                    ])->values()->all(),
                ])->values()->all(),
            ],
            'queued_at' => $tx->created_at ? \Carbon\Carbon::parse($tx->created_at)->toIso8601String() : null,
        ]);

        return response()->json([
            'success' => true,
            'jobs' => $jobs->values(),
            'count' => $jobs->count(),
            'last_id' => $transactions->last()->id,
        ]);
    }

    /**
     * GET /api/print-queue/kitchen
     *
     * Poll for pending kitchen ticket print jobs.
     * Returns queued kitchen ticket jobs for the given device or outlet.
     */
    public function kitchen(Request $request): JsonResponse
    {
        $this->authorize($request);

        $outletId = (int) $request->query('outlet_id', 0);
        $deviceId = (int) $request->query('device_id', 0);
        $stationId = (int) $request->query('station_id', 0);

        $query = PrintJob::query()
            ->with([
                'transaction:id,invoice,order_type,customer_id,created_at',
                'transaction.customer:id,name',
                'kitchenTicket:id,kitchen_station_id,transaction_id,ticket_number,status,notes,created_at',
                'kitchenTicket.items:id,kitchen_ticket_id,product_title,qty,notes',
                'kitchenTicket.kitchenStation:id,name,slug,code',
                'device:id,name,device_type,connection_driver,endpoint,meta',
            ])
            ->where('job_type', PrintJob::TYPE_KITCHEN_TICKET)
            ->whereIn('status', [PrintJob::STATUS_QUEUED, PrintJob::STATUS_PROCESSING])
            ->when($outletId > 0, fn ($q) => $q->where('outlet_id', $outletId))
            ->when($deviceId > 0, fn ($q) => $q->where('kitchen_station_device_id', $deviceId))
            ->when($stationId > 0, fn ($q) => $q->whereHas('kitchenTicket', fn ($sub) => $sub->where('kitchen_station_id', $stationId)))
            ->orderBy('queued_at')
            ->limit(10);

        $jobs = $query->get();

        if ($jobs->isEmpty()) {
            return response()->json([
                'success' => true,
                'jobs' => [],
                'count' => 0,
            ]);
        }

        return response()->json([
            'success' => true,
            'jobs' => $jobs->map(fn (PrintJob $job) => $this->kitchenPayload($job))->values(),
            'count' => $jobs->count(),
        ]);
    }

    /**
     * POST /api/print-queue/done/{printJob}
     *
     * Mark a print job as successfully printed.
     */
    public function done(Request $request, PrintJob $printJob): JsonResponse
    {
        $this->authorize($request);

        $this->printJobService->markSuccess($printJob);

        return response()->json(['success' => true, 'message' => 'Print job selesai.']);
    }

    /**
     * POST /api/print-queue/fail/{printJob}
     *
     * Mark a print job as failed.
     */
    public function fail(Request $request, PrintJob $printJob): JsonResponse
    {
        $this->authorize($request);

        $reason = $request->input('reason', 'Gagal dicetak oleh client.');
        $this->printJobService->markFailed($printJob, $reason);

        return response()->json(['success' => true, 'message' => 'Print job ditandai gagal.']);
    }

    /**
     * GET /api/print-queue/status
     *
     * Health check and queue status overview.
     */
    public function status(Request $request): JsonResponse
    {
        $this->authorize($request);

        $outletId = (int) $request->query('outlet_id', 0);

        $baseQuery = PrintJob::query()
            ->when($outletId > 0, fn ($q) => $q->where('outlet_id', $outletId));

        $queuedReceipts = (clone $baseQuery)->where('job_type', PrintJob::TYPE_RECEIPT)->whereIn('status', [PrintJob::STATUS_QUEUED, PrintJob::STATUS_PROCESSING])->count();
        $queuedKitchen = (clone $baseQuery)->where('job_type', PrintJob::TYPE_KITCHEN_TICKET)->whereIn('status', [PrintJob::STATUS_QUEUED, PrintJob::STATUS_PROCESSING])->count();
        $processingCount = (clone $baseQuery)->where('status', PrintJob::STATUS_PROCESSING)->count();

        return response()->json([
            'success' => true,
            'queue' => [
                'receipts_pending' => $queuedReceipts,
                'kitchen_pending' => $queuedKitchen,
                'processing' => $processingCount,
                'total_pending' => $queuedReceipts + $queuedKitchen,
            ],
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    private function authorize(Request $request): void
    {
        $token = (string) config('services.print_bridge.token');
        $provided = (string) ($request->header('X-Print-Bridge-Token') ?: $request->query('token', ''));

        abort_if(blank($token), 503, 'Print bridge token belum dikonfigurasi.');
        abort_if(blank($provided) || ! hash_equals($token, $provided), 403, 'Token tidak valid.');
    }

    private function receiptPayload(PrintJob $job): array
    {
        $transaction = $job->transaction;
        $outlet = \App\Models\Outlet::find($job->outlet_id);
        $storeProfile = $outlet?->profilePayload() ?? [];

        return [
            'id' => $job->id,
            'type' => 'receipt',
            'copies' => $job->copies ?: 1,
            'paper_width' => data_get($job->payload, 'paper_width', '58mm'),
            'store' => [
                'name' => $storeProfile['name'] ?? '',
                'address' => $storeProfile['address'] ?? '',
                'phone' => $storeProfile['phone'] ?? '',
            ],
            'transaction' => $transaction ? [
                'invoice' => $transaction->invoice,
                'date' => $transaction->created_at ? \Carbon\Carbon::parse($transaction->created_at)->format('d/m/Y H:i') : null,
                'cashier' => $transaction->cashier?->name ?? '-',
                'customer' => $transaction->customer?->name ?? 'Pelanggan Umum',
                'order_type' => $transaction->order_type,
                'payment_method' => $transaction->payment_method,
                'table' => $transaction->diningTable?->name ?? $transaction->diningTable?->code ?? null,
                'subtotal' => (int) ($transaction->grand_total + ($transaction->discount ?? 0)),
                'discount' => (int) ($transaction->discount ?? 0),
                'grand_total' => (int) $transaction->grand_total,
                'items' => $transaction->details->map(fn ($detail) => [
                    'name' => $detail->product?->title ?? 'Item',
                    'qty' => (int) $detail->qty,
                    'price' => (int) $detail->unit_price,
                    'total' => (int) $detail->price,
                    'discount' => (int) ($detail->discount_total ?? 0),
                    'notes' => $detail->notes,
                    'modifiers' => $detail->modifiers->map(fn ($mod) => [
                        'name' => $mod->name,
                        'price' => (int) $mod->unit_price,
                    ])->values()->all(),
                ])->values()->all(),
            ] : null,
            'queued_at' => $job->queued_at?->toIso8601String(),
        ];
    }

    private function kitchenPayload(PrintJob $job): array
    {
        $ticket = $job->kitchenTicket;
        $transaction = $job->transaction;

        return [
            'id' => $job->id,
            'type' => 'kitchen_ticket',
            'copies' => $job->copies ?: 1,
            'paper_width' => data_get($job->payload, 'paper_width', '80mm'),
            'station' => $ticket?->kitchenStation ? [
                'name' => $ticket->kitchenStation->name,
                'code' => $ticket->kitchenStation->code,
            ] : null,
            'ticket' => $ticket ? [
                'number' => $ticket->ticket_number,
                'notes' => $ticket->notes,
                'created_at' => $ticket->created_at ? \Carbon\Carbon::parse($ticket->created_at)->format('d/m/Y H:i') : null,
                'items' => $ticket->items->map(fn ($item) => [
                    'name' => $item->product_title,
                    'qty' => (float) $item->qty,
                    'notes' => $item->notes,
                ])->values()->all(),
            ] : null,
            'transaction' => $transaction ? [
                'invoice' => $transaction->invoice,
                'order_type' => $transaction->order_type,
                'customer' => $transaction->customer?->name ?? 'Pelanggan Umum',
                'date' => $transaction->created_at ? \Carbon\Carbon::parse($transaction->created_at)->format('d/m/Y H:i') : null,
            ] : null,
            'queued_at' => $job->queued_at?->toIso8601String(),
        ];
    }
}
