<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\TableOrder;
use App\Services\TableOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Throwable;

class TableOrderController extends Controller
{
    public function __construct(
        private readonly TableOrderService $tableOrderService
    ) {}

    public function index(Request $request)
    {
        $outlet = app(\App\Services\OutletResolver::class)->resolve($request, $request->user());
        $filters = [
            'status' => (string) $request->input('status', 'pending_cashier_payment'),
            'search' => trim((string) $request->input('search', '')),
        ];

        $query = TableOrder::query()
            ->with([
                'diningTable:id,name,code',
                'items',
                'transaction:id,invoice,payment_status,payment_method',
            ])
            ->when($outlet, fn ($builder) => $builder->where('outlet_id', $outlet->id))
            ->when($filters['status'] !== '', fn ($builder) => $builder->where('status', $filters['status']))
            ->when($filters['search'] !== '', function ($builder) use ($filters) {
                $search = $filters['search'];
                $builder->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('order_number', 'like', '%'.$search.'%')
                        ->orWhere('customer_name', 'like', '%'.$search.'%')
                        ->orWhereHas('diningTable', fn ($tableQuery) => $tableQuery
                            ->where('name', 'like', '%'.$search.'%')
                            ->orWhere('code', 'like', '%'.$search.'%'));
                });
            })
            ->latest();

        $orders = $query
            ->paginate(15)
            ->withQueryString()
            ->through(fn (TableOrder $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'notes' => $order->notes,
                'payment_method' => $order->payment_method,
                'status' => $order->status,
                'subtotal' => (int) $order->subtotal,
                'grand_total' => (int) $order->grand_total,
                'approved_at' => optional($order->approved_at)->toISOString(),
                'created_at' => optional($order->created_at)->toISOString(),
                'table' => [
                    'name' => $order->diningTable?->name,
                    'code' => $order->diningTable?->code,
                ],
                'transaction' => $order->transaction ? [
                    'invoice' => $order->transaction->invoice,
                    'payment_status' => $order->transaction->payment_status,
                    'payment_method' => $order->transaction->payment_method,
                ] : null,
                'items' => $order->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_title' => $item->product_title,
                    'qty' => (int) $item->qty,
                    'line_total' => (int) $item->line_total,
                    'notes' => $item->notes,
                ])->values(),
            ]);

        $summaryQuery = TableOrder::query()
            ->when($outlet, fn ($builder) => $builder->where('outlet_id', $outlet->id));

        return Inertia::render('Dashboard/TableOrders/Index', [
            'orders' => $orders,
            'filters' => $filters,
            'summary' => [
                'pending_cashier_payment' => (clone $summaryQuery)->where('status', 'pending_cashier_payment')->count(),
                'pending_cashier_count' => (clone $summaryQuery)
                    ->where('status', 'pending_cashier_payment')
                    ->where(function ($builder) {
                        $builder
                            ->whereDoesntHave('transaction')
                            ->orWhereHas('transaction', fn ($transactionQuery) => $transactionQuery->whereIn('payment_method', ['cash', 'qris', 'bank_transfer']));
                    })
                    ->count(),
                'pending_online_count' => (clone $summaryQuery)
                    ->where('status', 'pending_cashier_payment')
                    ->whereHas('transaction', fn ($transactionQuery) => $transactionQuery->whereIn('payment_method', ['xendit', 'midtrans', 'pakasir']))
                    ->count(),
                'paid' => (clone $summaryQuery)->where('status', 'paid')->count(),
                'rejected' => (clone $summaryQuery)->where('status', 'rejected')->count(),
                'cancelled' => (clone $summaryQuery)->where('status', 'cancelled')->count(),
            ],
        ]);
    }

    public function approve(Request $request, TableOrder $tableOrder)
    {
        $outlet = app(\App\Services\OutletResolver::class)->resolve($request, $request->user());
        if ($outlet && (int) $tableOrder->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        $validated = $request->validate([
            'cash' => ['required', 'integer', 'min:0'],
            'payment_method' => ['required', 'string', 'in:cash,qris'],
            'redirect_to' => ['nullable', 'string', 'in:print,list,transactions'],
        ]);

        try {
            $transaction = $this->tableOrderService->approvePayment(
                $tableOrder,
                $request->user(),
                (int) $validated['cash'],
                (string) $validated['payment_method']
            );
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            Log::error('Gagal mengonfirmasi pembayaran table order.', [
                'table_order_id' => $tableOrder->id,
                'order_number' => $tableOrder->order_number,
                'cashier_id' => $request->user()?->id,
                'payment_method' => $validated['payment_method'],
                'message' => $exception->getMessage(),
            ]);

            return back()->withErrors([
                'approval' => filled($exception->getMessage())
                    ? 'Gagal mengonfirmasi pembayaran order meja: '.$exception->getMessage()
                    : 'Gagal mengonfirmasi pembayaran order meja.',
            ]);
        }

        $redirectTo = $validated['redirect_to'] ?? 'print';

        if ($redirectTo === 'list') {
            return redirect()
                ->route('table-orders.index')
                ->with('success', "Pembayaran {$tableOrder->order_number} dikonfirmasi. Invoice {$transaction->invoice} diteruskan ke dapur.");
        }

        if ($redirectTo === 'transactions') {
            return redirect()
                ->route('transactions.index')
                ->with('success', "Pembayaran {$tableOrder->order_number} dikonfirmasi. Invoice {$transaction->invoice} siap dicetak.");
        }

        return redirect()
            ->route('transactions.print', $transaction->invoice)
            ->with('success', "Pembayaran {$tableOrder->order_number} dikonfirmasi. Invoice {$transaction->invoice} diteruskan ke dapur.");
    }

    public function cancel(Request $request, TableOrder $tableOrder)
    {
        $outlet = app(\App\Services\OutletResolver::class)->resolve($request, $request->user());
        if ($outlet && (int) $tableOrder->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:300'],
            'redirect_to' => ['nullable', 'string', 'in:list,transactions'],
        ]);

        $this->tableOrderService->cancel(
            $tableOrder,
            $request->user(),
            filled($validated['reason'] ?? null) ? (string) $validated['reason'] : null
        );

        $redirectTo = $validated['redirect_to'] ?? 'list';

        return redirect()
            ->route($redirectTo === 'transactions' ? 'transactions.index' : 'table-orders.index')
            ->with('success', "Order {$tableOrder->order_number} berhasil dibatalkan.");
    }

    public function updateItems(Request $request, TableOrder $tableOrder)
    {
        $outlet = app(\App\Services\OutletResolver::class)->resolve($request, $request->user());
        if ($outlet && (int) $tableOrder->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        $validated = $request->validate([
            'items' => ['required', 'array'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:300'],
            'items.*.modifier_ids' => ['nullable', 'array'],
            'items.*.modifier_ids.*.id' => ['required', 'integer'],
        ]);

        $updatedTableOrder = $this->tableOrderService->updateItems(
            $tableOrder,
            $validated['items'],
            $request->user()
        );

        $wasCancelled = $updatedTableOrder->status === 'cancelled';
        $message = $wasCancelled
            ? "Order {$tableOrder->order_number} dibatalkan karena semua item dihapus."
            : "Order {$tableOrder->order_number} berhasil diupdate.";

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $updatedTableOrder,
            ]);
        }

        return redirect()
            ->route('transactions.index', $wasCancelled ? [] : ['open_table_order' => $tableOrder->id])
            ->with('success', $message);
    }
}
