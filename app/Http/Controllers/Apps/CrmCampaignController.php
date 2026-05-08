<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\CustomerCampaign;
use App\Models\CustomerCampaignLog;
use App\Models\Receivable;
use App\Models\Transaction;
use App\Services\CrmAutomationService;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class CrmCampaignController extends Controller
{
    public function __construct(
        private readonly CrmAutomationService $crmAutomationService,
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $outletId = $this->outletResolver->resolve($request, $request->user())?->id;
        $filters = [
            'type' => $request->input('type'),
            'status' => $request->input('status'),
        ];

        $campaigns = CustomerCampaign::query()
            ->with(['creator:id,name'])
            ->withCount('logs')
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->when($filters['type'], fn ($query, $type) => $query->where('type', $type))
            ->when($filters['status'], fn ($query, $status) => $query->where('status', $status))
            ->orderByDesc('created_at')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('Dashboard/CrmCampaigns/Index', [
            'campaigns' => $campaigns,
            'filters' => $filters,
        ]);
    }

    public function create()
    {
        return Inertia::render('Dashboard/CrmCampaigns/Create', [
            'campaign' => null,
            'audienceOptions' => $this->crmAutomationService->audienceOptions(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateCampaign($request);
        $campaign = $this->crmAutomationService->createCampaign(
            $validated,
            $request->user()->id,
            $this->outletResolver->resolve($request, $request->user())?->id
        );

        if (! $request->boolean('save_as_draft')) {
            $campaign = $this->crmAutomationService->processCampaign($campaign);
        }

        return redirect()
            ->route('crm-campaigns.show', $campaign)
            ->with('success', 'Campaign CRM berhasil dibuat.');
    }

    public function show(Request $request, CustomerCampaign $crmCampaign)
    {
        $this->ensureOutletAccess($request, $crmCampaign->outlet_id);
        $crmCampaign->load([
            'creator:id,name',
            'logs.customer:id,name,no_telp',
            'logs.transaction:id,invoice',
            'logs.receivable:id,invoice,due_date',
        ]);

        return Inertia::render('Dashboard/CrmCampaigns/Show', [
            'campaign' => $crmCampaign,
        ]);
    }

    public function edit(Request $request, CustomerCampaign $crmCampaign)
    {
        $this->ensureOutletAccess($request, $crmCampaign->outlet_id);
        return Inertia::render('Dashboard/CrmCampaigns/Edit', [
            'campaign' => $crmCampaign,
            'audienceOptions' => $this->crmAutomationService->audienceOptions(),
        ]);
    }

    public function update(Request $request, CustomerCampaign $crmCampaign)
    {
        $this->ensureOutletAccess($request, $crmCampaign->outlet_id);
        $validated = $this->validateCampaign($request);
        $crmCampaign = $this->crmAutomationService->updateCampaign($crmCampaign, $validated);

        return redirect()
            ->route('crm-campaigns.show', $crmCampaign)
            ->with('success', 'Campaign CRM berhasil diperbarui.');
    }

    public function destroy(Request $request, CustomerCampaign $crmCampaign)
    {
        $this->ensureOutletAccess($request, $crmCampaign->outlet_id);
        $crmCampaign->delete();

        return redirect()
            ->route('crm-campaigns.index')
            ->with('success', 'Campaign CRM berhasil dihapus.');
    }

    public function process(Request $request, CustomerCampaign $crmCampaign)
    {
        $this->ensureOutletAccess($request, $crmCampaign->outlet_id);
        $crmCampaign = $this->crmAutomationService->processCampaign($crmCampaign);

        return redirect()
            ->route('crm-campaigns.show', $crmCampaign)
            ->with('success', 'Campaign berhasil diproses ke audience.');
    }

    public function cancel(Request $request, CustomerCampaign $crmCampaign)
    {
        $this->ensureOutletAccess($request, $crmCampaign->outlet_id);
        $crmCampaign = $this->crmAutomationService->cancelCampaign($crmCampaign);

        return redirect()
            ->route('crm-campaigns.show', $crmCampaign)
            ->with('success', 'Campaign dibatalkan.');
    }

    public function markLogSent(Request $request, CustomerCampaignLog $log)
    {
        $this->ensureOutletAccess($request, $log->outlet_id);
        $this->crmAutomationService->markLog($log, CustomerCampaignLog::STATUS_SENT);

        return back()->with('success', 'Log campaign ditandai sebagai terkirim.');
    }

    public function markLogSkipped(Request $request, CustomerCampaignLog $log)
    {
        $this->ensureOutletAccess($request, $log->outlet_id);
        $this->crmAutomationService->markLog($log, CustomerCampaignLog::STATUS_SKIPPED);

        return back()->with('success', 'Log campaign dilewati.');
    }

    public function shareTransaction(Transaction $transaction, Request $request)
    {
        $this->ensureOutletAccess($request, $transaction->outlet_id);

        if (! $transaction->customer_id) {
            return back()->with('error', 'Transaksi umum / walk-in tidak bisa dibuatkan campaign customer.');
        }

        $campaign = $this->crmAutomationService->createInvoiceShareCampaignForTransaction($transaction, $request->user()->id);

        return redirect()
            ->route('crm-campaigns.show', $campaign)
            ->with('success', 'Campaign share invoice transaksi berhasil dibuat.');
    }

    public function shareReceivable(Receivable $receivable, Request $request)
    {
        $this->ensureOutletAccess($request, $receivable->outlet_id);
        $campaign = $this->crmAutomationService->createInvoiceShareCampaignForReceivable($receivable, $request->user()->id);

        return redirect()
            ->route('crm-campaigns.show', $campaign)
            ->with('success', 'Campaign share piutang berhasil dibuat.');
    }

    private function validateCampaign(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in([
                CustomerCampaign::TYPE_PROMO_BROADCAST,
                CustomerCampaign::TYPE_INVOICE_SHARE,
                CustomerCampaign::TYPE_DUE_DATE_REMINDER,
                CustomerCampaign::TYPE_REPEAT_ORDER_REMINDER,
            ])],
            'channel' => ['required', Rule::in([
                CustomerCampaign::CHANNEL_INTERNAL,
                CustomerCampaign::CHANNEL_WHATSAPP_LINK,
            ])],
            'message_template' => ['nullable', 'string', 'max:4000'],
            'audience_filters' => ['nullable', 'array'],
            'audience_filters.segment_ids' => ['nullable', 'array'],
            'audience_filters.segment_ids.*' => ['integer', 'exists:customer_segments,id'],
            'audience_filters.customer_type' => ['nullable', Rule::in(['all', 'member', 'non_member'])],
            'audience_filters.receivable_status' => ['nullable', Rule::in(['all', 'has_receivable', 'overdue', 'due_soon'])],
            'audience_filters.voucher_filter' => ['nullable', Rule::in(['all', 'has_active_voucher', 'no_active_voucher'])],
        ]);
    }

    private function ensureOutletAccess(Request $request, ?int $outletId): void
    {
        $activeOutletId = $this->outletResolver->resolve($request, $request->user())?->id;

        if ($activeOutletId && $outletId && (int) $activeOutletId !== (int) $outletId) {
            abort(404);
        }
    }
}
