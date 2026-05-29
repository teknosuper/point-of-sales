<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KitchenStationDevice;
use App\Models\PrintJob;
use App\Services\PrintJobService;
use App\Services\ReceiptLayoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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
        private readonly PrintJobService $printJobService,
        private readonly ReceiptLayoutService $receiptLayoutService
    ) {}

    /**
     * GET /api/print-queue/cashier
     *
     * Poll for queued cashier receipt jobs.
     */
    public function cashier(Request $request): JsonResponse
    {
        $this->authorize($request);

        $outletId = (int) $request->query('outlet_id', 0);
        $deviceId = (int) $request->query('device_id', 0);

        if ($outletId <= 0) {
            return response()->json([
                'success' => true,
                'jobs' => [],
                'count' => 0,
            ]);
        }

        $jobs = $this->printJobService->claimQueuedReceiptJobs(
            $outletId,
            $deviceId > 0 ? $deviceId : null,
            5
        );

        if ($jobs->isEmpty()) {
            return response()->json([
                'success' => true,
                'jobs' => [],
                'count' => 0,
            ]);
        }

        return response()->json([
            'success' => true,
            'jobs' => $jobs->map(fn (PrintJob $job) => $this->receiptPayload($job))->values(),
            'count' => $jobs->count(),
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
        $paymentMethod = strtolower((string) ($transaction?->payment_method ?? 'cash'));
        $promoDiscount = (int) ($transaction?->details?->sum('discount_total') ?? 0);
        $manualDiscount = (int) ($transaction->discount ?? 0);
        $voucherDiscount = (int) ($transaction->customer_voucher_discount ?? 0);
        $loyaltyDiscount = (int) ($transaction->loyalty_discount_total ?? 0);
        $shippingCost = (int) ($transaction->shipping_cost ?? 0);
        $grandTotal = (int) ($transaction->grand_total ?? 0);
        $subtotal = $grandTotal + $manualDiscount - $shippingCost + $promoDiscount + $voucherDiscount + $loyaltyDiscount;
        $paidAmount = $paymentMethod === 'cash'
            ? (int) ($transaction->cash ?? 0)
            : max((int) ($transaction->cash ?? 0), $grandTotal);
        $layout = $transaction
            ? $this->receiptLayoutService->build(
                $transaction,
                [
                    'name' => $storeProfile['name'] ?? '',
                    'address' => $storeProfile['address'] ?? '',
                    'phone' => $storeProfile['phone'] ?? '',
                ],
                (string) data_get($job->payload, 'paper_width', '58mm')
            )
            : null;

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
            'layout' => $layout,
            'transaction' => $transaction ? [
                'invoice' => $transaction->invoice,
                'date' => $transaction->created_at ? \Carbon\Carbon::parse($transaction->created_at)->format('d/m/Y H:i') : null,
                'cashier' => $transaction->cashier?->name ?? '-',
                'customer' => $transaction->customer?->name ?? 'Pelanggan Umum',
                'order_type' => $transaction->order_type,
                'payment_method' => $transaction->payment_method,
                'payment_method_label' => $this->paymentMethodLabel($transaction),
                'payment_status' => $transaction->payment_status,
                'payment_reference' => $transaction->payment_reference,
                'payment_summary' => $this->paymentSummary($transaction),
                'table' => $transaction->diningTable?->name ?? $transaction->diningTable?->code ?? null,
                'subtotal' => $subtotal,
                'promo_discount_total' => $promoDiscount,
                'discount' => $manualDiscount,
                'voucher_discount_total' => $voucherDiscount,
                'loyalty_discount_total' => $loyaltyDiscount,
                'shipping_cost' => $shippingCost,
                'grand_total' => $grandTotal,
                'cash' => (int) ($transaction->cash ?? 0),
                'change' => (int) ($transaction->change ?? 0),
                'paid_amount' => $paidAmount,
                'bank_account' => $transaction->bankAccount ? [
                    'bank_name' => $transaction->bankAccount->bank_name,
                    'account_number' => $transaction->bankAccount->account_number,
                    'account_name' => $transaction->bankAccount->account_name,
                ] : null,
                'items' => $transaction->details->map(function ($detail) {
                    $qty = max(1, (int) $detail->qty);
                    $lineTotal = (int) ($detail->price ?? 0);
                    $modifierTotal = (int) $detail->modifiers->sum('total_price');
                    $baseLineTotal = max(0, $lineTotal - $modifierTotal);
                    $unitPrice = (int) ($detail->unit_price ?: ($qty ? $baseLineTotal / $qty : $baseLineTotal));
                    $baseUnitPrice = (int) ($detail->base_unit_price ?: $unitPrice);

                    return [
                        'name' => $detail->product?->title ?? 'Item',
                        'qty' => $qty,
                        'price' => $unitPrice,
                        'base_unit_price' => $baseUnitPrice,
                        'base_total' => $baseUnitPrice * $qty,
                        'total' => $lineTotal,
                        'line_total' => $baseLineTotal,
                        'modifier_total' => $modifierTotal,
                        'discount' => (int) ($detail->discount_total ?? 0),
                        'promo_label' => $detail->pricing_group_label ?: $detail->pricing_rule_name,
                        'promo_kind' => $detail->pricing_rule_kind,
                        'promo_kind_label' => $this->promoKindLabel($detail->pricing_rule_kind),
                        'promo_summary' => $this->promoSummary($detail),
                        'notes' => $detail->notes,
                        'modifiers' => $detail->modifiers->map(fn ($mod) => [
                            'name' => $mod->name,
                            'qty' => (int) ($mod->qty ?? 1),
                            'price' => (int) ($mod->unit_price ?? 0),
                            'total' => (int) ($mod->total_price ?? (($mod->unit_price ?? 0) * ($mod->qty ?? 1))),
                        ])->values()->all(),
                    ];
                })->values()->all(),
            ] : null,
            'queued_at' => $job->queued_at?->toIso8601String(),
        ];
    }

    private function paymentMethodLabel($transaction): string
    {
        $method = strtolower((string) ($transaction?->payment_method ?? 'cash'));

        return match ($method) {
            'cash' => 'Tunai',
            'bank_transfer' => 'Transfer Bank',
            'midtrans' => 'Midtrans',
            'xendit' => 'Xendit',
            'pay_later' => 'Piutang',
            default => Str::headline(str_replace('_', ' ', $method)),
        };
    }

    private function paymentSummary($transaction): ?string
    {
        if (! $transaction) {
            return null;
        }

        $method = strtolower((string) ($transaction->payment_method ?? 'cash'));

        return match ($method) {
            'bank_transfer' => trim(implode(' • ', array_filter([
                $transaction->bankAccount?->bank_name,
                $transaction->bankAccount?->account_number,
            ]))),
            'midtrans', 'xendit' => $transaction->payment_reference ?: null,
            'pay_later' => 'Pembayaran dicatat sebagai piutang',
            default => null,
        };
    }

    private function promoKindLabel(?string $kind): ?string
    {
        return match ($kind) {
            'standard_discount' => 'Promo Harga Spesial',
            'qty_break' => 'Promo Belanja Lebih Untung',
            'bundle_price' => 'Promo Paket Hemat',
            'buy_x_get_y' => 'Promo Buy Get',
            default => null,
        };
    }

    private function promoSummary($detail): ?string
    {
        if ((bool) ($detail->is_promo_reward ?? false)) {
            return implode(' • ', array_filter([
                'Item Bonus Promo',
                $detail->promo_reward_rule_name ?? null,
            ]));
        }

        $discount = (int) ($detail->discount_total ?? 0);
        if ($discount <= 0) {
            return null;
        }

        $baseUnitPrice = (int) ($detail->base_unit_price ?? 0);
        $unitPrice = (int) ($detail->unit_price ?? 0);
        $label = $detail->pricing_group_label ?: $detail->pricing_rule_name ?: 'Promo';
        $kindLabel = $this->promoKindLabel($detail->pricing_rule_kind);
        $qty = max(1, (int) ($detail->qty ?? 1));
        $headline = match ($detail->pricing_rule_kind) {
            'qty_break' => sprintf('Beli %d+ lebih hemat', $qty),
            'bundle_price' => 'Ambil paket, harga lebih hemat',
            'buy_x_get_y' => 'Benefit buy-get diterapkan pada item ini',
            default => null,
        };
        $priceSnippet = null;

        if ($baseUnitPrice > 0 && $unitPrice > 0 && $baseUnitPrice > $unitPrice) {
            $priceSnippet = sprintf(
                'dari Rp%s jadi Rp%s',
                number_format($baseUnitPrice, 0, ',', '.'),
                number_format($unitPrice, 0, ',', '.')
            );
        }

        return trim(implode(' • ', array_filter([$kindLabel, $headline, $label, $priceSnippet])));
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
