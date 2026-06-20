<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Http\Requests\CloseCashierShiftRequest;
use App\Http\Requests\ConfirmPasswordForForceCloseRequest;
use App\Http\Requests\StoreCashierShiftRequest;
use App\Models\CashierShift;
use App\Models\Setting;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\CashierShiftService;
use App\Services\OutletResolver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
            ->when($filters['opened_from'], fn (Builder $builder, $date) => $builder->whereDate('opened_at', '>=', $date))
            ->when($filters['opened_to'], fn (Builder $builder, $date) => $builder->whereDate('opened_at', '<=', $date))
            ->when(
                $activeOutlet && ! $canViewAllShiftHistory,
                fn (Builder $builder) => $builder->where('outlet_id', $activeOutlet->id),
                fn (Builder $builder) => $canViewAllShiftHistory ? $builder : $builder->whereNull('outlet_id')
            )
            ->latest('opened_at');

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

        return Inertia::render('Dashboard/CashierShifts/Show', [
            'cashierShift' => $this->transformShift($cashierShift),
            'canForceClose' => $request->user()->isSuperAdmin() || $request->user()->can('cashier-shifts-force-close'),
        ]);
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
