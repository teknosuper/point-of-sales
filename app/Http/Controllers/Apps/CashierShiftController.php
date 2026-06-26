<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Http\Requests\CloseCashierShiftRequest;
use App\Http\Requests\ConfirmPasswordForForceCloseRequest;
use App\Http\Requests\StoreCashierShiftRequest;
use App\Models\CashierShift;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\CashierShiftService;
use App\Services\OutletResolver;
use App\Support\ReportTimezone;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class CashierShiftController extends Controller
{
    public function __construct(
        private readonly CashierShiftService $cashierShiftService,
        private readonly AuditLogService $auditLogService,
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request): Response
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $canViewAllShiftHistory = $request->user()->isSuperAdmin() || $request->user()->can('cashier-shifts-force-close');
        $filters = [
            'cashier_id' => $request->input('cashier_id'),
            'status' => $request->input('status'),
            'opened_from' => $request->input('opened_from'),
            'opened_to' => $request->input('opened_to'),
        ];

        $query = CashierShift::query()
            ->with(['user:id,name', 'openedBy:id,name', 'closedBy:id,name', 'operators:id,name', 'outlet:id,name,code'])
            ->when($filters['cashier_id'], fn (Builder $builder, $cashierId) => $builder->where('user_id', $cashierId))
            ->when($filters['status'], fn (Builder $builder, $status) => $builder->where('status', $status))
            ->when(
                $activeOutlet && ! $canViewAllShiftHistory,
                fn (Builder $builder) => $builder->where('outlet_id', $activeOutlet->id),
                fn (Builder $builder) => $canViewAllShiftHistory ? $builder : $builder->whereNull('outlet_id')
            )
            ->latest('opened_at');

        $query = ReportTimezone::applySourceDateRange($query, 'opened_at', [
            'start_date' => $filters['opened_from'],
            'end_date' => $filters['opened_to'],
        ]);

        $query = $this->cashierShiftService->visibleToUser($query, $request->user());

        $shifts = $query->paginate(10)->withQueryString();
        $shifts->through(fn (CashierShift $shift) => $this->transformShift($shift));

        $activeShift = $this->cashierShiftService->getActiveShiftForUser(
            $request->user()->id,
            $activeOutlet?->id
        );
        $outletOpenShift = null;
        $otherOpenShifts = collect();

        if (! $activeShift) {
            $outletOpenShift = $this->cashierShiftService->getOpenShiftForOutlet(
                $activeOutlet?->id
            );
        }

        $otherOpenShiftsQuery = CashierShift::query()
            ->with(['user:id,name', 'outlet:id,name,code'])
            ->open()
            ->when(
                $activeOutlet,
                fn (Builder $builder) => $builder->where('outlet_id', '!=', $activeOutlet->id),
                fn (Builder $builder) => $builder->whereNotNull('outlet_id')
            )
            ->latest('opened_at');

        $otherOpenShiftsQuery = $this->cashierShiftService->visibleToUser($otherOpenShiftsQuery, $request->user());

        $otherOpenShifts = $otherOpenShiftsQuery
            ->limit(5)
            ->get()
            ->map(fn (CashierShift $shift) => [
                'id' => $shift->id,
                'opened_at' => optional($shift->opened_at)?->toISOString(),
                'user' => $shift->user ? [
                    'id' => $shift->user->id,
                    'name' => $shift->user->name,
                ] : null,
                'outlet' => $shift->outlet ? [
                    'id' => $shift->outlet->id,
                    'name' => $shift->outlet->name,
                    'code' => $shift->outlet->code,
                ] : null,
            ])
            ->values();

        $cashiers = $canViewAllShiftHistory
            ? User::query()->orderBy('name')->get(['id', 'name'])
            : collect([$request->user()->only(['id', 'name'])]);

        return Inertia::render('Dashboard/CashierShifts/Index', [
            'shifts' => $shifts,
            'filters' => $filters,
            'cashiers' => $cashiers,
            'activeShift' => $activeShift ? $this->transformShift($activeShift) : null,
            'outletOpenShift' => $outletOpenShift ? $this->transformShift($outletOpenShift) : null,
            'otherOpenShifts' => $otherOpenShifts,
            'canForceClose' => $canViewAllShiftHistory,
        ]);
    }

    public function show(Request $request, CashierShift $cashierShift): Response
    {
        $cashierShift = $this->resolveVisibleShift($request, $cashierShift);
        $transactionFilters = $this->transactionFilters($request);
        $transactionsPerPage = $this->transactionsPerPage($request);
        $transactionsQuery = $this->cashierShiftService->shiftTransactionsQuery($cashierShift, $transactionFilters);
        $transactions = $transactionsQuery
            ->paginate($transactionsPerPage, ['*'], 'transactions_page')
            ->withQueryString();

        $runningExpectedCashMap = $this->runningExpectedCashMap($cashierShift);
        $transactions->through(fn (Transaction $transaction) => $this->transformShiftTransaction($transaction, $runningExpectedCashMap));

        return Inertia::render('Dashboard/CashierShifts/Show', [
            'cashierShift' => $this->transformShift($cashierShift),
            'paymentMethodBreakdown' => $this->cashierShiftService->paymentMethodBreakdown($cashierShift),
            'transactionFilters' => $transactionFilters + ['per_page' => $transactionsPerPage],
            'transactions' => $transactions,
            'transactionFilterMeta' => [
                'payment_methods' => [
                    ['value' => 'cash', 'label' => 'Tunai'],
                    ['value' => 'qris', 'label' => 'QRIS'],
                    ['value' => 'bank_transfer', 'label' => 'Transfer Bank'],
                    ['value' => 'pay_later', 'label' => 'Bayar Nanti'],
                ],
                'payment_statuses' => [
                    ['value' => 'paid', 'label' => 'Lunas'],
                    ['value' => 'pending', 'label' => 'Menunggu'],
                    ['value' => 'failed', 'label' => 'Gagal'],
                ],
                'order_types' => [
                    ['value' => 'dine_in', 'label' => 'Dine In'],
                    ['value' => 'take_away', 'label' => 'Take Away'],
                    ['value' => 'online', 'label' => 'Online'],
                ],
                'per_page_options' => [10, 25, 50, 100],
            ],
            'canForceClose' => $request->user()->isSuperAdmin() || $request->user()->can('cashier-shifts-force-close'),
        ]);
    }

    public function transactionsPdf(Request $request, CashierShift $cashierShift): HttpResponse
    {
        $cashierShift = $this->resolveVisibleShift($request, $cashierShift);
        $transactionQuery = $this->cashierShiftService
            ->shiftTransactionsQuery($cashierShift, []);
        $runningExpectedCashMap = $this->runningExpectedCashMap($cashierShift);
        $transactions = (clone $transactionQuery)
            ->get()
            ->map(fn (Transaction $transaction) => $this->transformShiftTransaction($transaction, $runningExpectedCashMap));
        $transactionIds = (clone $transactionQuery)->toBase()->pluck('transactions.id');
        $tenantBreakdown = $this->tenantBreakdown($transactionIds);
        $productBreakdown = $this->productBreakdown($transactionIds);

        $pdf = Pdf::loadView('pdf.cashier_shift_transactions', [
            'shift' => $this->transformShift($cashierShift),
            'shiftPdfMeta' => $this->shiftPdfMeta($cashierShift),
            'store' => $this->storeProfile($cashierShift),
            'paymentMethodBreakdown' => $this->cashierShiftService->paymentMethodBreakdown($cashierShift),
            'transactions' => $transactions,
            'tenantBreakdown' => $tenantBreakdown,
            'productBreakdown' => $productBreakdown,
            'involvedCashiers' => $this->involvedCashiers($cashierShift),
            'generatedAt' => now(),
            'timezoneLabel' => ReportTimezone::timezoneLabel(),
        ])->setPaper('a4', 'portrait');

        return $pdf->stream('laporan-shift-'.$cashierShift->id.'.pdf');
    }

    public function store(StoreCashierShiftRequest $request): RedirectResponse
    {
        $outletId = $this->outletResolver->resolve($request, $request->user())?->id;
        $joinExisting = (bool) $request->boolean('join_existing');

        $shift = $joinExisting
            ? $this->cashierShiftService->joinOpenShift(
                cashier: $request->user(),
                actor: $request->user(),
                outletId: $outletId,
            )
            : $this->cashierShiftService->openShift(
                cashier: $request->user(),
                actor: $request->user(),
                openingCash: (int) $request->validated('opening_cash'),
                notes: $request->validated('notes'),
                outletId: $outletId,
            );

        $this->auditLogService->log(
            event: $joinExisting ? 'cashier_shift.joined' : 'cashier_shift.opened',
            module: 'cashier_shifts',
            auditable: $shift,
            description: $joinExisting ? 'Operator bergabung ke shift kasir.' : 'Shift kasir dibuka.',
            after: $this->shiftAuditPayload($shift),
            meta: [
                'cashier_id' => $shift->user_id,
                'opened_by' => $shift->opened_by,
                'operator_id' => $request->user()->id,
            ],
        );

        $target = $request->input('redirect_to') === 'transactions'
            ? route('transactions.index')
            : route('cashier-shifts.show', $shift);

        return redirect($target)->with('success', $joinExisting ? 'Berhasil bergabung ke shift aktif.' : 'Shift kasir berhasil dibuka.');
    }

    public function close(CloseCashierShiftRequest $request, CashierShift $cashierShift, ConfirmPasswordForForceCloseRequest $confirmPasswordRequest): RedirectResponse
    {
        $cashierShift = $this->resolveVisibleShift($request, $cashierShift);
        $before = $this->shiftAuditPayload($cashierShift);
        $isShiftOwner = (int) $cashierShift->user_id === (int) $request->user()->id;
        $forceClose = ! $isShiftOwner;

        if ($forceClose && ! ($request->user()->isSuperAdmin() || $request->user()->can('cashier-shifts-force-close'))) {
            abort(403);
        }

        if ($forceClose && ! $confirmPasswordRequest->recentlyConfirmed()) {
            $request->session()->put('url.intended', $request->headers->get('referer') ?: route('cashier-shifts.show', $cashierShift));
            $request->session()->put('security.step_up_context', [
                'route' => $request->route()?->getName(),
                'method' => $request->method(),
                'intended' => $request->headers->get('referer') ?: route('cashier-shifts.show', $cashierShift),
                'target' => $cashierShift->id,
            ]);

            $this->auditLogService->log(
                event: 'security.privileged_action_challenged',
                module: 'security',
                auditable: $cashierShift,
                description: 'Force close shift memerlukan konfirmasi password ulang.',
                meta: [
                    'severity' => 'high',
                    'route' => $request->route()?->getName(),
                ],
            );

            return redirect()->route('password.confirm');
        }

        $closedShift = $this->cashierShiftService->closeShift(
            shift: $cashierShift,
            actor: $request->user(),
            actualCash: (int) $request->validated('actual_cash'),
            closeNotes: $request->validated('close_notes'),
            forceClose: $forceClose,
        );

        $this->auditLogService->log(
            event: $forceClose ? 'cashier_shift.force_closed' : 'cashier_shift.closed',
            module: 'cashier_shifts',
            auditable: $closedShift,
            description: $forceClose ? 'Shift kasir ditutup paksa.' : 'Shift kasir ditutup.',
            before: $before,
            after: $this->shiftAuditPayload($closedShift),
            meta: [
                'cashier_id' => $closedShift->user_id,
                'closed_by' => $closedShift->closed_by,
            ],
        );

        return to_route('cashier-shifts.show', $closedShift)->with('success', 'Shift kasir berhasil ditutup.');
    }

    private function resolveVisibleShift(Request $request, CashierShift $cashierShift): CashierShift
    {
        $query = CashierShift::query()
            ->with(['user:id,name', 'openedBy:id,name', 'closedBy:id,name', 'operators:id,name', 'outlet:id,name,code'])
            ->whereKey($cashierShift->id);

        $query = $this->cashierShiftService->visibleToUser($query, $request->user());

        return $query->firstOrFail();
    }

    private function transformShift(CashierShift $shift): array
    {
        $summary = $this->cashierShiftService->calculateSummary($shift);
        $baseSettlement = $this->cashierShiftService->calculateBaseSettlementSummary($shift);
        $recipientUserId = Setting::getInt('cashier_base_settlement_recipient_user_id', 0, $shift->outlet_id);
        $recipientUser = $recipientUserId > 0
            ? User::query()->select('id', 'name')->find($recipientUserId)
            : null;

        return [
            'id' => $shift->id,
            'status' => $shift->status,
            'outlet' => $shift->outlet ? [
                'id' => $shift->outlet->id,
                'name' => $shift->outlet->name,
                'code' => $shift->outlet->code,
            ] : null,
            'opened_at' => optional($shift->opened_at)?->toISOString(),
            'closed_at' => optional($shift->closed_at)?->toISOString(),
            'opening_cash' => (int) $shift->opening_cash,
            'expected_cash' => $shift->isOpen() ? $summary['expected_cash'] : (int) $shift->expected_cash,
            'actual_cash' => $shift->actual_cash !== null ? (int) $shift->actual_cash : null,
            'cash_difference' => $shift->isOpen()
                ? null
                : ($shift->cash_difference !== null ? (int) $shift->cash_difference : null),
            'cash_sales_total' => $shift->isOpen() ? $summary['cash_sales_total'] : (int) $shift->cash_sales_total,
            'non_cash_sales_total' => $shift->isOpen() ? $summary['non_cash_sales_total'] : (int) $shift->non_cash_sales_total,
            'cash_refund_total' => $shift->isOpen() ? $summary['cash_refund_total'] : (int) $shift->cash_refund_total,
            'non_cash_refund_total' => $shift->isOpen() ? $summary['non_cash_refund_total'] : (int) $shift->non_cash_refund_total,
            'transactions_count' => $shift->isOpen() ? $summary['transactions_count'] : (int) $shift->transactions_count,
            'walk_in_transactions_count' => $summary['walk_in_transactions_count'],
            'registered_transactions_count' => $summary['registered_transactions_count'],
            'sales_returns_count' => $shift->isOpen() ? $summary['sales_returns_count'] : (int) $shift->sales_returns_count,
            'paid_transactions_count' => (int) $baseSettlement['paid_transactions_count'],
            'gross_sales_total' => (int) $baseSettlement['gross_sales_total'],
            'base_sales_total' => (int) $baseSettlement['base_sales_total'],
            'pricing_discount_total' => (int) $baseSettlement['pricing_discount_total'],
            'pricing_reference_total' => (int) $baseSettlement['pricing_reference_total'],
            'markup_total' => (int) $baseSettlement['markup_total'],
            'notes' => $shift->notes,
            'close_notes' => $shift->close_notes,
            'settlement_recipient' => $recipientUser ? [
                'id' => $recipientUser->id,
                'name' => $recipientUser->name,
            ] : null,
            'user' => $shift->user ? [
                'id' => $shift->user->id,
                'name' => $shift->user->name,
            ] : null,
            'operators' => $shift->operators
                ->map(fn (User $operator) => [
                    'id' => $operator->id,
                    'name' => $operator->name,
                ])
                ->values()
                ->all(),
            'opened_by' => $shift->openedBy ? [
                'id' => $shift->openedBy->id,
                'name' => $shift->openedBy->name,
            ] : null,
            'closed_by' => $shift->closedBy ? [
                'id' => $shift->closedBy->id,
                'name' => $shift->closedBy->name,
            ] : null,
        ];
    }

    private function transformShiftTransaction(Transaction $transaction, \Illuminate\Support\Collection $runningExpectedCashMap): array
    {
        $pricing = $this->cashierShiftService->transactionPricingSummary($transaction);
        $completedReturns = $transaction->salesReturns
            ->where('status', 'completed');
        $returnedAmount = (int) ($completedReturns->sum('refund_amount') + $completedReturns->sum('credited_amount'));
        $paymentMethod = strtolower((string) ($transaction->payment_method ?? ''));
        $paymentStatus = strtolower((string) ($transaction->payment_status ?? ''));
        $cashReceived = (int) ($transaction->cash ?? 0);
        $cashChange = (int) ($transaction->change ?? 0);
        $expectedCashIn = $paymentMethod === 'cash'
            ? max(0, (int) ($transaction->grand_total ?? 0))
            : 0;
        $netCashReceived = max(0, $cashReceived - $cashChange);
        $cashFlowIsAnomalous = $paymentMethod === 'cash'
            && $paymentStatus === 'paid'
            && ($cashReceived < $expectedCashIn || $netCashReceived !== $expectedCashIn);

        return [
            'id' => $transaction->id,
            'invoice' => $transaction->invoice,
            'customer_name' => $transaction->customer?->name ?? 'Pelanggan umum',
            'cashier_name' => $transaction->cashier?->name ?? '-',
            'waiter_name' => $transaction->waiter?->name ?? null,
            'order_type' => $transaction->order_type,
            'payment_method' => $transaction->payment_method,
            'payment_method_label' => $this->humanizePaymentMethod($transaction->payment_method),
            'payment_status' => $transaction->payment_status,
            'cash_received' => $cashReceived,
            'cash_change' => $cashChange,
            'expected_cash_in' => $expectedCashIn,
            'expected_non_cash_in' => $paymentMethod !== 'cash'
                && $paymentStatus === 'paid'
                    ? max(0, (int) ($transaction->grand_total ?? 0))
                    : 0,
            'running_expected_cash' => (int) ($runningExpectedCashMap->get($transaction->id, (int) ($transaction->grand_total ?? 0)) ?? 0),
            'cash_flow_is_anomalous' => $cashFlowIsAnomalous,
            'grand_total' => (int) ($transaction->grand_total ?? 0),
            'base_sales_total' => (int) ($pricing['base_sales_total'] ?? 0),
            'markup_total' => (int) ($pricing['markup_total'] ?? 0),
            'pricing_discount_total' => (int) ($pricing['pricing_discount_total'] ?? 0),
            'sales_returns_count' => (int) $completedReturns->count(),
            'returned_amount' => $returnedAmount,
            'items_count' => (int) $transaction->details->count(),
            'table_label' => $this->tableLabel($transaction),
            'created_at' => $this->transactionCreatedAt($transaction)?->toIso8601String(),
        ];
    }

    private function transactionCreatedAt(Transaction $transaction): ?\Carbon\Carbon
    {
        $raw = $transaction->getRawOriginal('created_at');

        return ReportTimezone::sourceToDisplayCarbon($raw);
    }

    private function tableLabel(Transaction $transaction): ?string
    {
        $code = trim((string) ($transaction->diningTable?->code ?? ''));
        $name = trim((string) ($transaction->diningTable?->name ?? ''));

        return match (true) {
            $code !== '' && $name !== '' => $code.' • '.$name,
            $code !== '' => $code,
            $name !== '' => $name,
            default => null,
        };
    }

    private function humanizePaymentMethod(?string $paymentMethod): string
    {
        return match (strtolower((string) $paymentMethod)) {
            'cash' => 'Tunai',
            'qris' => 'QRIS',
            'bank_transfer' => 'Transfer Bank',
            'pay_later' => 'Bayar Nanti',
            'edc', 'debit_card' => 'EDC / Kartu Debit',
            'credit_card' => 'Kartu Kredit',
            default => $paymentMethod ? ucwords(str_replace('_', ' ', $paymentMethod)) : 'Lainnya',
        };
    }

    private function transactionFilters(Request $request): array
    {
        return [
            'q' => trim((string) $request->input('q', '')),
            'payment_method' => trim((string) $request->input('payment_method', '')),
            'payment_status' => trim((string) $request->input('payment_status', '')),
            'order_type' => trim((string) $request->input('order_type', '')),
        ];
    }

    private function transactionsPerPage(Request $request): int
    {
        $perPage = (int) $request->input('per_page', 10);
        $allowed = [10, 25, 50, 100];

        return in_array($perPage, $allowed, true) ? $perPage : 10;
    }

    private function tenantBreakdown(\Illuminate\Support\Collection $transactionIds): \Illuminate\Support\Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        return TransactionDetail::query()
            ->leftJoin('outlets as tenant_outlets', 'tenant_outlets.id', '=', 'transaction_details.tenant_outlet_id')
            ->whereIn('transaction_details.transaction_id', $transactionIds->all())
            ->whereNotNull('transaction_details.tenant_outlet_id')
            ->selectRaw('
                transaction_details.tenant_outlet_id,
                COALESCE(tenant_outlets.name, "Tenant Tidak Dikenal") as tenant_name,
                COALESCE(SUM(transaction_details.qty), 0) as total_qty,
                COALESCE(SUM(transaction_details.price), 0) as total_gross_sales,
                COALESCE(SUM(
                    CASE
                        WHEN transaction_details.tenant_net_total > 0 THEN transaction_details.tenant_net_total
                        WHEN transaction_details.tenant_base_unit_price > 0 THEN transaction_details.tenant_base_unit_price * transaction_details.qty
                        ELSE COALESCE(transaction_details.base_unit_price, 0) * transaction_details.qty
                    END
                ), 0) as total_tenant_sales,
                COALESCE(SUM(
                    CASE
                        WHEN transaction_details.owner_net_total > 0 THEN transaction_details.owner_net_total
                        WHEN transaction_details.owner_markup_unit_price > 0 THEN transaction_details.owner_markup_unit_price * transaction_details.qty
                        ELSE 0
                    END
                ), 0) as total_owner_markup
            ')
            ->groupBy('transaction_details.tenant_outlet_id', 'tenant_outlets.name')
            ->orderByDesc('total_tenant_sales')
            ->get()
            ->map(fn ($row) => [
                'tenant_name' => (string) ($row->tenant_name ?? 'Tenant Tidak Dikenal'),
                'total_qty' => (int) ($row->total_qty ?? 0),
                'total_gross_sales' => (int) ($row->total_gross_sales ?? 0),
                'total_tenant_sales' => (int) ($row->total_tenant_sales ?? 0),
                'total_owner_markup' => (int) ($row->total_owner_markup ?? 0),
            ])
            ->values();
    }

    private function productBreakdown(\Illuminate\Support\Collection $transactionIds): \Illuminate\Support\Collection
    {
        if ($transactionIds->isEmpty()) {
            return collect();
        }

        return TransactionDetail::query()
            ->leftJoin('products', 'products.id', '=', 'transaction_details.product_id')
            ->whereIn('transaction_details.transaction_id', $transactionIds->all())
            ->selectRaw('
                transaction_details.product_id,
                COALESCE(products.title, "Produk Tidak Dikenal") as product_title,
                COALESCE(SUM(transaction_details.qty), 0) as total_qty,
                COALESCE(SUM(transaction_details.price), 0) as total_gross_sales,
                COALESCE(SUM(
                    CASE
                        WHEN transaction_details.tenant_net_total > 0 THEN transaction_details.tenant_net_total
                        WHEN transaction_details.tenant_base_unit_price > 0 THEN transaction_details.tenant_base_unit_price * transaction_details.qty
                        ELSE COALESCE(transaction_details.base_unit_price, 0) * transaction_details.qty
                    END
                ), 0) as total_tenant_sales,
                COALESCE(SUM(
                    CASE
                        WHEN transaction_details.owner_net_total > 0 THEN transaction_details.owner_net_total
                        WHEN transaction_details.owner_markup_unit_price > 0 THEN transaction_details.owner_markup_unit_price * transaction_details.qty
                        ELSE 0
                    END
                ), 0) as total_owner_markup
            ')
            ->groupBy('transaction_details.product_id', 'products.title')
            ->orderByDesc('total_qty')
            ->orderByDesc('total_tenant_sales')
            ->get()
            ->map(fn ($row) => [
                'product_title' => (string) ($row->product_title ?? 'Produk Tidak Dikenal'),
                'total_qty' => (int) ($row->total_qty ?? 0),
                'total_gross_sales' => (int) ($row->total_gross_sales ?? 0),
                'total_tenant_sales' => (int) ($row->total_tenant_sales ?? 0),
                'total_owner_markup' => (int) ($row->total_owner_markup ?? 0),
            ])
            ->values();
    }

    private function involvedCashiers(CashierShift $cashierShift): array
    {
        return collect([
            $cashierShift->user?->name,
            ...$cashierShift->operators->pluck('name')->all(),
        ])
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function shiftPdfMeta(CashierShift $cashierShift): array
    {
        return [
            'opened_at' => ReportTimezone::formatSourceDateTime($cashierShift->getRawOriginal('opened_at'), 'd/m/Y H:i:s'),
            'closed_at' => ReportTimezone::formatSourceDateTime($cashierShift->getRawOriginal('closed_at'), 'd/m/Y H:i:s'),
        ];
    }

    private function storeProfile(CashierShift $cashierShift): array
    {
        $profile = $cashierShift->outlet?->profilePayload() ?? [];
        $logo = $profile['logo'] ?? null;
        $logoData = null;

        if ($logo) {
            $localPath = null;

            if (str_starts_with($logo, asset('storage'))) {
                $localPath = public_path(str_replace(asset(''), '', $logo));
            } elseif (Str::startsWith($logo, '/storage')) {
                $localPath = public_path($logo);
            }

            if ($localPath && file_exists($localPath)) {
                $logoData = 'data:image/png;base64,'.base64_encode(file_get_contents($localPath));
            }
        }

        return [
            'name' => $profile['name'] ?? ($cashierShift->outlet?->name ?? 'Outlet'),
            'code' => $profile['code'] ?? ($cashierShift->outlet?->code ?? ''),
            'logo' => $logo,
            'logo_data' => $logoData,
            'address' => $profile['address'] ?? '',
            'phone' => $profile['phone'] ?? '',
            'email' => $profile['email'] ?? '',
            'website' => $profile['website'] ?? '',
            'city' => $profile['city'] ?? '',
        ];
    }

    private function runningExpectedCashMap(CashierShift $cashierShift): \Illuminate\Support\Collection
    {
        $runningCash = (int) ($cashierShift->opening_cash ?? 0);

        return Transaction::query()
            ->where('cashier_shift_id', $cashierShift->id)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get(['id', 'payment_method', 'payment_status', 'grand_total'])
            ->mapWithKeys(function (Transaction $transaction) use (&$runningCash) {
                if (
                    strtolower((string) ($transaction->payment_method ?? '')) === 'cash'
                    && strtolower((string) ($transaction->payment_status ?? '')) === 'paid'
                ) {
                    $runningCash += max(0, (int) ($transaction->grand_total ?? 0));
                }

                return [$transaction->id => $runningCash];
            });
    }

    private function shiftAuditPayload(CashierShift $shift): array
    {
        return [
            'status' => $shift->status,
            'opening_cash' => (int) $shift->opening_cash,
            'expected_cash' => (int) ($shift->expected_cash ?? $shift->opening_cash),
            'actual_cash' => $shift->actual_cash !== null ? (int) $shift->actual_cash : null,
            'cash_difference' => $shift->cash_difference !== null ? (int) $shift->cash_difference : null,
            'transactions_count' => (int) ($shift->transactions_count ?? 0),
            'sales_returns_count' => (int) ($shift->sales_returns_count ?? 0),
        ];
    }
}
