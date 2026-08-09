<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\CashierSettlementRequest;
use App\Models\CashierShift;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\TransactionTenantAllocation;
use App\Models\TransactionTenantAllocationItem;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\CashierShiftService;
use App\Services\FoodcourtTenantAllocationService;
use App\Services\ModifierMarkupService;
use App\Services\OutletResolver;
use App\Support\ReportTimezone;
use App\Support\TenantWalletMetrics;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
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
        private readonly ModifierMarkupService $modifierMarkupService,
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
            'entry_type' => (string) $request->input('entry_type', ''),
            'payment_method' => (string) $request->input('payment_method', ''),
        ];

        $canApprove = $this->canApprove($user);

        $tenantSettlementOutletIds = $isTenantRequestWorkspace
            ? $this->resolveTenantSettlementOutletIds($user, $outlet)
            : collect();
        $requestOutletIds = $isTenantRequestWorkspace
            ? $tenantSettlementOutletIds
            : $visibleOutletIds;

        $query = CashierSettlementRequest::query()
            ->with([
                'cashier:id,name',
                'cashierShift:id,opened_at,closed_at,status',
                'recipientUser:id,name',
                'approvedBy:id,name',
                'rejectedBy:id,name',
            ])
            ->whereIn('outlet_id', $requestOutletIds->all())
            ->when($this->shouldScopeSettlementRequestsToUser($user, $isTenantRequestWorkspace), fn (Builder $builder) => $builder->where('cashier_id', $user->id))
            ->latest('created_at');

        $requests = (clone $query)
            ->paginate(15, ['*'], 'requests_page')
            ->withQueryString()
            ->through(fn (CashierSettlementRequest $settlement) => $this->transformSettlement($settlement));

        $summary = [
            'pending_count' => (clone $query)->where('status', CashierSettlementRequest::STATUS_PENDING)->count(),
            'approved_count' => (clone $query)->where('status', CashierSettlementRequest::STATUS_APPROVED)->count(),
            'rejected_count' => (clone $query)->where('status', CashierSettlementRequest::STATUS_REJECTED)->count(),
            'requested_total' => (int) (clone $query)->where('status', CashierSettlementRequest::STATUS_PENDING)->sum('requested_amount'),
            'approved_total' => (int) (clone $query)->where('status', CashierSettlementRequest::STATUS_APPROVED)->sum('approved_amount'),
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
        $ownerOverview = ! $isTenantRequestWorkspace
            ? $this->buildOwnerSettlementOverview($outlet, $visibleOutletIds)
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
            'ownerOverview' => $ownerOverview,
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

        $settlementOutletIds = $this->resolveTenantSettlementOutletIds($user, $outlet);
        abort_if($settlementOutletIds->count() !== 1, 422, 'Workspace tenant ini harus terhubung ke tepat satu tenant untuk mengajukan pencairan.');

        $settlement = null;
        $prefixCode = $isKitchenWorkspace ? 'TWR' : 'CSR';

        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                $settlement = CashierSettlementRequest::create([
                    'outlet_id' => (int) $settlementOutletIds->first(),
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

    public function repairUnallocated(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        $user = $request->user();
        abort_unless($user?->can('cashier-settlements-repair'), 403);

        $outlet = $this->outletResolver->resolve($request, $user);
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');

        $visibleOutletIds = $this->resolveVisibleOutletIds($request, $outlet);
        $tenantOutletIds = $this->resolveOwnerSettlementTenantOutletIds($outlet, $visibleOutletIds);

        if ($tenantOutletIds->isEmpty()) {
            return back()->with('success', 'Tidak ada tenant outlet dalam scope yang dapat diperbaiki.');
        }

        $allocationTransactionIds = TransactionTenantAllocation::query()
            ->whereIn('tenant_outlet_id', $tenantOutletIds->all())
            ->distinct('transaction_id')
            ->pluck('transaction_id');

        $repairableTransactions = Transaction::query()
            ->with(['details'])
            ->whereNotIn('id', $allocationTransactionIds)
            ->whereHas('details', function (Builder $builder) use ($tenantOutletIds) {
                $builder->whereIn('tenant_outlet_id', $tenantOutletIds->all());
            })
            ->limit(200)
            ->get();

        $repaired = 0;
        foreach ($repairableTransactions as $transaction) {
            try {
                $this->foodcourtTenantAllocationService->rebuildForTransaction($transaction->fresh(['details']));
                $repaired++;
            } catch (\Throwable $exception) {
                // Abort repair for individual transaction failures; continue with the next transaction.
            }
        }

        return back()->with('success', "Pembenaran alokasi tenant selesai. {$repaired} transaksi berhasil diperbaiki.");
    }

    public function unallocatedTransactions(Request $request): \Symfony\Component\HttpFoundation\JsonResponse
    {
        $user = $request->user();
        abort_unless($user?->can('cashier-settlements-access'), 403);

        $outlet = $this->outletResolver->resolve($request, $user);
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');

        $visibleOutletIds = $this->resolveVisibleOutletIds($request, $outlet);
        $tenantOutletIds = $this->resolveOwnerSettlementTenantOutletIds($outlet, $visibleOutletIds);

        if ($tenantOutletIds->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $returnTransactionIds = SalesReturn::query()
            ->where('status', 'completed')
            ->whereHas('items.transactionDetail', fn (Builder $builder) => $builder->whereIn('tenant_outlet_id', $tenantOutletIds->all()))
            ->pluck('transaction_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $allocationTransactionIds = TransactionTenantAllocation::query()
            ->when(
                (string) ($outlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $outlet->id)
            )
            ->whereIn('tenant_outlet_id', $tenantOutletIds->all())
            ->distinct('transaction_id')
            ->pluck('transaction_id');

        $tenantNames = Outlet::query()
            ->whereIn('id', $tenantOutletIds->all())
            ->get(['id', 'name', 'code'])
            ->keyBy('id');

        $filters = [
            'q' => trim((string) $request->input('q', '')),
            'date_from' => (string) $request->input('date_from', ''),
            'date_to' => (string) $request->input('date_to', ''),
            'payment_method' => (string) $request->input('payment_method', ''),
            'payment_status' => (string) $request->input('payment_status', ''),
        ];

        $perPage = (int) $request->input('per_page', 15);
        $perPage = in_array($perPage, [10, 15, 25, 50]) ? $perPage : 15;

        $query = Transaction::query()
            ->with(['details.product'])
            ->when(
                (string) ($outlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $outlet->id)
            )
            ->when(
                (string) ($outlet->outlet_type ?? '') === 'tenant',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $outlet->id)
            )
            ->when($filters['q'] !== '', function (Builder $builder) use ($filters) {
                $builder->where(function (Builder $nested) use ($filters) {
                    $nested
                        ->where('invoice', 'like', '%'.$filters['q'].'%')
                        ->orWhereHas('customer', fn (Builder $customerQuery) => $customerQuery->where('name', 'like', '%'.$filters['q'].'%'));
                });
            })
            ->when($filters['payment_method'] !== '', fn (Builder $builder) => $builder->where('payment_method', $filters['payment_method']))
            ->when($filters['payment_status'] !== '', fn (Builder $builder) => $builder->where('payment_status', $filters['payment_status']))
            ->when($filters['date_from'] !== '', fn (Builder $builder) => $builder->whereDate('created_at', '>=', $filters['date_from']))
            ->when($filters['date_to'] !== '', fn (Builder $builder) => $builder->whereDate('created_at', '<=', $filters['date_to']))
            ->whereNotIn('id', $allocationTransactionIds)
            ->whereNotIn('id', $returnTransactionIds)
            ->orderByDesc('created_at');

        $paginator = $query->paginate($perPage)->appends($request->except('page'));

        $rows = $paginator->getCollection()->map(function ($transaction) use ($tenantOutletIds) {
            $details = $transaction->details ?? collect();
            $reason = 'Tidak teralokasi';
            $detailTenantIds = [];
            $scopeTenantIds = $tenantOutletIds->values()->all();
            $inScopeTenantIds = [];

            if ($details->isNotEmpty()) {
                $detailTenantIds = $details
                    ->filter(fn ($detail) => (int) ($detail->tenant_outlet_id ?? 0) > 0)
                    ->pluck('tenant_outlet_id')
                    ->unique()
                    ->values()
                    ->all();

                $inScopeTenantIds = $details
                    ->filter(fn ($detail) => $tenantOutletIds->contains((int) ($detail->tenant_outlet_id ?? 0)))
                    ->pluck('tenant_outlet_id')
                    ->unique()
                    ->values()
                    ->all();
            }

            if ($details->isEmpty()) {
                $reason = 'Tidak ada detail transaksi';
            } elseif (empty($detailTenantIds)) {
                $reason = 'Detail transaksi tanpa tenant_outlet_id';
            } elseif (!empty($detailTenantIds) && empty($inScopeTenantIds)) {
                $reason = 'Tenant pada detail tidak termasuk scope aktif: ' . implode(', ', $detailTenantIds);
            } elseif (!empty($detailTenantIds) && !empty($inScopeTenantIds)) {
                $reason = 'Tidak ada alokasi tenant untuk transaksi ini';
            }

            return [
                'transaction_id' => (int) $transaction->id,
                'invoice' => $transaction->invoice ?? '-',
                'customer_name' => $transaction->customer?->name ?? '-',
                'grand_total' => (int) ($transaction->grand_total ?? 0),
                'payment_status' => $transaction->payment_status ?? '-',
                'payment_method' => $transaction->payment_method ?? '-',
                'created_at' => $transaction->created_at ? ReportTimezone::formatSourceDateTime($transaction->getRawOriginal('created_at'), 'd M H:i') : null,
                'reason' => $reason,
                'detail_tenant_ids' => $detailTenantIds,
                'scope_tenant_ids' => $scopeTenantIds,
                'products' => $details->map(fn ($detail) => [
                    'product_name' => $detail->product?->title ?? 'Produk tidak ditemukan',
                    'qty' => (int) ($detail->qty ?? 0),
                    'unit_price' => (int) ($detail->unit_price ?? 0),
                    'tenant_outlet_id' => (int) ($detail->tenant_outlet_id ?? 0),
                ])->values()->all(),
            ];
        })->values()->all();

        return response()->json([
            'data' => $rows,
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }

    public function returnTransactions(Request $request): \Symfony\Component\HttpFoundation\JsonResponse
    {
        $user = $request->user();
        abort_unless($user?->can('cashier-settlements-access'), 403);

        $outlet = $this->outletResolver->resolve($request, $user);
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');

        $visibleOutletIds = $this->resolveVisibleOutletIds($request, $outlet);
        $tenantOutletIds = $this->resolveOwnerSettlementTenantOutletIds($outlet, $visibleOutletIds);

        if ($tenantOutletIds->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $tenantNames = Outlet::query()
            ->whereIn('id', $tenantOutletIds->all())
            ->get(['id', 'name', 'code'])
            ->keyBy('id');

        $filters = [
            'q' => trim((string) $request->input('q', '')),
            'date_from' => (string) $request->input('date_from', ''),
            'date_to' => (string) $request->input('date_to', ''),
        ];

        $perPage = (int) $request->input('per_page', 15);
        $perPage = in_array($perPage, [10, 15, 25, 50]) ? $perPage : 15;

        $query = SalesReturn::query()
            ->with(['items.transactionDetail.product', 'transaction.customer', 'cashier', 'cashierShift'])
            ->where('status', 'completed')
            ->whereHas('items.transactionDetail', fn (Builder $builder) => $builder->whereIn('tenant_outlet_id', $tenantOutletIds->all()))
            ->when($filters['q'] !== '', function (Builder $builder) use ($filters) {
                $builder->where(function (Builder $nested) use ($filters) {
                    $nested
                        ->where('code', 'like', '%'.$filters['q'].'%')
                        ->orWhereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery
                            ->where('invoice', 'like', '%'.$filters['q'].'%')
                            ->orWhereHas('customer', fn (Builder $customerQuery) => $customerQuery->where('name', 'like', '%'.$filters['q'].'%'))
                        );
                });
            })
            ->when($filters['date_from'] !== '', fn (Builder $builder) => $builder->whereDate('completed_at', '>=', $filters['date_from']))
            ->when($filters['date_to'] !== '', fn (Builder $builder) => $builder->whereDate('completed_at', '<=', $filters['date_to']))
            ->orderByDesc('completed_at');

        $paginator = $query->paginate($perPage)->appends($request->except('page'));

        $rows = $paginator->getCollection()->map(function ($salesReturn) use ($tenantOutletIds, $tenantNames) {
            $items = $salesReturn->items->map(function ($item) use ($tenantOutletIds, $tenantNames, $salesReturn) {
                $detail = $item->transactionDetail;
                if (! $detail || ! $tenantOutletIds->contains((int) ($detail->tenant_outlet_id ?? 0))) {
                    return null;
                }

                $qty = (int) ($item->qty_return ?? 0);
                $customerUnitPrice = (int) ($detail->customer_base_unit_price ?? $detail->unit_price ?? 0);
                $tenantBaseUnitPrice = (int) ($detail->tenant_base_unit_price ?? 0);
                $ownerMarkupUnitPrice = (int) ($detail->owner_markup_unit_price ?? 0);

                return [
                    'sales_return_id' => (int) $salesReturn->id,
                    'code' => $salesReturn->code,
                    'transaction_id' => (int) ($salesReturn->transaction_id ?? 0),
                    'invoice' => $salesReturn->transaction?->invoice ?? '-',
                    'customer_name' => $salesReturn->transaction?->customer?->name ?? '-',
                    'completed_at' => $salesReturn->completed_at ? ReportTimezone::formatSourceDateTime($salesReturn->getRawOriginal('completed_at'), 'd M Y H:i') : null,
                    'qty_return' => $qty,
                    'customer_unit_price' => $customerUnitPrice,
                    'tenant_base_unit_price' => $tenantBaseUnitPrice,
                    'owner_markup_unit_price' => $ownerMarkupUnitPrice,
                    'tenant_outlet_id' => (int) ($detail->tenant_outlet_id ?? 0),
                    'tenant_name' => $tenantNames->get((int) ($detail->tenant_outlet_id ?? 0))?->name ?? 'Tenant',
                    'product_name' => $detail->product?->title ?? 'Produk tidak ditemukan',
                ];
            })->filter()->values()->all();

            return [
                'sales_return_id' => (int) $salesReturn->id,
                'code' => $salesReturn->code,
                'transaction_id' => (int) ($salesReturn->transaction_id ?? 0),
                'invoice' => $salesReturn->transaction?->invoice ?? '-',
                'customer_name' => $salesReturn->transaction?->customer?->name ?? '-',
                'completed_at' => $salesReturn->completed_at ? ReportTimezone::formatSourceDateTime($salesReturn->getRawOriginal('completed_at'), 'd M Y H:i') : null,
                'return_type' => $salesReturn->return_type,
                'refund_amount' => (int) ($salesReturn->refund_amount ?? 0),
                'credited_amount' => (int) ($salesReturn->credited_amount ?? 0),
                'total_return_amount' => (int) ($salesReturn->total_return_amount ?? 0),
                'status' => $salesReturn->status,
                'items' => $items,
            ];
        })->values()->all();

        return response()->json([
            'data' => $rows,
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
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
        $visibleOutletIds = $this->isTenantRequestWorkspace($request)
            ? $this->resolveTenantSettlementOutletIds($user, $outlet)
            : $this->resolveVisibleOutletIds($request, $outlet);

        return CashierSettlementRequest::query()
            ->with(['cashier:id,name', 'cashierShift:id,opened_at,closed_at,status', 'recipientUser:id,name', 'approvedBy:id,name', 'rejectedBy:id,name'])
            ->whereKey($cashierSettlement->id)
            ->whereIn('outlet_id', $visibleOutletIds->all())
            ->when(
                $this->shouldScopeSettlementRequestsToUser($user, $this->isTenantRequestWorkspace($request)),
                fn (Builder $builder) => $builder->where('cashier_id', $user?->id)
            )
            ->firstOrFail();
    }

    private function shouldScopeSettlementRequestsToUser(?User $user, bool $isTenantRequestWorkspace): bool
    {
        return ! $isTenantRequestWorkspace && ! $this->canApprove($user);
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

        if (($activeOutlet?->outlet_type ?? 'main') === 'tenant' && $activeOutlet?->id) {
            return collect([(int) $activeOutlet->id]);
        }

        if (($activeOutlet?->outlet_type ?? 'main') === 'main' && $activeOutlet?->id) {
            $childTenantIds = Outlet::query()
                ->where('outlet_type', 'tenant')
                ->where('parent_outlet_id', (int) $activeOutlet->id)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();

            return collect([(int) $activeOutlet->id])
                ->merge($childTenantIds)
                ->unique()
                ->values();
        }

        if ($user->isSuperAdmin()) {
            return Outlet::query()
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();
        }

        $outletIds = $user->outlets()
            ->pluck('outlets.id')
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($outletIds->isNotEmpty()) {
            $childTenantIds = Outlet::query()
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
        $settlementOutletIds = $this->resolveTenantSettlementOutletIds($user, $activeOutlet);

        $allocationTotals = (clone $allocationQuery)
            ->selectRaw('COALESCE(SUM(subtotal), 0) as subtotal_total, COALESCE(SUM(promo_discount_total), 0) as promo_discount_total')
            ->first();
        $grossSalesTotal = (int) ($allocationTotals->subtotal_total ?? 0);
        $pricingDiscountTotal = (int) ($allocationTotals->promo_discount_total ?? 0);
        $prePromoReferenceTotal = $grossSalesTotal + $pricingDiscountTotal;

        $allocationIds = (clone $allocationQuery)->pluck('id');
        $ownerMarkupTotal = TenantWalletMetrics::sumOwnerMarkupValueForAllocationIds($allocationIds);

        $approvedTotal = (int) CashierSettlementRequest::query()
            ->whereIn('outlet_id', $settlementOutletIds->all())
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_APPROVED)
            ->sum('approved_amount');

        $pendingTotal = (int) CashierSettlementRequest::query()
            ->whereIn('outlet_id', $settlementOutletIds->all())
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_PENDING)
            ->sum('requested_amount');

        // Hak tenant yang masuk saldo = nilai dasar tenant dikurangi promo tenant.
        // $grossSalesTotal (sum subtotal) sudah merupakan nilai bersih setelah promo.
        $claimableTotal = max(0, $grossSalesTotal);
        $receivableTotal = max(0, $claimableTotal - $approvedTotal);
        $availableBalance = max(0, $claimableTotal - $approvedTotal - $pendingTotal);

        return [
            'tenant_sales_total' => $claimableTotal,
            'tenant_base_sales_total' => $prePromoReferenceTotal,
            'gross_sales_total' => $grossSalesTotal,
            'base_total' => $prePromoReferenceTotal,
            'pricing_discount_total' => $pricingDiscountTotal,
            'owner_markup_total' => $ownerMarkupTotal,
            'approved_total' => $approvedTotal,
            'pending_total' => $pendingTotal,
            'receivable_total' => $receivableTotal,
            'available_balance' => $availableBalance,
        ];
    }

    private function buildOwnerSettlementOverview(Outlet $activeOutlet, \Illuminate\Support\Collection $visibleOutletIds): array
    {
        $tenantOutletIds = $this->resolveOwnerSettlementTenantOutletIds($activeOutlet, $visibleOutletIds);

        if ($tenantOutletIds->isEmpty()) {
            return [
                'completed_transactions_count' => 0,
                'pending_kitchen_transactions_count' => 0,
                'completed_gross_sales_total' => 0,
                'pending_kitchen_gross_sales_total' => 0,
                'total_gross_sales_total' => 0,
                'gross_sales_total' => 0,
                'tenant_rights_total' => 0,
                'owner_markup_total' => 0,
                'should_withdraw_total' => 0,
                'withdrawn_total' => 0,
                'pending_withdraw_total' => 0,
                'unwithdrawn_total' => 0,
                'returns_count' => 0,
                'tenant_breakdown' => [],
            ];
        }

        $tenantNames = Outlet::query()
            ->whereIn('id', $tenantOutletIds->all())
            ->get(['id', 'name', 'code'])
            ->keyBy('id');

        $returns = SalesReturn::query()
            ->with(['items.transactionDetail'])
            ->where('status', 'completed')
            ->whereHas('items.transactionDetail', fn (Builder $builder) => $builder->whereIn('tenant_outlet_id', $tenantOutletIds->all()))
            ->get();

        $returnsCount = $returns->count();
        $returnTransactionIds = $returns->pluck('transaction_id')->filter()->unique()->values()->all();

        $allocationQuery = TransactionTenantAllocation::query()
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->whereIn('tenant_outlet_id', $tenantOutletIds->all());

        $allocationIds = (clone $allocationQuery)->pluck('id');
        $ownerMarkupTotal = TenantWalletMetrics::sumOwnerMarkupValueForAllocationIds($allocationIds);
        $completedTransactionsCount = (int) (clone $allocationQuery)
            ->distinct('transaction_id')
            ->count('transaction_id');

        $pendingKitchenTransactionsCount = (int) TransactionTenantAllocation::query()
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->whereIn('tenant_outlet_id', $tenantOutletIds->all())
            ->where(function (Builder $builder) {
                $builder
                    ->where('waiter_status', '!=', 'delivered')
                    ->orWhereNull('delivered_at');
            })
            ->whereNotIn('transaction_id', (clone $allocationQuery)->select('transaction_id'))
            ->distinct('transaction_id')
            ->count('transaction_id');

        $pendingKitchenGrossSalesTotal = (int) TransactionTenantAllocation::query()
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->whereIn('tenant_outlet_id', $tenantOutletIds->all())
            ->where(function (Builder $builder) {
                $builder
                    ->where('waiter_status', '!=', 'delivered')
                    ->orWhereNull('delivered_at');
            })
            ->whereNotIn('transaction_id', (clone $allocationQuery)->select('transaction_id'))
            ->sum('subtotal');

        $totalTransactionsCount = (int) Transaction::query()
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'tenant',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->distinct('id')
            ->count('id');

        $unallocatedTransactionsCount = max(0, $totalTransactionsCount - $completedTransactionsCount - $pendingKitchenTransactionsCount);

        $completedByTenant = (clone $allocationQuery)
            ->selectRaw('tenant_outlet_id, COUNT(DISTINCT transaction_id) as total_transactions, COALESCE(SUM(subtotal), 0) as gross_sales_total')
            ->groupBy('tenant_outlet_id')
            ->get()
            ->keyBy('tenant_outlet_id');

        $grossSalesTotal = (int) $completedByTenant->sum('gross_sales_total');

        $pendingByTenant = TransactionTenantAllocation::query()
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->whereIn('tenant_outlet_id', $tenantOutletIds->all())
            ->where(function (Builder $builder) {
                $builder
                    ->where('waiter_status', '!=', 'delivered')
                    ->orWhereNull('delivered_at');
            })
            ->whereNotIn('transaction_id', (clone $allocationQuery)->select('transaction_id'))
            ->selectRaw('tenant_outlet_id, COUNT(DISTINCT transaction_id) as total_transactions, COALESCE(SUM(subtotal), 0) as gross_sales_total')
            ->groupBy('tenant_outlet_id')
            ->get()
            ->keyBy('tenant_outlet_id');

        $completedTransactionRows = TransactionTenantAllocation::query()
            ->selectRaw('DISTINCT transaction_id, tenant_outlet_id, subtotal, delivered_at')
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->whereIn('tenant_outlet_id', $tenantOutletIds->all())
            ->where('waiter_status', 'delivered')
            ->whereNotNull('delivered_at')
            ->get()
            ->map(fn ($row) => [
                'transaction_id' => (int) $row->transaction_id,
                'tenant_outlet_id' => (int) $row->tenant_outlet_id,
                'tenant_name' => $tenantNames->get($row->tenant_outlet_id)?->name ?? 'Tenant',
                'tenant_code' => $tenantNames->get($row->tenant_outlet_id)?->code ?? null,
                'subtotal' => (int) ($row->subtotal ?? 0),
                'delivered_at' => $row->delivered_at ? ReportTimezone::formatSourceDateTime($row->getRawOriginal('delivered_at'), 'd M Y H:i') : null,
            ])
            ->values()
            ->all();

        $pendingKitchenTransactionRows = TransactionTenantAllocation::query()
            ->selectRaw('DISTINCT transaction_id, tenant_outlet_id, subtotal, delivered_at')
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->whereIn('tenant_outlet_id', $tenantOutletIds->all())
            ->where(function (Builder $builder) {
                $builder
                    ->where('waiter_status', '!=', 'delivered')
                    ->orWhereNull('delivered_at');
            })
            ->get()
            ->map(fn ($row) => [
                'transaction_id' => (int) $row->transaction_id,
                'tenant_outlet_id' => (int) $row->tenant_outlet_id,
                'tenant_name' => $tenantNames->get($row->tenant_outlet_id)?->name ?? 'Tenant',
                'tenant_code' => $tenantNames->get($row->tenant_outlet_id)?->code ?? null,
                'subtotal' => (int) ($row->subtotal ?? 0),
                'delivered_at' => $row->delivered_at ? ReportTimezone::formatSourceDateTime($row->getRawOriginal('delivered_at'), 'd M Y H:i') : null,
            ])
            ->values()
            ->all();

        $unallocatedTransactionRows = Transaction::query()
            ->with(['details.product'])
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'tenant',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->whereDoesntHave('tenantAllocations', function (Builder $builder) use ($tenantOutletIds, $activeOutlet) {
                $builder->where('waiter_status', 'delivered')
                    ->whereNotNull('delivered_at')
                    ->when(
                        (string) ($activeOutlet->outlet_type ?? '') === 'main',
                        fn (Builder $sub) => $sub->where('outlet_id', (int) $activeOutlet->id)
                    )
                    ->whereIn('tenant_outlet_id', $tenantOutletIds->all());
            })
            ->whereNotIn('id', $returnTransactionIds)
            ->get()
            ->map(function ($transaction) use ($tenantOutletIds) {
                $details = $transaction->details ?? collect();
                $reason = 'Tidak teralokasi';
                $detailTenantIds = [];
                $scopeTenantIds = $tenantOutletIds->values()->all();
                $inScopeTenantIds = [];

                if ($details->isNotEmpty()) {
                    $detailTenantIds = $details
                        ->filter(fn ($detail) => (int) ($detail->tenant_outlet_id ?? 0) > 0)
                        ->pluck('tenant_outlet_id')
                        ->unique()
                        ->values()
                        ->all();

                    $inScopeTenantIds = $details
                        ->filter(fn ($detail) => $tenantOutletIds->contains((int) ($detail->tenant_outlet_id ?? 0)))
                        ->pluck('tenant_outlet_id')
                        ->unique()
                        ->values()
                        ->all();
                }

                if ($details->isEmpty()) {
                    $reason = 'Tidak ada detail transaksi';
                } elseif (empty($detailTenantIds)) {
                    $reason = 'Detail transaksi tanpa tenant_outlet_id';
                } elseif (!empty($detailTenantIds) && empty($inScopeTenantIds)) {
                    $reason = 'Tenant pada detail tidak termasuk scope aktif: ' . implode(', ', $detailTenantIds);
                } elseif (!empty($detailTenantIds) && !empty($inScopeTenantIds)) {
                    $reason = 'Tidak ada alokasi tenant untuk transaksi ini';
                }

                return [
                    'transaction_id' => (int) $transaction->id,
                    'invoice' => $transaction->invoice ?? '-',
                    'customer_name' => $transaction->customer?->name ?? '-',
                    'grand_total' => (int) ($transaction->grand_total ?? 0),
                    'payment_status' => $transaction->payment_status ?? '-',
                    'payment_method' => $transaction->payment_method ?? '-',
                    'created_at' => $transaction->created_at ? ReportTimezone::formatSourceDateTime($transaction->getRawOriginal('created_at'), 'd M H:i') : null,
                    'reason' => $reason,
                    'detail_tenant_ids' => $detailTenantIds,
                    'scope_tenant_ids' => $scopeTenantIds,
                    'products' => $details->map(fn ($detail) => [
                        'product_name' => $detail->product?->title ?? 'Produk tidak ditemukan',
                        'qty' => (int) ($detail->qty ?? 0),
                        'unit_price' => (int) ($detail->unit_price ?? 0),
                        'tenant_outlet_id' => (int) ($detail->tenant_outlet_id ?? 0),
                    ])->values()->all(),
                ];
            })
            ->values()
            ->all();

        $totalTransactionsCount = (int) Transaction::query()
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'main',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->when(
                (string) ($activeOutlet->outlet_type ?? '') === 'tenant',
                fn (Builder $builder) => $builder->where('outlet_id', (int) $activeOutlet->id)
            )
            ->distinct('id')
            ->count('id');

        $allocationIdsByTenant = (clone $allocationQuery)
            ->select(['id', 'tenant_outlet_id'])
            ->get()
            ->groupBy('tenant_outlet_id')
            ->map(fn (Collection $rows) => $rows->pluck('id')->map(fn ($id) => (int) $id)->values());

        $returnGrossTotal = 0;
        $returnOwnerMarkupTotal = 0;

        foreach ($returns as $salesReturn) {
            foreach ($salesReturn->items as $item) {
                $detail = $item->transactionDetail;
                if (! $detail || ! $tenantOutletIds->contains((int) ($detail->tenant_outlet_id ?? 0))) {
                    continue;
                }

                $qty = (int) ($item->qty_return ?? 0);
                $detailQty = max(1, (int) ($detail->qty ?? 1));
                $customerUnitPrice = (int) ($detail->customer_base_unit_price ?? $detail->unit_price ?? 0);
                $ownerMarkupUnitPrice = (int) ($detail->owner_markup_unit_price ?? 0);

                $returnGrossTotal += $customerUnitPrice * $qty;
                $returnOwnerMarkupTotal += (int) ($detail->owner_net_total ?? 0) > 0
                    ? (int) round(((int) $detail->owner_net_total / $detailQty) * $qty)
                    : $ownerMarkupUnitPrice * $qty;
            }
        }

        $grossSalesTotal = max(0, $grossSalesTotal - $returnGrossTotal);
        $ownerMarkupTotal -= $returnOwnerMarkupTotal;

        // Hak penarikan tenant memakai omzet bersih setelah promo (subtotal).
        // $grossSalesTotal (sum subtotal) sudah merupakan nilai bersih setelah promo.
        $claimableTotal = max(0, $grossSalesTotal);
        // Hak bersih tenant secara agregat (sudah dipotong promo) untuk kartu owner.
        $tenantRightsTotal = $claimableTotal;

        $withdrawnTotal = (int) CashierSettlementRequest::query()
            ->whereIn('outlet_id', $tenantOutletIds->all())
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_APPROVED)
            ->sum('approved_amount');

        $pendingWithdrawTotal = (int) CashierSettlementRequest::query()
            ->whereIn('outlet_id', $tenantOutletIds->all())
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_PENDING)
            ->sum('requested_amount');

        $withdrawnByTenant = CashierSettlementRequest::query()
            ->whereIn('outlet_id', $tenantOutletIds->all())
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_APPROVED)
            ->selectRaw('outlet_id, COALESCE(SUM(approved_amount), 0) as total_amount')
            ->groupBy('outlet_id')
            ->pluck('total_amount', 'outlet_id');

        $pendingWithdrawByTenant = CashierSettlementRequest::query()
            ->whereIn('outlet_id', $tenantOutletIds->all())
            ->whereNull('cashier_shift_id')
            ->where('status', CashierSettlementRequest::STATUS_PENDING)
            ->selectRaw('outlet_id, COALESCE(SUM(requested_amount), 0) as total_amount')
            ->groupBy('outlet_id')
            ->pluck('total_amount', 'outlet_id');

        $shouldWithdrawTotal = max(0, $claimableTotal);
        $unwithdrawnTotal = max(0, $claimableTotal - $withdrawnTotal - $pendingWithdrawTotal);

        $returnAdjustmentsByTenant = $returns->reduce(function (array $carry, SalesReturn $salesReturn) use ($tenantOutletIds) {
            foreach ($salesReturn->items as $item) {
                $detail = $item->transactionDetail;
                $tenantId = (int) ($detail->tenant_outlet_id ?? 0);

                if (! $detail || ! $tenantOutletIds->contains($tenantId)) {
                    continue;
                }

                $qty = (int) ($item->qty_return ?? 0);
                $detailQty = max(1, (int) ($detail->qty ?? 1));
                $customerUnitPrice = (int) ($detail->customer_base_unit_price ?? $detail->unit_price ?? 0);
                $tenantBaseUnitPrice = (int) ($detail->tenant_base_unit_price ?? 0);
                $ownerMarkupUnitPrice = (int) ($detail->owner_markup_unit_price ?? 0);

                $carry[$tenantId]['gross_sales_total'] = ($carry[$tenantId]['gross_sales_total'] ?? 0) + ($customerUnitPrice * $qty);
                $carry[$tenantId]['tenant_rights_total'] = ($carry[$tenantId]['tenant_rights_total'] ?? 0) + (
                    (int) ($detail->tenant_net_total ?? 0) > 0
                        ? (int) round(((int) $detail->tenant_net_total / $detailQty) * $qty)
                        : $tenantBaseUnitPrice * $qty
                );
                $carry[$tenantId]['owner_markup_total'] = ($carry[$tenantId]['owner_markup_total'] ?? 0) + (
                    (int) ($detail->owner_net_total ?? 0) > 0
                        ? (int) round(((int) $detail->owner_net_total / $detailQty) * $qty)
                        : $ownerMarkupUnitPrice * $qty
                );
            }

            return $carry;
        }, []);

        $tenantBreakdown = $tenantOutletIds->map(function (int $tenantId) use (
            $tenantNames,
            $allocationIdsByTenant,
            $completedByTenant,
            $pendingByTenant,
            $withdrawnByTenant,
            $pendingWithdrawByTenant,
            $returnAdjustmentsByTenant
        ) {
            $tenantAllocationIds = $allocationIdsByTenant->get($tenantId, collect());
            $grossSalesTotal = $tenantAllocationIds->isNotEmpty()
                ? (int) TransactionTenantAllocation::query()->whereIn('id', $tenantAllocationIds->all())->sum('subtotal')
                : 0;
            $ownerMarkupTotal = TenantWalletMetrics::sumOwnerMarkupValueForAllocationIds($tenantAllocationIds);
            $returnAdjustments = $returnAdjustmentsByTenant[$tenantId] ?? [];
            $completedGrossSalesTotal = (int) ($completedByTenant->get($tenantId)?->gross_sales_total ?? 0);
            $pendingKitchenGrossSalesTotal = (int) ($pendingByTenant->get($tenantId)?->gross_sales_total ?? 0);

            $grossSalesTotal = max(0, $grossSalesTotal - (int) ($returnAdjustments['gross_sales_total'] ?? 0));
            $completedGrossSalesTotal = max(0, $completedGrossSalesTotal - (int) ($returnAdjustments['gross_sales_total'] ?? 0));
            // Hak bersih tenant setelah promo mengikuti omzet subtotal (gross setelah promo).
            $tenantRightsTotal = $grossSalesTotal;
            $ownerMarkupTotal -= (int) ($returnAdjustments['owner_markup_total'] ?? 0);
            $withdrawnTotal = (int) ($withdrawnByTenant->get($tenantId, 0) ?? 0);
            $pendingWithdrawTotal = (int) ($pendingWithdrawByTenant->get($tenantId, 0) ?? 0);
            $shouldWithdrawTotal = max(0, $grossSalesTotal);
            $unwithdrawnTotal = max(0, $grossSalesTotal - $withdrawnTotal - $pendingWithdrawTotal);
            $tenant = $tenantNames->get($tenantId);

            return [
                'tenant_outlet_id' => $tenantId,
                'tenant_name' => $tenant?->name ?? 'Tenant',
                'tenant_code' => $tenant?->code,
                'completed_transactions_count' => (int) ($completedByTenant->get($tenantId)?->total_transactions ?? 0),
                'pending_kitchen_transactions_count' => (int) ($pendingByTenant->get($tenantId)?->total_transactions ?? 0),
                'completed_gross_sales_total' => $completedGrossSalesTotal,
                'pending_kitchen_gross_sales_total' => $pendingKitchenGrossSalesTotal,
                'total_gross_sales_total' => $completedGrossSalesTotal + $pendingKitchenGrossSalesTotal,
                'gross_sales_total' => $grossSalesTotal,
                'tenant_rights_total' => $tenantRightsTotal,
                'owner_markup_total' => $ownerMarkupTotal,
                'withdrawn_total' => $withdrawnTotal,
                'pending_withdraw_total' => $pendingWithdrawTotal,
                'should_withdraw_total' => $shouldWithdrawTotal,
                'unwithdrawn_total' => $unwithdrawnTotal,
            ];
        })->sortByDesc('tenant_rights_total')->values()->all();

        return [
            'completed_transactions_count' => $completedTransactionsCount,
            'pending_kitchen_transactions_count' => $pendingKitchenTransactionsCount,
            'unallocated_transactions_count' => $unallocatedTransactionsCount,
            'total_transactions_count' => $totalTransactionsCount,
            'completed_gross_sales_total' => $grossSalesTotal,
            'pending_kitchen_gross_sales_total' => (int) $pendingKitchenGrossSalesTotal,
            'total_gross_sales_total' => (int) ($grossSalesTotal + $pendingKitchenGrossSalesTotal),
            'gross_sales_total' => $grossSalesTotal,
            'tenant_rights_total' => $tenantRightsTotal,
            'owner_markup_total' => $ownerMarkupTotal,
            'should_withdraw_total' => $shouldWithdrawTotal,
            'withdrawn_total' => $withdrawnTotal,
            'pending_withdraw_total' => $pendingWithdrawTotal,
            'unwithdrawn_total' => $unwithdrawnTotal,
            'returns_count' => $returnsCount,
            'tenant_breakdown' => $tenantBreakdown,
        ];
    }

    private function buildTenantWalletTransactions(User $user, Outlet $activeOutlet, array $filters)
    {
        $allocationQuery = $this->applyTenantWalletFilters(
            $this->buildTenantWalletAllocationQuery($user, $activeOutlet),
            $filters
        );

        $allocations = $allocationQuery
            ->with([
                'transaction.customer:id,name',
                'transaction.cashier:id,name',
                'tenantOutlet:id,name,code',
                'items.transactionDetail.product:id,title',
                'items.transactionDetail.modifiers',
            ])
            ->latest('delivered_at')
            ->get();

        $ownerMarkupTotals = TenantWalletMetrics::ownerMarkupTotalsByAllocationIds($allocations->pluck('id'));

        $allocationRows = $allocations->map(function (TransactionTenantAllocation $allocation) use ($ownerMarkupTotals) {
                $grossAfterPromo = (int) ($allocation->subtotal ?? 0);
                $ownerMarkupTotal = (int) ($ownerMarkupTotals->get($allocation->id, 0) ?? 0);
                $pricingDiscountTotal = (int) ($allocation->promo_discount_total ?? 0);
                $activityAtRaw = $allocation->getRawOriginal('delivered_at');
                $dateKey = ReportTimezone::sourceDateKey($activityAtRaw);

                $details = $allocation->items->map(function ($item) {
                    $detail = $item->transactionDetail;
                    $remainingQty = (int) ($item->qty ?? 0);
                    $detailQty = max(1, (int) ($detail?->qty ?? $remainingQty ?? 1));
                    $tenantBaseUnitPrice = (int) ($detail?->tenant_base_unit_price ?? $item->base_unit_price ?? 0);
                    $ownerMarkupUnitPrice = (int) ($detail?->owner_markup_unit_price ?? 0);
                    $customerUnitPrice = (int) ($detail?->customer_base_unit_price ?? $detail?->unit_price ?? 0);

                    // Resolve modifier split (base=tenant, markup=owner) per modifier
                    // Data lama (base_price=0, markup_price=0): anggap seluruh harga sebagai base tenant, markup=0
                    $modifierRows = collect($detail?->modifiers ?? [])
                        ->map(function ($modifier) {
                            $storedBasePrice = (int) ($modifier->base_price ?? 0);
                            $storedMarkupPrice = (int) ($modifier->markup_price ?? 0);
                            $unitPrice = (int) $modifier->unit_price;

                            if ($storedBasePrice === 0 && $storedMarkupPrice === 0 && $unitPrice > 0) {
                                $storedBasePrice = $unitPrice;
                            }

                            return [
                                'id' => $modifier->id,
                                'name' => $modifier->name,
                                'qty' => (int) $modifier->qty,
                                'unit_price' => $unitPrice,
                                'base_price' => $storedBasePrice,
                                'markup_price' => $storedMarkupPrice,
                                'total_price' => (int) $modifier->total_price,
                            ];
                        })
                        ->values();

                    $tenantModifierBase = $modifierRows->sum(fn ($m) => (int) $m['base_price'] * (int) $m['qty']);
                    $ownerModifierMarkup = $modifierRows->sum(fn ($m) => (int) $m['markup_price'] * (int) $m['qty']);

                    $tenantNetPerUnit = $tenantBaseUnitPrice + (int) round($tenantModifierBase / max(1, $detailQty));
                    $ownerNetPerUnit = $ownerMarkupUnitPrice + (int) round($ownerModifierMarkup / max(1, $detailQty));

                    $tenantNetTotal = $tenantNetPerUnit * $remainingQty;
                    $ownerProductMarkupTotal = $ownerMarkupUnitPrice * $remainingQty;
                    $ownerToppingMarkupTotal = (int) round($ownerModifierMarkup / max(1, $detailQty)) * $remainingQty;
                    $ownerNetTotal = $ownerProductMarkupTotal + $ownerToppingMarkupTotal;

                    return [
                        'id' => $detail?->id ?? $item->transaction_detail_id,
                        'product_title' => $detail?->product?->title ?? 'Produk terhapus',
                        'qty' => $remainingQty,
                        'customer_unit_price' => $customerUnitPrice,
                        'line_total' => $customerUnitPrice * $remainingQty,
                        'tenant_base_unit_price' => $tenantBaseUnitPrice,
                        'tenant_net_total' => $tenantNetTotal,
                        'owner_markup_unit_price' => $ownerMarkupUnitPrice,
                        'owner_product_markup_total' => $ownerProductMarkupTotal,
                        'owner_topping_markup_total' => $ownerToppingMarkupTotal,
                        'owner_net_total' => $ownerNetTotal,
                        'discount_total' => (int) ($item->discount_total ?? 0),
                        'notes' => $detail?->notes,
                        'modifiers' => $modifierRows->all(),
                    ];
                })->values()->all();

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
                    'tenant_sales_total' => max(0, $grossAfterPromo),
                    'tenant_base_sales_total' => max(0, $grossAfterPromo + $pricingDiscountTotal),
                    'owner_product_markup_total' => (int) collect($details)->sum('owner_product_markup_total'),
                    'owner_topping_markup_total' => (int) collect($details)->sum('owner_topping_markup_total'),
                    'owner_markup_total' => $ownerMarkupTotal,
                    'pricing_discount_total' => $pricingDiscountTotal,
                    'delivered_at' => ReportTimezone::formatSourceIso8601($allocation->getRawOriginal('delivered_at')),
                    'created_at' => ReportTimezone::formatSourceIso8601($allocation->transaction?->getRawOriginal('created_at')),
                    'activity_at' => ReportTimezone::formatSourceIso8601($activityAtRaw),
                    'activity_ts' => strtotime((string) $activityAtRaw),
                    'date_key' => $dateKey,
                    'date_label' => $dateKey ? ReportTimezone::formatSourceDateLabel($dateKey, 'd M Y') : null,
                    'month_key' => $dateKey ? substr($dateKey, 0, 7) : null,
                    'month_label' => $dateKey ? Carbon::createFromFormat('Y-m-d', $dateKey, ReportTimezone::timezone())->translatedFormat('F Y') : null,
                    'details' => $details,
                ];
            })
            ->when(($filters['entry_type'] ?? '') === 'sales_return', fn (Collection $rows) => $rows->filter(fn (array $row) => false))
            ->values();

        $returnRows = $this->buildTenantWalletReturnRows($user, $activeOutlet, $filters);

        $combinedRows = $allocationRows
            ->merge($returnRows)
            ->sortByDesc(fn (array $row) => strtotime((string) ($row['activity_at'] ?? $row['delivered_at'] ?? $row['created_at'] ?? now()->toIso8601String())))
            ->values();

        $monthRows = $combinedRows
            ->groupBy('month_key')
            ->map(function (Collection $rows, $monthKey) {
                $first = $rows->first();

                return [
                    'month_key' => $monthKey,
                    'month_label' => $first['month_label'] ?? $monthKey,
                    'tenant_sales_total' => (int) $rows->sum('tenant_sales_total'),
                    'owner_markup_total' => (int) $rows->sum('owner_markup_total'),
                    'pricing_discount_total' => (int) $rows->sum('pricing_discount_total'),
                    'gross_sales_total' => (int) $rows->sum('gross_sales_total'),
                    'entries_count' => (int) $rows->count(),
                    'sales_count' => (int) $rows->where('entry_type', 'allocation')->count(),
                    'returns_count' => (int) $rows->where('entry_type', 'sales_return')->count(),
                ];
            })
            ->sortByDesc('month_key')
            ->values();

        $monthPage = max(1, (int) request()->integer('wallet_month_page', 1));
        $monthPerPage = 6;
        $monthPageRows = $monthRows->slice(($monthPage - 1) * $monthPerPage, $monthPerPage)->values();
        $monthPaginator = new LengthAwarePaginator(
            $monthPageRows,
            $monthRows->count(),
            $monthPerPage,
            $monthPage,
            [
                'path' => request()->url(),
                'pageName' => 'wallet_month_page',
                'query' => request()->query(),
            ]
        );

        $selectedMonth = (string) request()->query('wallet_month', '');
        $selectedMonth = $monthRows->firstWhere('month_key', $selectedMonth)['month_key']
            ?? ($monthPageRows->first()['month_key'] ?? ($monthRows->first()['month_key'] ?? ''));

        $monthScopedRows = $selectedMonth !== ''
            ? $combinedRows->filter(fn (array $row) => ($row['month_key'] ?? '') === $selectedMonth)->values()
            : collect();

        $dayRows = $monthScopedRows
            ->groupBy('date_key')
            ->map(function (Collection $rows, $dateKey) {
                $first = $rows->first();

                return [
                    'date_key' => $dateKey,
                    'date_label' => $first['date_label'] ?? $dateKey,
                    'tenant_sales_total' => (int) $rows->sum('tenant_sales_total'),
                    'owner_markup_total' => (int) $rows->sum('owner_markup_total'),
                    'pricing_discount_total' => (int) $rows->sum('pricing_discount_total'),
                    'gross_sales_total' => (int) $rows->sum('gross_sales_total'),
                    'entries_count' => (int) $rows->count(),
                    'sales_count' => (int) $rows->where('entry_type', 'allocation')->count(),
                    'returns_count' => (int) $rows->where('entry_type', 'sales_return')->count(),
                ];
            })
            ->sortByDesc('date_key')
            ->values();

        $dayPage = max(1, (int) request()->integer('wallet_day_page', 1));
        $dayPerPage = 10;
        $dayPageRows = $dayRows->slice(($dayPage - 1) * $dayPerPage, $dayPerPage)->values();
        $dayPaginator = new LengthAwarePaginator(
            $dayPageRows,
            $dayRows->count(),
            $dayPerPage,
            $dayPage,
            [
                'path' => request()->url(),
                'pageName' => 'wallet_day_page',
                'query' => request()->query(),
            ]
        );

        $selectedDay = (string) request()->query('wallet_day', '');
        $selectedDay = $dayRows->firstWhere('date_key', $selectedDay)['date_key']
            ?? ($dayPageRows->first()['date_key'] ?? ($dayRows->first()['date_key'] ?? ''));

        $detailRows = $selectedDay !== ''
            ? $monthScopedRows->filter(fn (array $row) => ($row['date_key'] ?? '') === $selectedDay)->values()
            : collect();

        $detailPage = max(1, (int) request()->integer('wallet_detail_page', 1));
        $detailPerPage = 15;
        $detailPageRows = $detailRows->slice(($detailPage - 1) * $detailPerPage, $detailPerPage)->values();
        $detailPaginator = new LengthAwarePaginator(
            $detailPageRows,
            $detailRows->count(),
            $detailPerPage,
            $detailPage,
            [
                'path' => request()->url(),
                'pageName' => 'wallet_detail_page',
                'query' => request()->query(),
            ]
        );

        return [
            'months' => $monthPaginator,
            'selected_month' => $selectedMonth,
            'selected_month_label' => $selectedMonth !== ''
                ? Carbon::createFromFormat('Y-m', $selectedMonth, ReportTimezone::timezone())->translatedFormat('F Y')
                : null,
            'days' => $dayPaginator,
            'selected_day' => $selectedDay,
            'selected_day_label' => $selectedDay !== ''
                ? ReportTimezone::formatSourceDateLabel($selectedDay, 'd M Y')
                : null,
            'details' => $detailPaginator,
        ];
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
            ->when($filters['cashier_id'] !== '', fn (Builder $builder) => $builder->where('cashier_id', (int) $filters['cashier_id']))
            ->when(($filters['payment_method'] ?? '') !== '', fn (Builder $builder) => $builder->whereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery->where('payment_method', $filters['payment_method'])));

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
            ->when(($filters['payment_method'] ?? '') !== '', fn (Builder $builder) => $builder->whereHas('transaction', fn (Builder $transactionQuery) => $transactionQuery->where('payment_method', $filters['payment_method'])))
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
                $ownerProductMarkupTotal = $ownerMarkupUnitPrice * $qty;
                $ownerToppingMarkupTotal = max(0, $ownerNetTotal - $ownerProductMarkupTotal);
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
                    'owner_product_markup_total' => -$ownerProductMarkupTotal,
                    'owner_topping_markup_total' => -$ownerToppingMarkupTotal,
                    'owner_net_total' => -$ownerNetTotal,
                    'discount_total' => -$discountTotal,
                    'notes' => $item->return_reason,
                    'modifiers' => $detail?->modifiers
                        ? $detail->modifiers->map(fn ($modifier) => [
                            'id' => $modifier->id,
                            'name' => $modifier->name,
                            'qty' => (int) $modifier->qty,
                            'unit_price' => (int) $modifier->unit_price,
                            'base_price' => (int) ($modifier->base_price ?? $modifier->unit_price),
                            'markup_price' => (int) ($modifier->markup_price ?? 0),
                            'total_price' => (int) $modifier->total_price,
                        ])->values()->all()
                        : [],
                ];
            })->values()->all();

            $activityAtRaw = $salesReturn->getRawOriginal('completed_at');
            $dateKey = ReportTimezone::sourceDateKey($activityAtRaw);

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
                'owner_product_markup_total' => (int) collect($details)->sum('owner_product_markup_total'),
                'owner_topping_markup_total' => (int) collect($details)->sum('owner_topping_markup_total'),
                'owner_markup_total' => -$ownerMarkupTotal,
                'pricing_discount_total' => -$pricingDiscountTotal,
                'delivered_at' => ReportTimezone::formatSourceIso8601($activityAtRaw),
                'created_at' => ReportTimezone::formatSourceIso8601($salesReturn->getRawOriginal('created_at')),
                'activity_at' => ReportTimezone::formatSourceIso8601($activityAtRaw),
                'activity_ts' => strtotime((string) $activityAtRaw),
                'date_key' => $dateKey,
                'date_label' => $dateKey ? ReportTimezone::formatSourceDateLabel($dateKey, 'd M Y') : null,
                'month_key' => $dateKey ? substr($dateKey, 0, 7) : null,
                'month_label' => $dateKey ? Carbon::createFromFormat('Y-m-d', $dateKey, ReportTimezone::timezone())->translatedFormat('F Y') : null,
                'details' => $details,
            ];
        })
            ->filter(fn (array $row) => ! empty($row['details']))
            ->when(($filters['entry_type'] ?? '') === 'allocation', fn (Collection $rows) => $rows->filter(fn (array $row) => false))
            ->values();
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

    private function resolveTenantSettlementOutletIds(?User $user, ?Outlet $activeOutlet): \Illuminate\Support\Collection
    {
        if (! $user || ! $activeOutlet) {
            return collect();
        }

        if ((string) ($activeOutlet->outlet_type ?? '') === 'tenant') {
            return collect([(int) $activeOutlet->id]);
        }

        if ($user->isKitchenWorkspace()) {
            return $this->resolveKitchenTenantOutletIds($user, (int) $activeOutlet->id);
        }

        return collect([(int) $activeOutlet->id]);
    }

    private function resolveOwnerSettlementTenantOutletIds(Outlet $activeOutlet, \Illuminate\Support\Collection $visibleOutletIds): \Illuminate\Support\Collection
    {
        if ((string) ($activeOutlet->outlet_type ?? '') === 'tenant') {
            return collect([(int) $activeOutlet->id]);
        }

        return Outlet::query()
            ->whereIn('id', $visibleOutletIds->all())
            ->where('outlet_type', 'tenant')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->prepend((int) $activeOutlet->id);
    }
}
