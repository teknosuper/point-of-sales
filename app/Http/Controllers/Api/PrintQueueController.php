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
                'transaction:id,invoice,order_type,customer_id,table_id,created_at',
                'transaction.customer:id,name',
                'transaction.diningTable:id,name,code',
                'kitchenTicket:id,kitchen_station_id,transaction_id,ticket_number,status,notes,created_at',
                'kitchenTicket.items:id,kitchen_ticket_id,product_title,qty,notes',
                'kitchenTicket.kitchenStation:id,name,slug,code',
                'device:id,name,device_type,connection_driver,endpoint,meta',
            ])
            ->where('job_type', PrintJob::TYPE_KITCHEN_TICKET)
            ->whereIn('status', [PrintJob::STATUS_QUEUED, PrintJob::STATUS_PROCESSING])
            ->when(
                $outletId > 0 && $stationId <= 0,
                fn ($q) => $q->where('outlet_id', $outletId)
            )
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
        $paperWidth = data_get($job->payload, 'paper_width');
        $layout = $transaction
            ? $this->receiptLayoutService->build(
                $transaction,
                [
                    'name' => $storeProfile['name'] ?? '',
                    'address' => $storeProfile['address'] ?? '',
                    'phone' => $storeProfile['phone'] ?? '',
                ],
                $paperWidth === '80mm' ? '80mm' : '58mm'
            )
            : null;

        return [
            'id' => $job->id,
            'type' => 'receipt',
            'copies' => $job->copies ?: 1,
            'paper_width' => $paperWidth,
            'payload' => array_filter([
                'paper_width' => $paperWidth,
                'raw_base64' => $layout ? $this->encodeReceiptPayload($layout) : null,
            ]),
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
            'payload' => [
                'paper_width' => data_get($job->payload, 'paper_width', '80mm'),
                'raw_base64' => $this->encodeKitchenTicketPayload($job),
            ],
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
                'table' => $this->tableLabel(
                    $transaction->diningTable?->code,
                    $transaction->diningTable?->name
                ),
                'customer' => $transaction->customer?->name ?? 'Pelanggan Umum',
                'date' => $transaction->created_at ? \Carbon\Carbon::parse($transaction->created_at)->format('d/m/Y H:i') : null,
            ] : null,
            'queued_at' => $job->queued_at?->toIso8601String(),
        ];
    }

    private function tableLabel(?string $code, ?string $name): ?string
    {
        $code = filled($code) ? trim((string) $code) : null;
        $name = filled($name) ? trim((string) $name) : null;

        if ($code && $name && strcasecmp($code, $name) !== 0) {
            return "{$code} • {$name}";
        }

        return $code ?: $name;
    }

    private function encodeKitchenTicketPayload(PrintJob $job): string
    {
        $paperWidth = (string) (data_get($job->payload, 'paper_width', '80mm') ?: '80mm');
        $isCompact58 = strtolower($paperWidth) !== '80mm';
        $cols = $isCompact58 ? 32 : 48;
        $separator = str_repeat('=', $cols);
        $ticket = $job->kitchenTicket;
        $transaction = $job->transaction;
        $stationName = $ticket?->kitchenStation?->name ?? data_get($job->device?->meta, 'station_name') ?? 'KITCHEN ORDER';

        $chunks = ["\x1B\x40", "\x1B\x61\x01"];
        $chunks[] = $isCompact58 ? "\x1B\x4D\x01" : "\x1B\x4D\x00";
        $chunks[] = "\x1B\x45\x01";
        $this->appendWrappedLines($chunks, (string) $stationName, $cols);
        $chunks[] = "\x1B\x45\x00";

        if ($ticket?->ticket_number) {
            $chunks[] = "\x1B\x45\x01";
            $this->appendWrappedLines($chunks, '#'.$ticket->ticket_number, $cols);
            $chunks[] = "\x1B\x45\x00";
        }

        $this->appendLine($chunks, $separator);
        $chunks[] = "\x1B\x61\x00";

        if ($transaction?->invoice) {
            $this->appendWrappedLines($chunks, 'Invoice: '.$transaction->invoice, $cols);
        }

        $customerName = $transaction?->customer?->name ?: 'Pelanggan Umum';
        $this->appendWrappedLines($chunks, 'Customer: '.$customerName, $cols);

        if ($transaction?->created_at) {
            $this->appendWrappedLines(
                $chunks,
                'Waktu: '.\Carbon\Carbon::parse($transaction->created_at)->format('d/m/Y H:i'),
                $cols
            );
        }

        if ($transaction?->order_type) {
            $this->appendWrappedLines(
                $chunks,
                'Tipe: '.$this->humanizeKitchenOrderType((string) $transaction->order_type),
                $cols
            );
        }

        $tableLabel = $this->tableLabel(
            $transaction?->diningTable?->code,
            $transaction?->diningTable?->name
        );
        if ($tableLabel) {
            $this->appendWrappedLines($chunks, 'Meja: '.$tableLabel, $cols);
        }

        if ($ticket?->notes) {
            $this->appendWrappedLines($chunks, 'Catatan: '.$ticket->notes, $cols);
        }

        $this->appendLine($chunks, $separator);

        foreach (($ticket?->items ?? []) as $item) {
            $chunks[] = "\x1B\x45\x01";
            $this->appendWrappedLines(
                $chunks,
                sprintf('%sx %s', (int) ($item->qty ?? 0), (string) ($item->product_title ?? 'Item')),
                $cols
            );
            $chunks[] = "\x1B\x45\x00";

            if (! empty($item->notes)) {
                $this->appendWrappedLines($chunks, '>> '.(string) $item->notes, $cols, '   ');
            }
        }

        $chunks[] = "\n\n\n";
        $chunks[] = "\x1D\x56\x00";

        return base64_encode(implode('', $chunks));
    }

    private function humanizeKitchenOrderType(string $orderType): string
    {
        return match (strtolower($orderType)) {
            'dine_in' => 'Dine In',
            'take_away', 'takeaway' => 'Take Away',
            'delivery' => 'Delivery',
            default => Str::headline(str_replace('_', ' ', $orderType)),
        };
    }

    private function encodeReceiptPayload(array $layout): string
    {
        $isCompact58 = ($layout['paper_width'] ?? '58mm') !== '80mm';
        $cols = $isCompact58 ? 32 : 48;
        $separator = str_repeat('-', $cols);
        $chunks = ["\x1B\x40", "\x1B\x61\x01"];

        if ($isCompact58) {
            $chunks[] = "\x1B\x4D\x01";
        } else {
            $chunks[] = "\x1B\x4D\x00";
        }

        $store = $layout['store'] ?? [];
        $metaRows = $layout['meta_rows'] ?? [];
        $items = $layout['items'] ?? [];
        $totals = $layout['totals'] ?? [];
        $payments = $layout['payments'] ?? [];
        $footerLines = $layout['footer_lines'] ?? [];

        if (! empty($store['name'])) {
            $chunks[] = "\x1B\x45\x01";
            $this->appendWrappedLines($chunks, (string) $store['name'], $cols);
            $chunks[] = "\x1B\x45\x00";
        }

        $storeFields = $isCompact58
            ? ['phone', 'email', 'website']
            : ['address', 'phone', 'email', 'website'];

        foreach ($storeFields as $field) {
            if (! empty($store[$field])) {
                $this->appendWrappedLines($chunks, (string) $store[$field], $cols);
            }
        }

        $this->appendLine($chunks, $separator);
        $chunks[] = "\x1B\x61\x00";

        foreach ($metaRows as $row) {
            foreach ($this->twoColumnLines((string) ($row['label'] ?? ''), (string) ($row['value'] ?? ''), $cols) as $line) {
                $this->appendLine($chunks, $line);
            }
        }

        $this->appendLine($chunks, $separator);
        $this->appendLine($chunks, $this->receiptItemsHeaderLine($cols));

        foreach ($items as $item) {
            foreach ($this->receiptItemPrimaryLines($item, $cols) as $line) {
                $chunks[] = "\x1B\x45\x01";
                $this->appendLine($chunks, $line);
                $chunks[] = "\x1B\x45\x00";
            }

            if (! empty($item['promo'])) {
                $this->appendWrappedLines($chunks, (string) $item['promo'], $cols, '    ');
            }

            if (! empty($item['unit_note'])) {
                $this->appendWrappedLines($chunks, (string) $item['unit_note'], $cols, '    ');
            }

            foreach (($item['modifiers'] ?? []) as $modifier) {
                foreach ($this->twoColumnLines((string) ($modifier['label'] ?? ''), (string) ($modifier['value'] ?? ''), $cols) as $line) {
                    $this->appendLine($chunks, $line);
                }
            }

            if (! empty($item['notes'])) {
                $this->appendWrappedLines($chunks, '* '.(string) $item['notes'], $cols);
            }
        }

        $this->appendLine($chunks, $separator);

        foreach ($totals as $row) {
            $strong = (bool) ($row['strong'] ?? false);
            if ($strong) {
                $chunks[] = "\x1B\x45\x01";
            }

            foreach ($this->twoColumnLines((string) ($row['label'] ?? ''), (string) ($row['value'] ?? ''), $cols) as $line) {
                $this->appendLine($chunks, $line);
            }

            if ($strong) {
                $chunks[] = "\x1B\x45\x00";
            }
        }

        $this->appendLine($chunks, $separator);

        foreach ($payments as $row) {
            if (($row['label'] ?? '') === 'Info') {
                $this->appendWrappedLines($chunks, (string) ($row['value'] ?? ''), $cols, '  ');
                continue;
            }

            foreach ($this->twoColumnLines((string) ($row['label'] ?? ''), (string) ($row['value'] ?? ''), $cols) as $line) {
                $this->appendLine($chunks, $line);
            }
        }

        $this->appendLine($chunks, $separator);
        $chunks[] = "\x1B\x61\x01";

        if (! empty($footerLines[0])) {
            $this->appendWrappedLines($chunks, (string) $footerLines[0], $cols);
        }

        $invoice = ltrim((string) ($layout['footer_lines'][1] ?? ''), '#');
        if ($invoice !== '') {
            $chunks[] = "\x1D\x48\x00";
            $chunks[] = "\x1D\x77\x02";
            $chunks[] = "\x1D\x68\x50";
            $chunks[] = "\x1D\x6B\x04".$this->sanitizeReceiptContent($invoice)."\x00";
        }

        $chunks[] = "\n\n\n";
        $chunks[] = "\x1D\x56\x00";

        return base64_encode(implode('', $chunks));
    }

    private function appendLine(array &$chunks, string $text = ''): void
    {
        $chunks[] = $this->sanitizeReceiptLine($text)."\n";
    }

    private function appendWrappedLines(array &$chunks, string $text, int $width, string $prefix = ''): void
    {
        foreach ($this->wrapText($text, max(1, $width - strlen($prefix))) as $line) {
            $this->appendLine($chunks, $prefix.$line);
        }
    }

    private function wrapText(string $text, int $width): array
    {
        $text = $this->sanitizeReceiptContent($text);
        if ($text === '') {
            return [];
        }

        $words = preg_split('/\s+/', $text) ?: [];
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            if ($word === '') {
                continue;
            }

            if (strlen($word) > $width) {
                if ($current !== '') {
                    $lines[] = $current;
                    $current = '';
                }

                foreach (str_split($word, $width) as $segment) {
                    $lines[] = $segment;
                }

                continue;
            }

            $candidate = $current === '' ? $word : $current.' '.$word;
            if (strlen($candidate) <= $width) {
                $current = $candidate;
                continue;
            }

            $lines[] = $current;
            $current = $word;
        }

        if ($current !== '') {
            $lines[] = $current;
        }

        return $lines;
    }

    private function twoColumnLines(string $left, string $right, int $cols): array
    {
        $left = $this->sanitizeReceiptContent($left);
        $right = $this->sanitizeReceiptContent($right);

        if ($right === '') {
            return $this->wrapText($left, $cols);
        }

        $rightWidth = min(strlen($right), max(8, intdiv($cols, 2)));
        $leftWidth = max(1, $cols - $rightWidth - 1);
        $leftLines = $this->wrapText($left, $leftWidth);

        if ($leftLines === []) {
            $leftLines = [''];
        }

        $lines = [];
        $lastIndex = count($leftLines) - 1;

        foreach ($leftLines as $index => $line) {
            if ($index === $lastIndex) {
                $spaces = max(1, $cols - strlen($line) - strlen($right));
                $lines[] = $line.str_repeat(' ', $spaces).$right;
                continue;
            }

            $lines[] = $line;
        }

        return $lines;
    }

    private function receiptItemsHeaderLine(int $cols): string
    {
        return $this->receiptPrimaryLine('Qty', 'Item', 'Total', $cols, 3, 5);
    }

    private function receiptItemPrimaryLines(array $item, int $cols): array
    {
        $name = (string) ($item['name'] ?? 'Item');
        $qty = sprintf('%sx', max(1, (int) ($item['qty'] ?? 1)));
        $total = (string) (($item['line_total_label'] ?? $item['detail_right'] ?? '0'));

        return $this->wrapReceiptPrimaryLine($qty, $name, $total, $cols);
    }

    private function wrapReceiptPrimaryLine(string $qty, string $name, string $total, int $cols): array
    {
        $qty = $this->sanitizeReceiptContent($qty);
        $name = $this->sanitizeReceiptContent($name);
        $total = $this->sanitizeReceiptContent($total);

        if ($name === '') {
            return [];
        }

        $qtyWidth = 3;
        $totalWidth = min(max(strlen($total), 5), 6);
        $nameWidth = max(8, $cols - $qtyWidth - $totalWidth - 2);
        $nameLines = $this->wrapText($name, $nameWidth);
        $lines = [];

        foreach ($nameLines as $index => $line) {
            if ($index === 0) {
                $lines[] = $this->receiptPrimaryLine($qty, $line, $total, $cols, $qtyWidth, $totalWidth, $nameWidth);
                continue;
            }

            $lines[] = str_repeat(' ', $qtyWidth + 1).$line;
        }

        return $lines;
    }

    private function receiptPrimaryLine(
        string $qty,
        string $name,
        string $total,
        int $cols,
        int $qtyWidth = 4,
        ?int $totalWidth = null,
        ?int $nameWidth = null
    ): string {
        $qty = $this->sanitizeReceiptContent($qty);
        $name = $this->sanitizeReceiptContent($name);
        $total = $this->sanitizeReceiptContent($total);
        $totalWidth ??= min(max(strlen($total), 5), 8);
        $nameWidth ??= max(8, $cols - $qtyWidth - $totalWidth - 2);

        return str_pad($qty, $qtyWidth)
            .' '
            .str_pad(substr($name, 0, $nameWidth), $nameWidth)
            .' '
            .str_pad($total, $totalWidth, ' ', STR_PAD_LEFT);
    }

    private function sanitizeReceiptContent(string $text): string
    {
        $text = str_replace(
            ["\r\n", "\r", '•', '→', '–', '—', "\t"],
            ["\n", "\n", '-', '->', '-', '-', ' '],
            $text
        );

        $text = preg_replace('/[^\x20-\x7E\n]/', '', $text) ?? '';
        $text = preg_replace('/ +/', ' ', $text) ?? '';

        return trim($text);
    }

    private function sanitizeReceiptLine(string $text): string
    {
        $text = str_replace(
            ["\r\n", "\r", '•', '→', '–', '—', "\t"],
            ["\n", "\n", '-', '->', '-', '-', ' '],
            $text
        );

        $parts = explode("\n", $text);
        $parts = array_map(function (string $line) {
            $line = preg_replace('/[^\x20-\x7E ]/', '', $line) ?? '';

            return rtrim($line, ' ');
        }, $parts);

        return implode("\n", $parts);
    }
}
