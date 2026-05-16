<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\CashierSettlementRequest;
use App\Models\CashierShift;
use App\Models\Product;
use App\Models\Setting;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\CashierShiftService;
use App\Services\OutletResolver;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class CashierSettlementController extends Controller
{
    public function __construct(
        private readonly CashierShiftService $cashierShiftService,
        private readonly AuditLogService $auditLogService,
        private readonly OutletResolver $outletResolver,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $this->outletResolver->resolve($request, $user);
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');
        $isKitchenWorkspace = $user?->isKitchenWorkspace() ?? false;

        $filters = [
            'q' => trim((string) $request->input('q', '')),
            'status' => (string) $request->input('status', ''),
            'cashier_id' => (string) $request->input('cashier_id', ''),
            'date_from' => (string) $request->input('date_from', ''),
            'date_to' => (string) $request->input('date_to', ''),
        ];

        $canApprove = $this->canApprove($user);

        $query = CashierSettlementRequest::query()
            ->with([
                'cashier:id,name',
                'cashierShift:id,opened_at,closed_at,status',
                'recipientUser:id,name',
                'approvedBy:id,name',
                'rejectedBy:id,name',
            ])
            ->where('outlet_id', $outlet->id)
            ->when(! $canApprove, fn (Builder $builder) => $builder->where('cashier_id', $user->id))
            ->when($filters['q'] !== '', function (Builder $builder) use ($filters) {
                $builder->where(function (Builder $nested) use ($filters) {
                    $nested
                        ->where('request_number', 'like', '%'.$filters['q'].'%')
                        ->orWhere('recipient_name', 'like', '%'.$filters['q'].'%')
                        ->orWhereHas('cashier', fn (Builder $cashierQuery) => $cashierQuery->where('name', 'like', '%'.$filters['q'].'%'));
                });
            })
            ->when($filters['status'] !== '', fn (Builder $builder) => $builder->where('status', $filters['status']))
            ->when($filters['cashier_id'] !== '', fn (Builder $builder) => $builder->where('cashier_id', (int) $filters['cashier_id']))
            ->when($filters['date_from'] !== '', fn (Builder $builder) => $builder->whereDate('business_date', '>=', $filters['date_from']))
            ->when($filters['date_to'] !== '', fn (Builder $builder) => $builder->whereDate('business_date', '<=', $filters['date_to']))
            ->latest('created_at');

        $requests = (clone $query)
            ->paginate(15)
            ->withQueryString()
            ->through(fn (CashierSettlementRequest $settlement) => $this->transformSettlement($settlement));

        $summaryQuery = (clone $query)->get();
        $summary = [
            'pending_count' => $summaryQuery->where('status', CashierSettlementRequest::STATUS_PENDING)->count(),
            'approved_count' => $summaryQuery->where('status', CashierSettlementRequest::STATUS_APPROVED)->count(),
            'rejected_count' => $summaryQuery->where('status', CashierSettlementRequest::STATUS_REJECTED)->count(),
            'requested_total' => (int) $summaryQuery->sum('requested_amount'),
            'approved_total' => (int) $summaryQuery->sum('approved_amount'),
        ];

        $cashierOptions = $canApprove
            ? User::query()
                ->whereHas('outlets', fn (Builder $builder) => $builder->where('outlets.id', $outlet->id))
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (User $cashier) => ['id' => $cashier->id, 'name' => $cashier->name])
                ->values()
            : collect([['id' => $user->id, 'name' => $user->name]]);

        $shiftOptions = CashierShift::query()
            ->where('outlet_id', $outlet->id)
            ->where('user_id', $user->id)
            ->latest('opened_at')
            ->limit(20)
            ->get()
            ->map(fn (CashierShift $shift) => $this->shiftOptionPayload($shift))
            ->values();

        $recipientOptions = User::query()
            ->whereHas('outlets', fn (Builder $builder) => $builder->where('outlets.id', $outlet->id))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $recipient) => ['id' => $recipient->id, 'name' => $recipient->name])
            ->values();

        $defaultRecipientId = Setting::getInt('cashier_base_settlement_recipient_user_id', 0, $outlet->id);
        $wallet = $isKitchenWorkspace
            ? $this->buildKitchenWalletSummary($user, $outlet->id)
            : null;

        return Inertia::render('Dashboard/CashierSettlements/Index', [
            'filters' => $filters,
            'summary' => $summary,
            'requests' => $requests,
            'cashiers' => $cashierOptions,
            'shiftOptions' => $shiftOptions,
            'recipientOptions' => $recipientOptions,
            'defaultRecipientId' => $defaultRecipientId > 0 ? $defaultRecipientId : null,
            'canApprove' => $canApprove,
            'canCreateRequest' => $isKitchenWorkspace,
            'wallet' => $wallet,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $outlet = $this->outletResolver->resolve($request, $user);
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');
        $isKitchenWorkspace = $user?->isKitchenWorkspace() ?? false;
        abort_unless($isKitchenWorkspace, 403, 'Pengajuan hanya bisa dibuat oleh tenant / dapur. Admin hanya dapat melakukan approval.');

        $data = $request->validate([
            'cashier_shift_id' => ['nullable', 'integer', 'exists:cashier_shifts,id'],
            'recipient_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'requested_notes' => ['nullable', 'string', 'max:500'],
            'requested_amount' => ['required', 'numeric', 'min:1'],
            'request_proof_photos' => ['nullable', 'array', 'max:6'],
            'request_proof_photos.*' => ['image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
        ]);

        $defaultRecipientId = Setting::getInt('cashier_base_settlement_recipient_user_id', 0, $outlet->id);
        $recipientUserId = $isKitchenWorkspace
            ? $defaultRecipientId
            : (int) ($data['recipient_user_id'] ?? 0);
        $recipientUser = $recipientUserId > 0
            ? User::query()
                ->whereKey($recipientUserId)
                ->whereHas('outlets', fn (Builder $builder) => $builder->where('outlets.id', $outlet->id))
                ->first()
            : null;
        $requestProofPhotos = $this->storeProofPhotos($request, 'request_proof_photos', 'cashier-settlements/request-proofs');
        $settlementAttributes = [
            'outlet_id' => $outlet->id,
            'cashier_id' => $user->id,
            'request_number' => $this->nextRequestNumber($outlet->id, $isKitchenWorkspace ? 'TWR' : 'CSR'),
            'recipient_user_id' => $recipientUser?->id,
            'recipient_name' => $recipientUser?->name,
            'requested_notes' => trim((string) ($data['requested_notes'] ?? '')),
            'request_proof_photos' => $requestProofPhotos,
            'status' => CashierSettlementRequest::STATUS_PENDING,
        ];

        $wallet = $this->buildKitchenWalletSummary($user, $outlet->id);
        $requestedAmount = (int) round((float) ($data['requested_amount'] ?? 0));

        abort_if($requestedAmount <= 0, 422, 'Nominal penarikan harus lebih dari nol.');
        abort_if($requestedAmount > (int) ($wallet['available_balance'] ?? 0), 422, 'Nominal penarikan melebihi saldo tersedia tenant.');

        $settlement = CashierSettlementRequest::create([
            ...$settlementAttributes,
            'cashier_shift_id' => null,
            'business_date' => now()->toDateString(),
            'gross_sales_total' => (int) ($wallet['tenant_sales_total'] ?? 0),
            'base_sales_total' => (int) ($wallet['base_total'] ?? 0),
            'markup_total' => 0,
            'requested_amount' => $requestedAmount,
        ]);

        $this->auditLogService->log(
            event: 'cashier_settlement.requested',
            module: 'cashier_settlements',
            auditable: $settlement,
            description: $isKitchenWorkspace
                ? 'Tenant / dapur membuat pengajuan penarikan dana ke owner outlet.'
                : 'Kasir membuat pengajuan setoran ke admin.',
            after: $this->settlementAuditPayload($settlement),
            meta: [
                'cashier_id' => $settlement->cashier_id,
                'cashier_shift_id' => $settlement->cashier_shift_id,
                'workspace' => $isKitchenWorkspace ? 'kitchen' : 'standard',
            ],
            actor: $user,
        );

        return back()->with('success', $isKitchenWorkspace ? 'Pengajuan penarikan dana tenant berhasil dibuat.' : 'Pengajuan setoran kasir berhasil dibuat.');
    }

    public function approve(Request $request, CashierSettlementRequest $cashierSettlement): RedirectResponse
    {
        $approver = $request->user();
        abort_unless($this->canApprove($approver), 403);

        $settlement = $this->resolveVisibleSettlement($request, $cashierSettlement);
        abort_if($settlement->status !== CashierSettlementRequest::STATUS_PENDING, 422, 'Pengajuan ini tidak lagi menunggu approval.');

        $data = $request->validate([
            'approved_amount' => ['required', 'numeric', 'min:0'],
            'approved_cash_amount' => ['nullable', 'numeric', 'min:0'],
            'approved_transfer_amount' => ['nullable', 'numeric', 'min:0'],
            'approved_other_amount' => ['nullable', 'numeric', 'min:0'],
            'approved_other_label' => ['nullable', 'string', 'max:60'],
            'recipient_name' => ['required', 'string', 'max:120'],
            'approval_reference' => ['nullable', 'string', 'max:100'],
            'approval_notes' => ['nullable', 'string', 'max:500'],
            'paid_at' => ['nullable', 'date'],
            'approval_proof_photos' => ['nullable', 'array', 'max:6'],
            'approval_proof_photos.*' => ['image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
        ]);

        $approvedAmount = (int) round((float) $data['approved_amount']);
        $cashAmount = (int) round((float) ($data['approved_cash_amount'] ?? 0));
        $transferAmount = (int) round((float) ($data['approved_transfer_amount'] ?? 0));
        $otherAmount = (int) round((float) ($data['approved_other_amount'] ?? 0));

        abort_if($approvedAmount <= 0, 422, 'Nominal approve harus lebih dari nol.');
        abort_if($approvedAmount > (int) $settlement->requested_amount, 422, 'Nominal approve tidak boleh melebihi nominal pengajuan.');
        abort_if(($cashAmount + $transferAmount + $otherAmount) !== $approvedAmount, 422, 'Total cash/transfer/lainnya harus sama dengan nominal approve.');
        abort_if($otherAmount > 0 && blank($data['approved_other_label'] ?? null), 422, 'Isi keterangan metode lainnya bila nominal lainnya dipakai.');

        $before = $this->settlementAuditPayload($settlement);
        $approvalProofPhotos = $this->storeProofPhotos($request, 'approval_proof_photos', 'cashier-settlements/approval-proofs');

        $settlement->forceFill([
            'status' => CashierSettlementRequest::STATUS_APPROVED,
            'approved_by' => $approver?->id,
            'approved_at' => now(),
            'rejected_by' => null,
            'rejected_at' => null,
            'rejection_reason' => null,
            'approved_amount' => $approvedAmount,
            'approved_cash_amount' => $cashAmount,
            'approved_transfer_amount' => $transferAmount,
            'approved_other_amount' => $otherAmount,
            'approved_other_label' => $data['approved_other_label'] ?? null,
            'recipient_name' => trim((string) $data['recipient_name']),
            'approval_reference' => $data['approval_reference'] ?? null,
            'approval_notes' => $data['approval_notes'] ?? null,
            'approval_proof_photos' => $approvalProofPhotos ?: ($settlement->approval_proof_photos ?? []),
            'paid_at' => filled($data['paid_at'] ?? null) ? Carbon::parse($data['paid_at']) : now(),
        ])->save();

        $this->auditLogService->log(
            event: 'cashier_settlement.approved',
            module: 'cashier_settlements',
            auditable: $settlement,
            description: 'Admin menyetujui dan memvalidasi setoran kasir.',
            before: $before,
            after: $this->settlementAuditPayload($settlement->fresh()),
            meta: [
                'approved_by' => $approver?->id,
            ],
            actor: $approver,
        );

        return back()->with('success', "Pengajuan {$settlement->request_number} berhasil disetujui.");
    }

    public function reject(Request $request, CashierSettlementRequest $cashierSettlement): RedirectResponse
    {
        $approver = $request->user();
        abort_unless($this->canApprove($approver), 403);

        $settlement = $this->resolveVisibleSettlement($request, $cashierSettlement);
        abort_if($settlement->status !== CashierSettlementRequest::STATUS_PENDING, 422, 'Pengajuan ini tidak lagi menunggu approval.');

        $data = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        $before = $this->settlementAuditPayload($settlement);

        $settlement->forceFill([
            'status' => CashierSettlementRequest::STATUS_REJECTED,
            'approved_by' => null,
            'approved_at' => null,
            'approved_amount' => 0,
            'approved_cash_amount' => 0,
            'approved_transfer_amount' => 0,
            'approved_other_amount' => 0,
            'approved_other_label' => null,
            'approval_reference' => null,
            'approval_notes' => null,
            'paid_at' => null,
            'rejected_by' => $approver?->id,
            'rejected_at' => now(),
            'rejection_reason' => trim((string) $data['rejection_reason']),
        ])->save();

        $this->auditLogService->log(
            event: 'cashier_settlement.rejected',
            module: 'cashier_settlements',
            auditable: $settlement,
            description: 'Admin menolak pengajuan setoran kasir.',
            before: $before,
            after: $this->settlementAuditPayload($settlement->fresh()),
            meta: [
                'rejected_by' => $approver?->id,
            ],
            actor: $approver,
        );

        return back()->with('success', "Pengajuan {$settlement->request_number} berhasil ditolak.");
    }

    public function receipt(Request $request, CashierSettlementRequest $cashierSettlement)
    {
        $settlement = $this->resolveVisibleSettlement($request, $cashierSettlement);
        abort_if($settlement->status !== CashierSettlementRequest::STATUS_APPROVED, 404, 'Bukti hanya tersedia untuk pengajuan yang sudah disetujui.');

        return response()->view('print.cashier_settlement_receipt', [
            'settlement' => $this->transformSettlementModel($settlement),
            'autoprint' => $request->boolean('autoprint'),
        ]);
    }

    private function canApprove(?User $user): bool
    {
        return (bool) ($user?->isSuperAdmin() || $user?->can('reports-access') || $user?->can('cashier-shifts-force-close'));
    }

    private function resolveVisibleSettlement(Request $request, CashierSettlementRequest $cashierSettlement): CashierSettlementRequest
    {
        $user = $request->user();
        $outletId = $this->outletResolver->resolve($request, $user)?->id;

        return CashierSettlementRequest::query()
            ->with(['cashier:id,name', 'cashierShift:id,opened_at,closed_at,status', 'recipientUser:id,name', 'approvedBy:id,name', 'rejectedBy:id,name'])
            ->whereKey($cashierSettlement->id)
            ->where('outlet_id', $outletId)
            ->when(! $this->canApprove($user), fn (Builder $builder) => $builder->where('cashier_id', $user?->id))
            ->firstOrFail();
    }

    private function shiftOptionPayload(CashierShift $shift): array
    {
        $summary = $this->cashierShiftService->calculateBaseSettlementSummary($shift);

        return [
            'id' => $shift->id,
            'label' => 'Shift #'.$shift->id.' • '.optional($shift->opened_at)->format('d/m/Y H:i'),
            'status' => $shift->status,
            'opened_at' => optional($shift->opened_at)?->toISOString(),
            'closed_at' => optional($shift->closed_at)?->toISOString(),
            'gross_sales_total' => (int) $summary['gross_sales_total'],
            'base_sales_total' => (int) $summary['base_sales_total'],
            'markup_total' => (int) $summary['markup_total'],
            'requested_amount' => (int) $summary['base_sales_total'],
            'paid_transactions_count' => (int) $summary['paid_transactions_count'],
        ];
    }

    private function nextRequestNumber(int $outletId, string $prefixCode = 'CSR'): string
    {
        $prefix = $prefixCode.'-'.now()->format('dmy');
        $count = CashierSettlementRequest::query()
            ->where('outlet_id', $outletId)
            ->whereDate('created_at', now()->toDateString())
            ->where('request_number', 'like', $prefix.'%')
            ->count() + 1;

        return $prefix.str_pad((string) $count, 3, '0', STR_PAD_LEFT);
    }

    private function transformSettlement(CashierSettlementRequest $settlement): array
    {
        return $this->transformSettlementModel($settlement);
    }

    private function transformSettlementModel(CashierSettlementRequest $settlement): array
    {
        return [
            'id' => $settlement->id,
            'request_number' => $settlement->request_number,
            'business_date' => optional($settlement->business_date)?->toDateString(),
            'gross_sales_total' => (int) $settlement->gross_sales_total,
            'base_sales_total' => (int) $settlement->base_sales_total,
            'markup_total' => (int) $settlement->markup_total,
            'requested_amount' => (int) $settlement->requested_amount,
            'status' => $settlement->status,
            'recipient_name' => $settlement->recipient_name,
            'requested_notes' => $settlement->requested_notes,
            'request_proof_photos' => $settlement->request_proof_photos ?? [],
            'approved_amount' => (int) $settlement->approved_amount,
            'approved_cash_amount' => (int) $settlement->approved_cash_amount,
            'approved_transfer_amount' => (int) $settlement->approved_transfer_amount,
            'approved_other_amount' => (int) $settlement->approved_other_amount,
            'approved_other_label' => $settlement->approved_other_label,
            'approval_reference' => $settlement->approval_reference,
            'approval_notes' => $settlement->approval_notes,
            'approval_proof_photos' => $settlement->approval_proof_photos ?? [],
            'paid_at' => optional($settlement->paid_at)?->toISOString(),
            'approved_at' => optional($settlement->approved_at)?->toISOString(),
            'rejected_at' => optional($settlement->rejected_at)?->toISOString(),
            'rejection_reason' => $settlement->rejection_reason,
            'created_at' => optional($settlement->created_at)?->toISOString(),
            'cashier' => $settlement->cashier ? [
                'id' => $settlement->cashier->id,
                'name' => $settlement->cashier->name,
            ] : null,
            'cashier_shift' => $settlement->cashierShift ? [
                'id' => $settlement->cashierShift->id,
                'status' => $settlement->cashierShift->status,
                'opened_at' => optional($settlement->cashierShift->opened_at)?->toISOString(),
                'closed_at' => optional($settlement->cashierShift->closed_at)?->toISOString(),
            ] : null,
            'recipient_user' => $settlement->recipientUser ? [
                'id' => $settlement->recipientUser->id,
                'name' => $settlement->recipientUser->name,
            ] : null,
            'approved_by' => $settlement->approvedBy ? [
                'id' => $settlement->approvedBy->id,
                'name' => $settlement->approvedBy->name,
            ] : null,
            'rejected_by' => $settlement->rejectedBy ? [
                'id' => $settlement->rejectedBy->id,
                'name' => $settlement->rejectedBy->name,
            ] : null,
        ];
    }

    private function settlementAuditPayload(CashierSettlementRequest $settlement): array
    {
        return [
            'request_number' => $settlement->request_number,
            'status' => $settlement->status,
            'requested_amount' => (int) $settlement->requested_amount,
            'approved_amount' => (int) $settlement->approved_amount,
            'base_sales_total' => (int) $settlement->base_sales_total,
            'markup_total' => (int) $settlement->markup_total,
            'recipient_name' => $settlement->recipient_name,
        ];
    }

    private function storeProofPhotos(Request $request, string $field, string $directory): array
    {
        if (! $request->hasFile($field)) {
            return [];
        }

        return collect($request->file($field))
            ->filter()
            ->map(function ($file) use ($directory) {
                $path = $file->store($directory, 'public');

                return '/storage/'.$path;
            })
            ->values()
            ->all();
    }

    private function buildKitchenWalletSummary(User $user, int $outletId): array
    {
        $tenantOutletIds = $this->resolveKitchenTenantOutletIds($user, $outletId);

        $allocationQuery = TransactionTenantAllocation::query()
            ->where('outlet_id', $outletId)
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $builder) => $builder->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $builder) => $builder->whereRaw('1 = 0')
            );

        $allocationIds = (clone $allocationQuery)->pluck('id');
        $tenantSalesTotal = (int) ((clone $allocationQuery)->sum('grand_total') ?? 0);
        $baseTotal = (int) (TransactionTenantAllocationItem::query()
            ->whereIn('transaction_tenant_allocation_id', $allocationIds)
            ->selectRaw('COALESCE(SUM(base_unit_price * qty), 0) as total_base')
            ->value('total_base') ?? 0);

        $approvedTotal = (int) CashierSettlementRequest::query()
            ->where('outlet_id', $outletId)
            ->where('cashier_id', $user->id)
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_APPROVED)
            ->sum('approved_amount');

        $pendingTotal = (int) CashierSettlementRequest::query()
            ->where('outlet_id', $outletId)
            ->where('cashier_id', $user->id)
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_PENDING)
            ->sum('requested_amount');

        $receivableTotal = max(0, $tenantSalesTotal - $approvedTotal);
        $availableBalance = max(0, $tenantSalesTotal - $approvedTotal - $pendingTotal);

        return [
            'tenant_sales_total' => $tenantSalesTotal,
            'base_total' => $baseTotal,
            'approved_total' => $approvedTotal,
            'pending_total' => $pendingTotal,
            'receivable_total' => $receivableTotal,
            'available_balance' => $availableBalance,
        ];
    }

    private function resolveKitchenTenantOutletIds(User $user, int $activeOutletId): \Illuminate\Support\Collection
    {
        $preferredStationId = (int) ($user->preferred_kitchen_station_id ?? 0);

        return Product::query()
            ->whereNotNull('tenant_outlet_id')
            ->whereHas('kitchenStationMappings', function (Builder $query) use ($preferredStationId, $activeOutletId) {
                $query->where('is_active', true)
                    ->when(
                        $preferredStationId > 0,
                        fn (Builder $builder) => $builder->where('kitchen_station_id', $preferredStationId)
                    )
                    ->when(
                        $preferredStationId <= 0,
                        fn (Builder $builder) => $builder->whereHas(
                            'kitchenStation',
                            fn (Builder $stationQuery) => $stationQuery
                                ->where('outlet_id', $activeOutletId)
                                ->where('is_active', true)
                        )
                    );
            })
            ->pluck('tenant_outlet_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }
}
