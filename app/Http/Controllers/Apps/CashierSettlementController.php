<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\CashierSettlementRequest;
use App\Models\CashierShift;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\Setting;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\CashierShiftService;
use App\Services\OutletResolver;
use App\Support\ReportTimezone;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Hash;
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
        $isTenantRequestWorkspace = $this->isTenantRequestWorkspace($request);
        $visibleOutletIds = $this->resolveVisibleOutletIds($request, $outlet);

        $walletFilters = [
            'q' => trim((string) $request->input('q', '')),
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
            ->whereIn('outlet_id', $visibleOutletIds->all())
            ->when(! $canApprove, fn (Builder $builder) => $builder->where('cashier_id', $user->id))
            ->latest('created_at');

        $requests = (clone $query)
            ->paginate(15, ['*'], 'requests_page')
            ->withQueryString()
            ->through(fn (CashierSettlementRequest $settlement) => $this->transformSettlement($settlement));

        $summaryQuery = (clone $query)->get();
        $summary = [
            'pending_count' => $summaryQuery->where('status', CashierSettlementRequest::STATUS_PENDING)->count(),
            'approved_count' => $summaryQuery->where('status', CashierSettlementRequest::STATUS_APPROVED)->count(),
            'rejected_count' => $summaryQuery->where('status', CashierSettlementRequest::STATUS_REJECTED)->count(),
            'requested_total' => (int) $summaryQuery->where('status', CashierSettlementRequest::STATUS_PENDING)->sum('requested_amount'),
            'approved_total' => (int) $summaryQuery->where('status', CashierSettlementRequest::STATUS_APPROVED)->sum('approved_amount'),
        ];

        $cashierOptions = $canApprove
            ? User::query()
                ->whereHas('outlets', fn (Builder $builder) => $builder->whereIn('outlets.id', $visibleOutletIds->all()))
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
            ->whereHas('outlets', fn (Builder $builder) => $builder->whereIn('outlets.id', $visibleOutletIds->all()))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $recipient) => ['id' => $recipient->id, 'name' => $recipient->name])
            ->values();

        $defaultRecipientId = Setting::getInt('cashier_base_settlement_recipient_user_id', 0, $outlet->id);
        $wallet = $isTenantRequestWorkspace
            ? $this->buildKitchenWalletSummary($user, $outlet)
            : null;
        $walletTransactions = $isTenantRequestWorkspace
            ? $this->buildTenantWalletTransactions($user, $outlet, $walletFilters)
            : null;

        return Inertia::render('Dashboard/CashierSettlements/Index', [
            'walletFilters' => $walletFilters,
            'summary' => $summary,
            'requests' => $requests,
            'cashiers' => $cashierOptions,
            'shiftOptions' => $shiftOptions,
            'recipientOptions' => $recipientOptions,
            'defaultRecipientId' => $defaultRecipientId > 0 ? $defaultRecipientId : null,
            'canApprove' => $canApprove,
            'canCreateRequest' => $isTenantRequestWorkspace,
            'wallet' => $wallet,
            'walletTransactions' => $walletTransactions,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $outlet = $this->outletResolver->resolve($request, $user);
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');
        $isKitchenWorkspace = $user?->isKitchenWorkspace() ?? false;
        $isTenantRequestWorkspace = $this->isTenantRequestWorkspace($request);
        abort_unless($isTenantRequestWorkspace, 403, 'Pengajuan hanya bisa dibuat oleh tenant / dapur. Admin hanya dapat melakukan approval.');

        $data = $request->validate([
            'cashier_shift_id' => ['nullable', 'integer', 'exists:cashier_shifts,id'],
            'recipient_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'requested_notes' => ['nullable', 'string', 'max:500'],
            'requested_amount' => ['required', 'numeric', 'min:1'],
            'request_proof_photos' => ['nullable', 'array', 'max:6'],
            'request_proof_photos.*' => ['image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
        ]);

        $defaultRecipientId = Setting::getInt('cashier_base_settlement_recipient_user_id', 0, $outlet->id);
        $recipientUserId = $isTenantRequestWorkspace
            ? $defaultRecipientId
            : (int) ($data['recipient_user_id'] ?? 0);
        $recipientUser = $recipientUserId > 0 ? User::query()->find($recipientUserId) : null;
        if ($recipientUser && ! $recipientUser->hasAccessToOutlet((int) $outlet->id)) {
            $recipientUser = null;
        }
        $requestProofPhotos = $this->storeProofPhotos($request, 'request_proof_photos', 'cashier-settlements/request-proofs');
        $wallet = $this->buildKitchenWalletSummary($user, $outlet);
        $requestedAmount = (int) round((float) ($data['requested_amount'] ?? 0));

        abort_if($requestedAmount <= 0, 422, 'Nominal penarikan harus lebih dari nol.');
        abort_if($requestedAmount > (int) ($wallet['available_balance'] ?? 0), 422, 'Nominal penarikan melebihi saldo tersedia tenant.');

        $settlement = null;
        $prefixCode = $isKitchenWorkspace ? 'TWR' : 'CSR';

        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                $settlement = CashierSettlementRequest::create([
                    'outlet_id' => $outlet->id,
                    'cashier_id' => $user->id,
                    'request_number' => $this->nextRequestNumber($outlet->id, $prefixCode),
                    'recipient_user_id' => $recipientUser?->id,
                    'recipient_name' => $recipientUser?->name,
                    'requested_notes' => trim((string) ($data['requested_notes'] ?? '')),
                    'request_proof_photos' => $requestProofPhotos,
                    'status' => CashierSettlementRequest::STATUS_PENDING,
                    'cashier_shift_id' => null,
                    'business_date' => now()->toDateString(),
                    'gross_sales_total' => (int) ($wallet['gross_sales_total'] ?? 0),
                    'base_sales_total' => (int) ($wallet['tenant_sales_total'] ?? 0),
                    'markup_total' => (int) ($wallet['owner_markup_total'] ?? 0),
                    'requested_amount' => $requestedAmount,
                ]);

                break;
            } catch (UniqueConstraintViolationException $exception) {
                if ($attempt === 2) {
                    throw $exception;
                }
            }
        }

        abort_if(! $settlement, 500, 'Gagal membuat nomor pengajuan settlement yang unik.');

        $this->auditLogService->log(
            event: 'cashier_settlement.requested',
            module: 'cashier_settlements',
            auditable: $settlement,
            description: $isTenantRequestWorkspace
                ? 'Tenant / dapur membuat pengajuan penarikan dana ke owner outlet.'
                : 'Kasir membuat pengajuan setoran ke admin.',
            after: $this->settlementAuditPayload($settlement),
            meta: [
                'cashier_id' => $settlement->cashier_id,
                'cashier_shift_id' => $settlement->cashier_shift_id,
                'workspace' => $isKitchenWorkspace ? 'kitchen' : 'tenant',
            ],
        );

        return back()->with('success', $isTenantRequestWorkspace ? 'Pengajuan penarikan dana tenant berhasil dibuat.' : 'Pengajuan setoran kasir berhasil dibuat.');
    }

    public function approve(Request $request, CashierSettlementRequest $cashierSettlement): RedirectResponse
    {
        $approver = $request->user();
        abort_unless($this->canApprove($approver), 403);

        $settlement = $this->resolveVisibleSettlement($request, $cashierSettlement);
        abort_if($settlement->status !== CashierSettlementRequest::STATUS_PENDING, 422, 'Pengajuan ini tidak lagi menunggu approval.');

        $data = $request->validate([
            'password' => ['required', 'string'],
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

        if (! Hash::check($data['password'], $approver->password)) {
            return back()->withErrors(['password' => 'Password tidak sesuai.']);
        }

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
            'password' => ['required', 'string'],
            'rejection_reason' => ['required', 'string', 'max:500'],
        ]);

        if (! Hash::check($data['password'], $approver->password)) {
            return back()->withErrors(['password' => 'Password tidak sesuai.']);
        }

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
        return (bool) ($user?->isSuperAdmin() || $user?->can('cashier-settlements-approve'));
    }

    private function resolveVisibleSettlement(Request $request, CashierSettlementRequest $cashierSettlement): CashierSettlementRequest
    {
        $user = $request->user();
        $outlet = $this->outletResolver->resolve($request, $user);
        $visibleOutletIds = $this->resolveVisibleOutletIds($request, $outlet);

        return CashierSettlementRequest::query()
            ->with(['cashier:id,name', 'cashierShift:id,opened_at,closed_at,status', 'recipientUser:id,name', 'approvedBy:id,name', 'rejectedBy:id,name'])
            ->whereKey($cashierSettlement->id)
            ->whereIn('outlet_id', $visibleOutletIds->all())
            ->when(! $this->canApprove($user), fn (Builder $builder) => $builder->where('cashier_id', $user?->id))
            ->firstOrFail();
    }

    private function resolveVisibleOutletIds(Request $request, ?Outlet $activeOutlet): \Illuminate\Support\Collection
    {
        $user = $request->user();

        if (! $user) {
            return collect($activeOutlet?->id ? [(int) $activeOutlet->id] : []);
        }

        if (! $this->canApprove($user)) {
            return collect($activeOutlet?->id ? [(int) $activeOutlet->id] : []);
        }

        if ($user->isSuperAdmin()) {
            return Outlet::query()
                ->active()
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();
        }

        $outletIds = $user->outlets()
            ->active()
            ->pluck('outlets.id')
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($outletIds->isNotEmpty()) {
            $childTenantIds = Outlet::query()
                ->active()
                ->where('outlet_type', 'tenant')
                ->whereIn('parent_outlet_id', $outletIds->all())
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();

            return $outletIds
                ->merge($childTenantIds)
                ->unique()
                ->values();
        }

        return collect($activeOutlet?->id ? [(int) $activeOutlet->id] : []);
    }

    private function shiftOptionPayload(CashierShift $shift): array
    {
        $summary = $this->cashierShiftService->calculateBaseSettlementSummary($shift);

        return [
            'id' => $shift->id,
            'label' => 'Shift #'.$shift->id.' • '.(ReportTimezone::formatSourceDateTime($shift->getRawOriginal('opened_at'), 'd/m/Y H:i') ?? '-'),
            'status' => $shift->status,
            'opened_at' => ReportTimezone::formatSourceIso8601($shift->getRawOriginal('opened_at')),
            'closed_at' => ReportTimezone::formatSourceIso8601($shift->getRawOriginal('closed_at')),
            'gross_sales_total' => (int) $summary['gross_sales_total'],
            'base_sales_total' => (int) $summary['base_sales_total'],
            'pricing_discount_total' => (int) $summary['pricing_discount_total'],
            'pricing_reference_total' => (int) $summary['pricing_reference_total'],
            'markup_total' => (int) $summary['markup_total'],
            'requested_amount' => (int) $summary['base_sales_total'],
            'paid_transactions_count' => (int) $summary['paid_transactions_count'],
        ];
    }

    private function nextRequestNumber(int $outletId, string $prefixCode = 'CSR'): string
    {
        $prefix = $prefixCode.'-'.now()->format('dmy');
        $latestRequestNumber = CashierSettlementRequest::query()
            ->where('request_number', 'like', $prefix.'%')
            ->orderByDesc('request_number')
            ->value('request_number');

        $lastSequence = 0;

        if (is_string($latestRequestNumber) && str_starts_with($latestRequestNumber, $prefix)) {
            $suffix = substr($latestRequestNumber, strlen($prefix));
            $suffix = ltrim((string) $suffix, '-');

            if ($suffix !== '' && ctype_digit($suffix)) {
                $lastSequence = (int) $suffix;
            }
        }

        return $prefix.str_pad((string) ($lastSequence + 1), 3, '0', STR_PAD_LEFT);
    }

    private function transformSettlement(CashierSettlementRequest $settlement): array
    {
        return $this->transformSettlementModel($settlement);
    }

    private function transformSettlementModel(CashierSettlementRequest $settlement): array
    {
        $isTenantRequest = $settlement->cashier_shift_id === null;

        return [
            'id' => $settlement->id,
            'request_number' => $settlement->request_number,
            'business_date' => optional($settlement->business_date)?->toDateString(),
            'gross_sales_total' => (int) $settlement->gross_sales_total,
            'base_sales_total' => (int) $settlement->base_sales_total,
            'markup_total' => (int) $settlement->markup_total,
            'requested_amount' => (int) $settlement->requested_amount,
            'is_tenant_request' => $isTenantRequest,
            'settlement_reference_total' => (int) $settlement->gross_sales_total,
            'pricing_basis_total' => (int) $settlement->base_sales_total,
            'pricing_adjustment_total' => (int) $settlement->markup_total,
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
            'paid_at' => ReportTimezone::formatSourceIso8601($settlement->getRawOriginal('paid_at')),
            'approved_at' => ReportTimezone::formatSourceIso8601($settlement->getRawOriginal('approved_at')),
            'rejected_at' => ReportTimezone::formatSourceIso8601($settlement->getRawOriginal('rejected_at')),
            'rejection_reason' => $settlement->rejection_reason,
            'created_at' => ReportTimezone::formatSourceIso8601($settlement->getRawOriginal('created_at')),
            'cashier' => $settlement->cashier ? [
                'id' => $settlement->cashier->id,
                'name' => $settlement->cashier->name,
            ] : null,
            'cashier_shift' => $settlement->cashierShift ? [
                'id' => $settlement->cashierShift->id,
                'status' => $settlement->cashierShift->status,
                'opened_at' => ReportTimezone::formatSourceIso8601($settlement->cashierShift->getRawOriginal('opened_at')),
                'closed_at' => ReportTimezone::formatSourceIso8601($settlement->cashierShift->getRawOriginal('closed_at')),
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
            'settlement_reference_total' => (int) $settlement->gross_sales_total,
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

    private function buildKitchenWalletSummary(User $user, Outlet $activeOutlet): array
    {
        $allocationQuery = $this->buildTenantWalletAllocationQuery($user, $activeOutlet);

        $allocationIds = (clone $allocationQuery)->pluck('id');
        $grossSalesTotal = $allocationIds->isNotEmpty()
            ? (int) ((clone $allocationQuery)->sum('subtotal') ?? 0)
            : 0;
        $tenantNetTotal = $this->sumTenantNetValueForAllocationIds($allocationIds);
        $ownerMarkupTotal = $this->sumOwnerMarkupValueForAllocationIds($allocationIds);
        $prePromoReferenceTotal = $allocationIds->isNotEmpty()
            ? (int) ((clone $allocationQuery)->sum('subtotal') + (clone $allocationQuery)->sum('promo_discount_total'))
            : 0;

        $approvedTotal = (int) CashierSettlementRequest::query()
            ->where('outlet_id', $activeOutlet->id)
            ->where('cashier_id', $user->id)
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_APPROVED)
            ->sum('approved_amount');

        $pendingTotal = (int) CashierSettlementRequest::query()
            ->where('outlet_id', $activeOutlet->id)
            ->where('cashier_id', $user->id)
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_PENDING)
            ->sum('requested_amount');

        $receivableTotal = max(0, $tenantNetTotal - $approvedTotal);
        $availableBalance = max(0, $tenantNetTotal - $approvedTotal - $pendingTotal);

        return [
            'tenant_sales_total' => $tenantNetTotal,
            'gross_sales_total' => $grossSalesTotal,
            'base_total' => $prePromoReferenceTotal,
            'pricing_discount_total' => max(0, $prePromoReferenceTotal - $grossSalesTotal),
            'owner_markup_total' => $ownerMarkupTotal,
            'approved_total' => $approvedTotal,
            'pending_total' => $pendingTotal,
            'receivable_total' => $receivableTotal,
            'available_balance' => $availableBalance,
        ];
    }

    private function buildTenantWalletTransactions(User $user, Outlet $activeOutlet, array $filters)
    {
        $allocationQuery = $this->applyTenantWalletFilters(
            $this->buildTenantWalletAllocationQuery($user, $activeOutlet),
            $filters
        );

        $allocationPaginator = $allocationQuery
            ->with([
                'transaction.customer:id,name',
                'transaction.cashier:id,name',
                'tenantOutlet:id,name,code',
                'items.transactionDetail.product:id,title',
                'items.transactionDetail.modifiers',
            ])
            ->latest('delivered_at')
            ->paginate(15, ['*'], 'wallet_page')
            ->withQueryString();

        $tenantNetTotals = $this->tenantNetTotalsByAllocationIds($allocationPaginator->getCollection()->pluck('id'));
        $ownerMarkupTotals = $this->ownerMarkupTotalsByAllocationIds($allocationPaginator->getCollection()->pluck('id'));

        $allocationRows = $allocationPaginator->getCollection()->map(function (TransactionTenantAllocation $allocation) use ($tenantNetTotals, $ownerMarkupTotals) {
                $tenantNetTotal = (int) ($tenantNetTotals->get($allocation->id, 0) ?? 0);
                $grossAfterPromo = (int) ($allocation->subtotal ?? 0);
                $ownerMarkupTotal = (int) ($ownerMarkupTotals->get($allocation->id, 0) ?? 0);

                return [
                    'id' => 'allocation-'.$allocation->id,
                    'entry_type' => 'allocation',
                    'entry_label' => 'Masuk Saldo',
                    'allocation_number' => $allocation->allocation_number,
                    'invoice' => $allocation->transaction?->invoice ?? $allocation->allocation_number,
                    'customer_name' => $allocation->transaction?->customer?->name ?? 'Pelanggan umum',
                    'cashier_name' => $allocation->transaction?->cashier?->name ?? '-',
                    'tenant_outlet' => $allocation->tenantOutlet ? [
                        'id' => $allocation->tenantOutlet->id,
                        'name' => $allocation->tenantOutlet->name,
                        'code' => $allocation->tenantOutlet->code,
                    ] : null,
                    'payment_method' => $allocation->transaction?->payment_method,
                    'payment_status' => $allocation->transaction?->payment_status ?? $allocation->payment_status,
                    'gross_sales_total' => $grossAfterPromo,
                    'tenant_sales_total' => $tenantNetTotal,
                    'owner_markup_total' => $ownerMarkupTotal,
                    'pricing_discount_total' => (int) ($allocation->promo_discount_total ?? 0),
                    'delivered_at' => ReportTimezone::formatSourceIso8601($allocation->getRawOriginal('delivered_at')),
                    'created_at' => ReportTimezone::formatSourceIso8601($allocation->transaction?->getRawOriginal('created_at')),
                    'activity_at' => ReportTimezone::formatSourceIso8601($allocation->getRawOriginal('delivered_at')),
                    'details' => $allocation->items->map(function ($item) {
                        $detail = $item->transactionDetail;
                        $remainingQty = (int) ($item->qty ?? 0);
                        $tenantBaseUnitPrice = (int) ($detail?->tenant_base_unit_price ?? $item->base_unit_price ?? 0);
                        $ownerMarkupUnitPrice = (int) ($detail?->owner_markup_unit_price ?? 0);
                        $customerUnitPrice = (int) ($detail?->customer_base_unit_price ?? $detail?->unit_price ?? 0);

                        return [
                            'id' => $detail?->id ?? $item->transaction_detail_id,
                            'product_title' => $detail?->product?->title ?? 'Produk terhapus',
                            'qty' => $remainingQty,
                            'customer_unit_price' => $customerUnitPrice,
                            'line_total' => $customerUnitPrice * $remainingQty,
                            'tenant_base_unit_price' => $tenantBaseUnitPrice,
                            'tenant_net_total' => (int) ($item->line_total ?? ($tenantBaseUnitPrice * $remainingQty)),
                            'owner_markup_unit_price' => $ownerMarkupUnitPrice,
                            'owner_net_total' => $ownerMarkupUnitPrice * $remainingQty,
                            'discount_total' => (int) ($item->discount_total ?? 0),
                            'notes' => $detail?->notes,
                            'modifiers' => $detail?->modifiers
                                ? $detail->modifiers->map(fn ($modifier) => [
                                    'id' => $modifier->id,
                                    'name' => $modifier->name,
                                    'qty' => (int) $modifier->qty,
                                    'unit_price' => (int) $modifier->unit_price,
                                    'total_price' => (int) $modifier->total_price,
                                ])->values()->all()
                                : [],
                        ];
                    })->values()->all(),
                ];
            })->values();

        $returnRows = $this->buildTenantWalletReturnRows($user, $activeOutlet, $filters);

        $combinedRows = $allocationRows
            ->merge($returnRows)
            ->sortByDesc(fn (array $row) => strtotime((string) ($row['activity_at'] ?? $row['delivered_at'] ?? $row['created_at'] ?? now()->toIso8601String())))
            ->values();

        $currentPage = max(1, (int) request()->integer('wallet_page', 1));
        $perPage = 15;
        $pageRows = $combinedRows->slice(($currentPage - 1) * $perPage, $perPage)->values();

        return new LengthAwarePaginator(
            $pageRows,
            $combinedRows->count(),
            $perPage,
            $currentPage,
            [
                'path' => request()->url(),
                'pageName' => 'wallet_page',
                'query' => request()->query(),
            ]
        );
    }

    private function buildTenantWalletAllocationQuery(User $user, Outlet $activeOutlet): Builder
    {
        $tenantOutletIds = $this->resolveKitchenTenantOutletIds($user, $activeOutlet->id);
        $allocationOutletId = (string) ($activeOutlet->outlet_type ?? '') === 'tenant'
            ? 0
            : $activeOutlet->id;

        return TransactionTenantAllocation::query()
            ->when($allocationOutletId > 0, fn (Builder $builder) => $builder->where('outlet_id', $allocationOutletId))
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                $tenantOutletIds->isNotEmpty(),
                fn (Builder $builder) => $builder->whereIn('tenant_outlet_id', $tenantOutletIds->all()),
                fn (Builder $builder) => $builder->whereRaw('1 = 0')
            );
    }

    private function applyTenantWalletFilters(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['q'] !== '', function (Builder $builder) use ($filters) {
                $builder->where(function (Builder $nested) use ($filters) {
                    $nested
                        ->where('allocation_number', 'like', '%'.$filters['q'].'%')
                        ->orWhereHas('transaction', function (Builder $transactionQuery) use ($filters) {
                            $transactionQuery
                                ->where('invoice', 'like', '%'.$filters['q'].'%')
                                ->orWhereHas('customer', fn (Builder $customerQuery) => $customerQuery->where('name', 'like', '%'.$filters['q'].'%'))
                                ->orWhereHas('cashier', fn (Builder $cashierQuery) => $cashierQuery->where('name', 'like', '%'.$filters['q'].'%'));
                        });
                });
            })
            ->when($filters['cashier_id'] !== '', fn (Builder $builder) => $builder->where('cashier_id', (int) $filters['cashier_id']));

        return ReportTimezone::applySourceDateRange($query, 'delivered_at', [
            'start_date' => $filters['date_from'] ?? '',
            'end_date' => $filters['date_to'] ?? '',
        ]);
    }

    private function buildTenantWalletReturnRows(User $user, Outlet $activeOutlet, array $filters): \Illuminate\Support\Collection
    {
        $tenantOutletIds = $this->resolveKitchenTenantOutletIds($user, $activeOutlet->id);

        if ($tenantOutletIds->isEmpty()) {
            return collect();
        }

        $salesReturns = SalesReturn::query()
            ->with([
                'transaction.customer:id,name',
                'transaction.cashier:id,name',
                'items.product:id,title',
                'items.transactionDetail.product:id,title',
                'items.transactionDetail.modifiers',
            ])
            ->where('status', 'completed')
            ->whereHas('items.transactionDetail', fn (Builder $builder) => $builder->whereIn('tenant_outlet_id', $tenantOutletIds->all()))
            ->when($filters['q'] !== '', function (Builder $builder) use ($filters) {
                $builder->where(function (Builder $nested) use ($filters) {
                    $nested
                        ->where('code', 'like', '%'.$filters['q'].'%')
                        ->orWhereHas('transaction', function (Builder $transactionQuery) use ($filters) {
                            $transactionQuery
                                ->where('invoice', 'like', '%'.$filters['q'].'%')
                                ->orWhereHas('customer', fn (Builder $customerQuery) => $customerQuery->where('name', 'like', '%'.$filters['q'].'%'))
                                ->orWhereHas('cashier', fn (Builder $cashierQuery) => $cashierQuery->where('name', 'like', '%'.$filters['q'].'%'));
                        });
                });
            })
            ->when($filters['cashier_id'] !== '', fn (Builder $builder) => $builder->where('cashier_id', (int) $filters['cashier_id']))
            ->latest('completed_at')
            ->tap(fn (Builder $builder) => ReportTimezone::applySourceDateRange($builder, 'completed_at', [
                'start_date' => $filters['date_from'] ?? '',
                'end_date' => $filters['date_to'] ?? '',
            ]))
            ->get();

        return $salesReturns->map(function (SalesReturn $salesReturn) use ($tenantOutletIds, $activeOutlet) {
            $relevantItems = $salesReturn->items
                ->filter(fn ($item) => $tenantOutletIds->contains((int) ($item->transactionDetail?->tenant_outlet_id ?? 0)))
                ->values();

            $grossSalesTotal = 0;
            $tenantSalesTotal = 0;
            $ownerMarkupTotal = 0;
            $pricingDiscountTotal = 0;

            $details = $relevantItems->map(function ($item) use (&$grossSalesTotal, &$tenantSalesTotal, &$ownerMarkupTotal, &$pricingDiscountTotal) {
                $detail = $item->transactionDetail;
                $qty = (int) ($item->qty_return ?? 0);
                $customerUnitPrice = (int) ($detail?->customer_base_unit_price ?? $detail?->unit_price ?? 0);
                $tenantBaseUnitPrice = (int) ($detail?->tenant_base_unit_price ?? 0);
                $ownerMarkupUnitPrice = (int) ($detail?->owner_markup_unit_price ?? 0);
                $discountUnitValue = max(0, (int) round(((int) ($detail?->discount_total ?? 0)) / max(1, (int) ($detail?->qty ?? 1))));

                $lineTotal = $customerUnitPrice * $qty;
                $tenantNetTotal = (int) ($detail?->tenant_net_total ?? 0) > 0
                    ? (int) round(((int) $detail->tenant_net_total / max(1, (int) ($detail->qty ?? 1))) * $qty)
                    : $tenantBaseUnitPrice * $qty;
                $ownerNetTotal = (int) ($detail?->owner_net_total ?? 0) > 0
                    ? (int) round(((int) $detail->owner_net_total / max(1, (int) ($detail->qty ?? 1))) * $qty)
                    : $ownerMarkupUnitPrice * $qty;
                $discountTotal = $discountUnitValue * $qty;

                $grossSalesTotal += $lineTotal;
                $tenantSalesTotal += $tenantNetTotal;
                $ownerMarkupTotal += $ownerNetTotal;
                $pricingDiscountTotal += $discountTotal;

                return [
                    'id' => 'return-item-'.$item->id,
                    'product_title' => $detail?->product?->title ?? $item->product?->title ?? 'Produk terhapus',
                    'qty' => -$qty,
                    'customer_unit_price' => $customerUnitPrice,
                    'line_total' => -$lineTotal,
                    'tenant_base_unit_price' => $tenantBaseUnitPrice,
                    'tenant_net_total' => -$tenantNetTotal,
                    'owner_markup_unit_price' => $ownerMarkupUnitPrice,
                    'owner_net_total' => -$ownerNetTotal,
                    'discount_total' => -$discountTotal,
                    'notes' => $item->return_reason,
                    'modifiers' => $detail?->modifiers
                        ? $detail->modifiers->map(fn ($modifier) => [
                            'id' => $modifier->id,
                            'name' => $modifier->name,
                            'qty' => (int) $modifier->qty,
                            'unit_price' => (int) $modifier->unit_price,
                            'total_price' => (int) $modifier->total_price,
                        ])->values()->all()
                        : [],
                ];
            })->values()->all();

            return [
                'id' => 'return-'.$salesReturn->id,
                'entry_type' => 'sales_return',
                'entry_label' => 'Retur',
                'allocation_number' => $salesReturn->code,
                'invoice' => $salesReturn->transaction?->invoice ?? $salesReturn->code,
                'customer_name' => $salesReturn->transaction?->customer?->name ?? 'Pelanggan umum',
                'cashier_name' => $salesReturn->transaction?->cashier?->name ?? ($salesReturn->cashier?->name ?? '-'),
                'tenant_outlet' => [
                    'id' => $activeOutlet->id,
                    'name' => $activeOutlet->name,
                    'code' => $activeOutlet->code,
                ],
                'payment_method' => $salesReturn->transaction?->payment_method,
                'payment_status' => 'retur',
                'gross_sales_total' => -$grossSalesTotal,
                'tenant_sales_total' => -$tenantSalesTotal,
                'owner_markup_total' => -$ownerMarkupTotal,
                'pricing_discount_total' => -$pricingDiscountTotal,
                'delivered_at' => ReportTimezone::formatSourceIso8601($salesReturn->getRawOriginal('completed_at')),
                'created_at' => ReportTimezone::formatSourceIso8601($salesReturn->getRawOriginal('created_at')),
                'activity_at' => ReportTimezone::formatSourceIso8601($salesReturn->getRawOriginal('completed_at')),
                'details' => $details,
            ];
        })->filter(fn (array $row) => ! empty($row['details']))->values();
    }

    private function sumTenantNetValueForAllocationIds(\Illuminate\Support\Collection $allocationIds): int
    {
        if ($allocationIds->isEmpty()) {
            return 0;
        }

        return (int) ($this->tenantNetTotalsByAllocationIds($allocationIds)->sum() ?? 0);
    }

    private function sumOwnerMarkupValueForAllocationIds(\Illuminate\Support\Collection $allocationIds): int
    {
        if ($allocationIds->isEmpty()) {
            return 0;
        }

        return (int) ($this->ownerMarkupTotalsByAllocationIds($allocationIds)->sum() ?? 0);
    }

    private function tenantNetTotalsByAllocationIds(\Illuminate\Support\Collection $allocationIds): \Illuminate\Support\Collection
    {
        if ($allocationIds->isEmpty()) {
            return collect();
        }

        return TransactionTenantAllocationItem::query()
            ->join('transaction_details', 'transaction_details.id', '=', 'transaction_tenant_allocation_items.transaction_detail_id')
            ->whereIn('transaction_tenant_allocation_id', $allocationIds->all())
            ->selectRaw('transaction_tenant_allocation_id, COALESCE(SUM(CASE WHEN transaction_details.qty > 0 THEN (CASE WHEN transaction_details.tenant_net_total > 0 THEN ROUND(transaction_details.tenant_net_total / transaction_details.qty) WHEN transaction_details.tenant_base_unit_price > 0 THEN transaction_details.tenant_base_unit_price ELSE transaction_tenant_allocation_items.base_unit_price END) * transaction_tenant_allocation_items.qty ELSE COALESCE(transaction_tenant_allocation_items.line_total, 0) END), 0) as total_tenant_net_value')
            ->groupBy('transaction_tenant_allocation_id')
            ->pluck('total_tenant_net_value', 'transaction_tenant_allocation_id')
            ->map(fn ($value) => (int) $value);
    }

    private function ownerMarkupTotalsByAllocationIds(\Illuminate\Support\Collection $allocationIds): \Illuminate\Support\Collection
    {
        if ($allocationIds->isEmpty()) {
            return collect();
        }

        return TransactionTenantAllocationItem::query()
            ->join('transaction_details', 'transaction_details.id', '=', 'transaction_tenant_allocation_items.transaction_detail_id')
            ->whereIn('transaction_tenant_allocation_id', $allocationIds->all())
            ->selectRaw('transaction_tenant_allocation_id, COALESCE(SUM(CASE WHEN transaction_details.qty > 0 THEN (CASE WHEN transaction_details.owner_net_total > 0 THEN ROUND(transaction_details.owner_net_total / transaction_details.qty) WHEN transaction_details.owner_markup_unit_price > 0 THEN transaction_details.owner_markup_unit_price ELSE GREATEST(COALESCE(transaction_tenant_allocation_items.line_total, 0) - (COALESCE(transaction_tenant_allocation_items.base_unit_price, 0) * transaction_tenant_allocation_items.qty), 0) / GREATEST(transaction_tenant_allocation_items.qty, 1) END) * transaction_tenant_allocation_items.qty ELSE GREATEST(COALESCE(transaction_tenant_allocation_items.line_total, 0) - (COALESCE(transaction_tenant_allocation_items.base_unit_price, 0) * transaction_tenant_allocation_items.qty), 0) END), 0) as total_owner_markup_value')
            ->groupBy('transaction_tenant_allocation_id')
            ->pluck('total_owner_markup_value', 'transaction_tenant_allocation_id')
            ->map(fn ($value) => (int) $value);
    }

    private function resolveKitchenTenantOutletIds(User $user, int $activeOutletId): \Illuminate\Support\Collection
    {
        if (! $user->isKitchenWorkspace()) {
            return collect([$activeOutletId]);
        }

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

    private function isTenantRequestWorkspace(Request $request): bool
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);

        return (bool) ($user?->isKitchenWorkspace() || (string) ($activeOutlet?->outlet_type ?? '') === 'tenant');
    }
}
