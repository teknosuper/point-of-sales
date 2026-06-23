<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Services\AuditLogService;
use App\Services\OutletResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ExpenseController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver,
        private readonly AuditLogService $auditLogService,
    ) {}

    public function index(Request $request): Response
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $activeOutlet, 404, 'Outlet aktif tidak ditemukan.');

        $filters = [
            'q' => trim((string) $request->input('q', '')),
            'start_date' => (string) $request->input('start_date', ''),
            'end_date' => (string) $request->input('end_date', ''),
            'status' => (string) $request->input('status', ''),
            'category' => (string) $request->input('category', ''),
        ];

        $query = Expense::query()
            ->with('creator:id,name')
            ->where('outlet_id', $activeOutlet->id)
            ->when($filters['q'] !== '', function ($builder) use ($filters) {
                $builder->where(function ($nested) use ($filters) {
                    $nested
                        ->where('description', 'like', '%'.$filters['q'].'%')
                        ->orWhere('category', 'like', '%'.$filters['q'].'%')
                        ->orWhere('notes', 'like', '%'.$filters['q'].'%');
                });
            })
            ->when($filters['status'] !== '', fn ($builder) => $builder->where('status', $filters['status']))
            ->when($filters['category'] !== '', fn ($builder) => $builder->where('category', $filters['category']))
            ->when($filters['start_date'] !== '', fn ($builder) => $builder->whereDate('expense_date', '>=', $filters['start_date']))
            ->when($filters['end_date'] !== '', fn ($builder) => $builder->whereDate('expense_date', '<=', $filters['end_date']))
            ->orderByDesc('expense_date')
            ->orderByDesc('id');

        $rows = (clone $query)
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Expense $expense) => [
                'id' => $expense->id,
                'expense_date' => optional($expense->expense_date)->toDateString(),
                'category' => $expense->category,
                'description' => $expense->description,
                'amount' => (int) $expense->amount,
                'payment_method' => $expense->payment_method,
                'status' => $expense->status,
                'notes' => $expense->notes,
                'created_by_name' => $expense->creator?->name,
            ]);

        $allRows = (clone $query)->get();

        return Inertia::render('Dashboard/Settings/Expenses', [
            'expenses' => $rows,
            'filters' => $filters,
            'summary' => [
                'total_count' => $allRows->count(),
                'expense_total' => (int) $allRows->sum('amount'),
                'paid_total' => (int) $allRows->where('status', Expense::STATUS_PAID)->sum('amount'),
                'unpaid_total' => (int) $allRows->where('status', Expense::STATUS_UNPAID)->sum('amount'),
            ],
            'categories' => Expense::query()
                ->where('outlet_id', $activeOutlet->id)
                ->select('category')
                ->distinct()
                ->orderBy('category')
                ->pluck('category')
                ->values(),
            'statusOptions' => [
                ['id' => Expense::STATUS_PAID, 'name' => 'Paid'],
                ['id' => Expense::STATUS_UNPAID, 'name' => 'Unpaid'],
            ],
            'paymentMethodOptions' => [
                ['id' => 'cash', 'name' => 'Cash'],
                ['id' => 'bank_transfer', 'name' => 'Transfer Bank'],
                ['id' => 'qris', 'name' => 'QRIS'],
                ['id' => 'other', 'name' => 'Lainnya'],
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $activeOutlet, 404, 'Outlet aktif tidak ditemukan.');

        $validated = $this->validateExpense($request);

        $expense = Expense::create([
            ...$validated,
            'outlet_id' => $activeOutlet->id,
            'created_by' => $request->user()?->id,
        ]);

        $this->auditLogService->log(
            event: 'expense.created',
            module: 'expenses',
            auditable: $expense,
            description: 'Expense operasional ditambahkan.',
            after: $expense->toArray(),
        );

        return back()->with('success', 'Pengeluaran berhasil ditambahkan.');
    }

    public function update(Request $request, Expense $expense): RedirectResponse
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $activeOutlet || (int) $expense->outlet_id !== (int) $activeOutlet->id, 404);

        $validated = $this->validateExpense($request);
        $before = $expense->toArray();
        $expense->update($validated);

        $this->auditLogService->log(
            event: 'expense.updated',
            module: 'expenses',
            auditable: $expense,
            description: 'Expense operasional diperbarui.',
            before: $before,
            after: $expense->fresh()->toArray(),
        );

        return back()->with('success', 'Pengeluaran berhasil diperbarui.');
    }

    public function destroy(Request $request, Expense $expense): RedirectResponse
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $activeOutlet || (int) $expense->outlet_id !== (int) $activeOutlet->id, 404);

        $before = $expense->toArray();
        $expense->delete();

        $this->auditLogService->log(
            event: 'expense.deleted',
            module: 'expenses',
            auditable: ['expense_id' => $before['id'] ?? null],
            description: 'Expense operasional dihapus.',
            before: $before,
        );

        return back()->with('success', 'Pengeluaran berhasil dihapus.');
    }

    private function validateExpense(Request $request): array
    {
        return $request->validate([
            'expense_date' => ['required', 'date'],
            'category' => ['required', 'string', 'max:100'],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'status' => ['required', 'in:paid,unpaid'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }
}
