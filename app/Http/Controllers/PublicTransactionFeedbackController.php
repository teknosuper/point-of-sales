<?php

namespace App\Http\Controllers;

use App\Models\KitchenTicketEvent;
use App\Models\KitchenTicketItem;
use App\Models\Transaction;
use App\Models\TransactionItemFeedback;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PublicTransactionFeedbackController extends Controller
{
    public function show(string $invoice): Response
    {
        $transaction = $this->resolveTransaction($invoice);

        return Inertia::render('Public/TransactionFeedback', [
            'transaction' => [
                'id' => (int) $transaction->id,
                'invoice' => $transaction->invoice,
                'created_at' => $transaction->getRawOriginal('created_at')
                    ? \Carbon\Carbon::parse($transaction->getRawOriginal('created_at'))->toIso8601String()
                    : null,
                'customer_name' => $transaction->customer?->name ?: 'Pelanggan',
                'outlet' => [
                    'id' => (int) $transaction->outlet_id,
                    'name' => $transaction->outlet?->name,
                    'code' => $transaction->outlet?->code,
                ],
                'items' => $transaction->details->map(function ($detail) {
                    $feedback = $detail->transactionItemFeedback;

                    return [
                        'id' => (int) $detail->id,
                        'product_name' => $detail->product?->title ?? "Produk #{$detail->product_id}",
                        'qty' => (int) $detail->qty,
                        'notes' => $detail->notes,
                        'rating' => $feedback?->rating,
                        'feedback_text' => $feedback?->feedback_text,
                        'delivery_status' => $feedback?->delivery_status ?? 'received',
                        'customer_alert_message' => $feedback?->customer_alert_message,
                        'customer_alert_requested_at' => optional($feedback?->customer_alert_requested_at)->toIso8601String(),
                    ];
                })->values(),
            ],
        ]);
    }

    public function store(Request $request, string $invoice): RedirectResponse
    {
        $transaction = $this->resolveTransaction($invoice);

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.transaction_detail_id' => ['required', 'integer'],
            'items.*.rating' => ['nullable', 'integer', 'max:5'],
            'items.*.feedback_text' => ['nullable', 'string', 'max:1500'],
            'items.*.not_received' => ['nullable', 'boolean'],
            'items.*.customer_alert_message' => ['nullable', 'string', 'max:1000'],
        ]);

        $detailMap = $transaction->details->keyBy(fn ($detail) => (int) $detail->id);
        $items = collect($validated['items'])
            ->map(function (array $item) {
                return [
                    'transaction_detail_id' => (int) $item['transaction_detail_id'],
                    'rating' => $item['rating'] ? (int) $item['rating'] : null,
                    'feedback_text' => trim((string) ($item['feedback_text'] ?? '')),
                    'not_received' => (bool) ($item['not_received'] ?? false),
                    'customer_alert_message' => trim((string) ($item['customer_alert_message'] ?? '')),
                ];
            })
            ->filter(fn (array $item) => $detailMap->has($item['transaction_detail_id']))
            ->values();

        abort_if($items->isEmpty(), 422, 'Tidak ada item feedback yang valid.');

        $hasUsefulInput = $items->contains(fn (array $item) => $item['rating'] || $item['feedback_text'] !== '' || $item['not_received']);
        abort_if(! $hasUsefulInput, 422, 'Isi minimal satu rating, saran, atau alert item belum diterima.');

        DB::transaction(function () use ($items, $detailMap, $transaction) {
            foreach ($items as $item) {
                $detail = $detailMap->get($item['transaction_detail_id']);
                $feedback = TransactionItemFeedback::query()->firstOrNew([
                    'transaction_detail_id' => $detail->id,
                ]);

                $feedback->fill([
                    'outlet_id' => (int) $transaction->outlet_id,
                    'transaction_id' => (int) $transaction->id,
                    'rating' => $item['rating'],
                    'feedback_text' => $item['feedback_text'] !== '' ? $item['feedback_text'] : null,
                    'delivery_status' => $item['not_received'] ? 'not_received' : 'received',
                    'customer_alert_message' => $item['customer_alert_message'] !== '' ? $item['customer_alert_message'] : null,
                ]);

                $shouldDispatchAlert = $item['not_received'] && (
                    ! $feedback->exists
                    || $feedback->delivery_status !== 'not_received'
                    || (string) ($feedback->customer_alert_message ?? '') !== (string) ($item['customer_alert_message'] !== '' ? $item['customer_alert_message'] : null)
                );

                if ($shouldDispatchAlert) {
                    $event = $this->dispatchKitchenAlert($transaction, $detail, $item['customer_alert_message']);

                    if ($event) {
                        $feedback->customer_alert_requested_at = now();
                        $feedback->customer_alert_count = (int) ($feedback->customer_alert_count ?? 0) + 1;
                        $feedback->kitchen_ticket_event_id = $event->id;
                    }
                }

                $feedback->save();
            }
        });

        return back()->with('success', 'Kritik, saran, dan alert item berhasil dikirim.');
    }

    private function resolveTransaction(string $invoice): Transaction
    {
        return Transaction::query()
            ->with([
                'outlet:id,name,code',
                'customer:id,name',
                'details.product:id,title',
                'details.transactionItemFeedback',
            ])
            ->where('invoice', $invoice)
            ->firstOrFail();
    }

    private function dispatchKitchenAlert(Transaction $transaction, $detail, string $message): ?KitchenTicketEvent
    {
        $ticketItem = KitchenTicketItem::query()
            ->with('kitchenTicket')
            ->where('transaction_detail_id', $detail->id)
            ->latest('id')
            ->first();

        if (! $ticketItem?->kitchenTicket) {
            return null;
        }

        return $ticketItem->kitchenTicket->events()->create([
            'user_id' => null,
            'event' => 'ticket.customer_alert',
            'payload' => [
                'transaction_id' => (int) $transaction->id,
                'transaction_detail_id' => (int) $detail->id,
                'invoice' => $transaction->invoice,
                'customer_name' => $transaction->customer?->name ?: ($transaction->order_reference_name ?: 'Pelanggan'),
                'customer_phone' => $transaction->customer?->no_telp,
                'order_type' => $transaction->order_type,
                'table_code' => $transaction->diningTable?->code,
                'table_name' => $transaction->diningTable?->name,
                'product_title' => $detail->product?->title ?? "Produk #{$detail->product_id}",
                'qty' => (int) $detail->qty,
                'message' => $message !== '' ? $message : 'Pembeli memberi tanda item belum diterima.',
            ],
            'created_at' => now(),
        ]);
    }
}
