<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerCampaign;
use App\Models\CustomerCampaignLog;
use App\Models\Outlet;
use App\Models\Receivable;
use App\Models\Transaction;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class CrmAutomationService
{
    public function __construct(
        private readonly CustomerSegmentationService $segmentationService
    ) {}

    public function audienceOptions(): array
    {
        return [
            'customer_types' => [
                ['value' => 'all', 'label' => 'Semua Customer'],
                ['value' => 'member', 'label' => 'Loyalty Member'],
                ['value' => 'non_member', 'label' => 'Non Member'],
            ],
            'receivable_statuses' => [
                ['value' => 'all', 'label' => 'Semua Status Piutang'],
                ['value' => 'has_receivable', 'label' => 'Punya Piutang'],
                ['value' => 'overdue', 'label' => 'Piutang Overdue'],
                ['value' => 'due_soon', 'label' => 'Jatuh Tempo H-3'],
            ],
            'voucher_filters' => [
                ['value' => 'all', 'label' => 'Semua Customer'],
                ['value' => 'has_active_voucher', 'label' => 'Punya Voucher Aktif'],
                ['value' => 'no_active_voucher', 'label' => 'Tidak Punya Voucher Aktif'],
            ],
            'segment_options' => $this->segmentationService->segmentOptions(),
        ];
    }

    public function buildAudience(array $filters, ?CarbonInterface $at = null, ?int $outletId = null): Collection
    {
        $at = $at ?? now();

        $query = Customer::query()
            ->with([
                'segments',
                'receivables' => fn ($builder) => $builder->when($outletId, fn ($q) => $q->where('outlet_id', $outletId)),
                'vouchers',
            ])
            ->orderBy('name');

        $segmentIds = collect($filters['segment_ids'] ?? [])
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->all();
        if ($segmentIds !== []) {
            $query->whereHas('segments', fn ($builder) => $builder->whereIn('customer_segments.id', $segmentIds));
        }

        $customerType = $filters['customer_type'] ?? 'all';
        if ($customerType === 'member') {
            $query->where('is_loyalty_member', true);
        } elseif ($customerType === 'non_member') {
            $query->where('is_loyalty_member', false);
        }

        return $query->get()->filter(function (Customer $customer) use ($filters, $at) {
            $voucherFilter = $filters['voucher_filter'] ?? 'all';
            $hasActiveVoucher = $customer->vouchers
                ->filter(fn ($voucher) => $voucher->currentStatusLabel() === 'active')
                ->isNotEmpty();
            if ($voucherFilter === 'has_active_voucher' && ! $hasActiveVoucher) {
                return false;
            }
            if ($voucherFilter === 'no_active_voucher' && $hasActiveVoucher) {
                return false;
            }

            $receivableStatus = $filters['receivable_status'] ?? 'all';
            $hasOutstanding = $customer->receivables
                ->filter(fn ($receivable) => $receivable->status !== 'paid' && $receivable->remaining > 0)
                ->isNotEmpty();
            $hasOverdue = $customer->receivables
                ->filter(fn ($receivable) => $receivable->status !== 'paid' && $receivable->due_date && $at->gt($receivable->due_date))
                ->isNotEmpty();
            $hasDueSoon = $customer->receivables
                ->filter(function ($receivable) use ($at) {
                    if ($receivable->status === 'paid' || ! $receivable->due_date) {
                        return false;
                    }

                    return $receivable->due_date->between($at->copy()->startOfDay(), $at->copy()->addDays(3)->endOfDay());
                })
                ->isNotEmpty();

            return match ($receivableStatus) {
                'has_receivable' => $hasOutstanding,
                'overdue' => $hasOverdue,
                'due_soon' => $hasDueSoon,
                default => true,
            };
        })->values();
    }

    public function createCampaign(array $payload, int $userId, ?int $outletId = null): CustomerCampaign
    {
        return CustomerCampaign::query()->create([
            'outlet_id' => $outletId,
            'name' => $payload['name'],
            'type' => $payload['type'],
            'status' => CustomerCampaign::STATUS_DRAFT,
            'channel' => $payload['channel'] ?? CustomerCampaign::CHANNEL_INTERNAL,
            'audience_filters' => $payload['audience_filters'] ?? [],
            'message_template' => $payload['message_template'] ?? null,
            'created_by' => $userId,
        ]);
    }

    public function updateCampaign(CustomerCampaign $campaign, array $payload): CustomerCampaign
    {
        $campaign->update([
            'name' => $payload['name'],
            'channel' => $payload['channel'] ?? CustomerCampaign::CHANNEL_INTERNAL,
            'audience_filters' => $payload['audience_filters'] ?? [],
            'message_template' => $payload['message_template'] ?? null,
        ]);

        return $campaign->fresh();
    }

    public function processCampaign(CustomerCampaign $campaign, ?CarbonInterface $at = null): CustomerCampaign
    {
        $at = $at ?? now();
        $campaign->logs()->delete();

        $audience = $this->buildAudience($campaign->audience_filters ?? [], $at, $campaign->outlet_id);
        $snapshot = $audience->map(fn (Customer $customer) => [
            'customer_id' => $customer->id,
            'name' => $customer->name,
            'no_telp' => $customer->no_telp,
            'is_loyalty_member' => (bool) $customer->is_loyalty_member,
            'segments' => $customer->segments->pluck('name')->values()->all(),
        ])->values()->all();

        foreach ($audience as $customer) {
            $payload = $this->buildCustomerPayload($campaign, $customer);

            $campaign->logs()->create([
                'outlet_id' => $campaign->outlet_id,
                'customer_id' => $customer->id,
                'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
                'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
                'payload' => $payload,
            ]);
        }

        $campaign->update([
            'status' => CustomerCampaign::STATUS_READY,
            'audience_snapshot' => $snapshot,
            'processed_at' => $at,
        ]);

        return $campaign->fresh(['logs.customer']);
    }

    public function cancelCampaign(CustomerCampaign $campaign): CustomerCampaign
    {
        $campaign->update(['status' => CustomerCampaign::STATUS_CANCELLED]);

        return $campaign->fresh();
    }

    public function markLog(CustomerCampaignLog $log, string $status): CustomerCampaignLog
    {
        $payload = [
            'status' => $status,
        ];

        if ($status === CustomerCampaignLog::STATUS_SENT) {
            $payload['sent_at'] = now();
        }

        $log->update($payload);
        $this->refreshCampaignStatus($log->campaign);

        return $log->fresh();
    }

    public function createInvoiceShareCampaignForTransaction(Transaction $transaction, int $userId): CustomerCampaign
    {
        $campaign = CustomerCampaign::query()->firstOrCreate(
            ['context_key' => 'invoice-share-transaction-'.$transaction->outlet_id.'-'.$transaction->id],
            [
                'outlet_id' => $transaction->outlet_id,
                'name' => 'Share Invoice '.$transaction->invoice,
                'type' => CustomerCampaign::TYPE_INVOICE_SHARE,
                'status' => CustomerCampaign::STATUS_READY,
                'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
                'audience_filters' => ['transaction_id' => $transaction->id],
                'audience_snapshot' => [[
                    'customer_id' => $transaction->customer_id,
                    'transaction_id' => $transaction->id,
                    'invoice' => $transaction->invoice,
                ]],
                'message_template' => 'Invoice {{invoice}}: {{url}}',
                'processed_at' => now(),
                'created_by' => $userId,
            ]
        );

        $campaign->logs()->updateOrCreate(
            [
                'outlet_id' => $transaction->outlet_id,
                'transaction_id' => $transaction->id,
                'customer_id' => $transaction->customer_id,
            ],
            [
                'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
                'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
                'payload' => [
                    'message' => 'Invoice '.$transaction->invoice.': '.route('transactions.public', $transaction->invoice, true),
                    'whatsapp_url' => 'https://wa.me/?text='.urlencode('Invoice '.$transaction->invoice.': '.route('transactions.public', $transaction->invoice, true)),
                    'invoice' => $transaction->invoice,
                ],
            ]
        );

        return $campaign->fresh(['logs.customer', 'logs.transaction']);
    }

    public function createInvoiceShareCampaignForReceivable(Receivable $receivable, int $userId): CustomerCampaign
    {
        $campaign = CustomerCampaign::query()->firstOrCreate(
            ['context_key' => 'invoice-share-receivable-'.$receivable->outlet_id.'-'.$receivable->id],
            [
                'outlet_id' => $receivable->outlet_id,
                'name' => 'Share Piutang '.$receivable->invoice,
                'type' => CustomerCampaign::TYPE_INVOICE_SHARE,
                'status' => CustomerCampaign::STATUS_READY,
                'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
                'audience_filters' => ['receivable_id' => $receivable->id],
                'audience_snapshot' => [[
                    'customer_id' => $receivable->customer_id,
                    'receivable_id' => $receivable->id,
                    'invoice' => $receivable->invoice,
                ]],
                'message_template' => 'Invoice {{invoice}} total {{remaining}} jatuh tempo {{due_date}}',
                'processed_at' => now(),
                'created_by' => $userId,
            ]
        );

        $shareText = sprintf(
            'Pengingat piutang %s. Sisa tagihan Rp %s. Jatuh tempo: %s',
            $receivable->invoice,
            number_format($receivable->remaining, 0, ',', '.'),
            optional($receivable->due_date)?->format('d/m/Y') ?? '-'
        );

        $campaign->logs()->updateOrCreate(
            [
                'outlet_id' => $receivable->outlet_id,
                'receivable_id' => $receivable->id,
                'customer_id' => $receivable->customer_id,
            ],
            [
                'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
                'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
                'payload' => [
                    'message' => $shareText,
                    'whatsapp_url' => 'https://wa.me/?text='.urlencode($shareText),
                    'invoice' => $receivable->invoice,
                ],
            ]
        );

        return $campaign->fresh(['logs.customer', 'logs.receivable']);
    }

    public function generateScheduledReminders(?CarbonInterface $at = null, ?int $outletId = null): void
    {
        $at = $at ?? now();
        $this->segmentationService->syncAutoSegments($at, $outletId);

        if ($outletId) {
            $this->generateDueSoonCampaign($at, $outletId);
            $this->generateOverdueCampaign($at, $outletId);
            $this->generateRepeatOrderCampaign($at, $outletId);

            return;
        }

        $outletIds = Outlet::query()->active()->pluck('id');

        foreach ($outletIds as $resolvedOutletId) {
            $this->generateDueSoonCampaign($at, (int) $resolvedOutletId);
            $this->generateOverdueCampaign($at, (int) $resolvedOutletId);
            $this->generateRepeatOrderCampaign($at, (int) $resolvedOutletId);
        }
    }

    public function reminderCampaignsQuery(?int $outletId = null)
    {
        return CustomerCampaign::query()
            ->with(['creator:id,name', 'logs.customer:id,name,no_telp', 'logs.transaction:id,invoice', 'logs.receivable:id,invoice,due_date'])
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->whereIn('type', [
                CustomerCampaign::TYPE_DUE_DATE_REMINDER,
                CustomerCampaign::TYPE_REPEAT_ORDER_REMINDER,
                CustomerCampaign::TYPE_PROMO_BROADCAST,
                CustomerCampaign::TYPE_INVOICE_SHARE,
            ])
            ->orderByDesc('processed_at')
            ->orderByDesc('created_at');
    }

    private function generateDueSoonCampaign(CarbonInterface $at, int $outletId): void
    {
        $contextKey = 'due-soon-'.$outletId.'-'.$at->toDateString();
        $campaign = CustomerCampaign::query()->firstOrCreate(
            ['context_key' => $contextKey],
            [
                'outlet_id' => $outletId,
                'name' => 'Reminder Jatuh Tempo H-3 '.$at->format('d M Y'),
                'type' => CustomerCampaign::TYPE_DUE_DATE_REMINDER,
                'status' => CustomerCampaign::STATUS_READY,
                'channel' => CustomerCampaign::CHANNEL_INTERNAL,
                'audience_filters' => ['receivable_status' => 'due_soon'],
                'message_template' => 'Pengingat: invoice {{invoice}} jatuh tempo {{due_date}}',
                'processed_at' => $at,
            ]
        );

        if ($campaign->wasRecentlyCreated) {
            $receivables = Receivable::query()
                ->with('customer:id,name,no_telp')
                ->where('outlet_id', $outletId)
                ->where('status', '!=', 'paid')
                ->whereBetween('due_date', [$at->copy()->startOfDay(), $at->copy()->addDays(3)->endOfDay()])
                ->get();

            $this->fillReceivableReminderLogs($campaign, $receivables, 'jatuh tempo');
        }
    }

    private function generateOverdueCampaign(CarbonInterface $at, int $outletId): void
    {
        $contextKey = 'overdue-'.$outletId.'-'.$at->toDateString();
        $campaign = CustomerCampaign::query()->firstOrCreate(
            ['context_key' => $contextKey],
            [
                'outlet_id' => $outletId,
                'name' => 'Reminder Piutang Overdue '.$at->format('d M Y'),
                'type' => CustomerCampaign::TYPE_DUE_DATE_REMINDER,
                'status' => CustomerCampaign::STATUS_READY,
                'channel' => CustomerCampaign::CHANNEL_INTERNAL,
                'audience_filters' => ['receivable_status' => 'overdue'],
                'message_template' => 'Piutang {{invoice}} telah overdue sejak {{due_date}}',
                'processed_at' => $at,
            ]
        );

        if ($campaign->wasRecentlyCreated) {
            $receivables = Receivable::query()
                ->with('customer:id,name,no_telp')
                ->where('outlet_id', $outletId)
                ->where('status', '!=', 'paid')
                ->whereDate('due_date', '<', $at->toDateString())
                ->get();

            $this->fillReceivableReminderLogs($campaign, $receivables, 'overdue');
        }
    }

    private function generateRepeatOrderCampaign(CarbonInterface $at, int $outletId): void
    {
        $contextKey = 'repeat-order-'.$outletId.'-'.$at->toDateString();
        $campaign = CustomerCampaign::query()->firstOrCreate(
            ['context_key' => $contextKey],
            [
                'outlet_id' => $outletId,
                'name' => 'Repeat Order Reminder '.$at->format('d M Y'),
                'type' => CustomerCampaign::TYPE_REPEAT_ORDER_REMINDER,
                'status' => CustomerCampaign::STATUS_READY,
                'channel' => CustomerCampaign::CHANNEL_INTERNAL,
                'audience_filters' => ['segment_slugs' => ['inactive_customer']],
                'message_template' => 'Sudah lama tidak belanja. Ajak customer kembali bertransaksi.',
                'processed_at' => $at,
            ]
        );

        if ($campaign->wasRecentlyCreated) {
            $customers = Customer::query()
                ->with('segments')
                ->whereHas('transactions', fn ($query) => $query->where('outlet_id', $outletId))
                ->whereDoesntHave('transactions', fn ($query) => $query
                    ->where('outlet_id', $outletId)
                    ->where('created_at', '>=', $at->copy()->subDays(30)))
                ->get();

            foreach ($customers as $customer) {
                $message = 'Halo '.$customer->name.', kami merindukan kunjungan Anda. Yuk belanja lagi hari ini.';

                $campaign->logs()->create([
                    'outlet_id' => $campaign->outlet_id,
                    'customer_id' => $customer->id,
                    'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
                    'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
                    'payload' => [
                        'message' => $message,
                        'whatsapp_url' => 'https://wa.me/?text='.urlencode($message),
                        'reason' => 'inactive_customer',
                    ],
                ]);
            }

            $campaign->update([
                'audience_snapshot' => $customers->map(fn (Customer $customer) => [
                    'customer_id' => $customer->id,
                    'name' => $customer->name,
                    'reason' => 'inactive_customer',
                ])->values()->all(),
            ]);
        }
    }

    private function fillReceivableReminderLogs(CustomerCampaign $campaign, Collection $receivables, string $reason): void
    {
        foreach ($receivables as $receivable) {
            $message = sprintf(
                'Pengingat %s untuk invoice %s. Sisa tagihan Rp %s. Jatuh tempo %s.',
                $reason,
                $receivable->invoice,
                number_format($receivable->remaining, 0, ',', '.'),
                optional($receivable->due_date)?->format('d/m/Y') ?? '-'
            );

            $campaign->logs()->create([
                'outlet_id' => $campaign->outlet_id,
                'customer_id' => $receivable->customer_id,
                'receivable_id' => $receivable->id,
                'channel' => CustomerCampaign::CHANNEL_WHATSAPP_LINK,
                'status' => CustomerCampaignLog::STATUS_READY_TO_SEND,
                'payload' => [
                    'message' => $message,
                    'whatsapp_url' => 'https://wa.me/?text='.urlencode($message),
                    'reason' => $reason,
                    'invoice' => $receivable->invoice,
                ],
            ]);
        }

        $campaign->update([
            'audience_snapshot' => $receivables->map(fn (Receivable $receivable) => [
                'customer_id' => $receivable->customer_id,
                'receivable_id' => $receivable->id,
                'invoice' => $receivable->invoice,
                'due_date' => optional($receivable->due_date)?->toDateString(),
                'remaining' => $receivable->remaining,
            ])->values()->all(),
        ]);
    }

    private function buildCustomerPayload(CustomerCampaign $campaign, Customer $customer): array
    {
        $template = $campaign->message_template ?: 'Halo {{name}}, ada promo spesial untuk Anda.';
        $message = str_replace(
            ['{{name}}', '{{phone}}'],
            [$customer->name, $customer->no_telp],
            $template
        );

        return [
            'message' => $message,
            'whatsapp_url' => 'https://wa.me/?text='.urlencode($message),
            'segments' => $customer->segments->pluck('slug')->values()->all(),
        ];
    }

    private function refreshCampaignStatus(?CustomerCampaign $campaign): void
    {
        if (! $campaign) {
            return;
        }

        $hasPending = $campaign->logs()
            ->whereIn('status', [
                CustomerCampaignLog::STATUS_PENDING,
                CustomerCampaignLog::STATUS_READY_TO_SEND,
            ])
            ->exists();

        $campaign->update([
            'status' => $hasPending
                ? CustomerCampaign::STATUS_READY
                : CustomerCampaign::STATUS_PROCESSED,
        ]);
    }
}
