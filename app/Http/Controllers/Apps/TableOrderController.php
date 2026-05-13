<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\TableOrder;
use App\Services\TableOrderService;
use Illuminate\Http\Request;
use Inertia\Inertia;

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
                'transaction:id,invoice,payment_status',
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
                'paid' => (clone $summaryQuery)->where('status', 'paid')->count(),
                'rejected' => (clone $summaryQuery)->where('status', 'rejected')->count(),
            ],
        ]);
    }

    public function approve(Request $request, TableOrder $tableOrder)
    {
        $outlet = app(\App\Services\OutletResolver::class)->resolve($request, $request->user());
        if ($outlet && (int) $tableOrder->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        $transaction = $this->tableOrderService->approveCashPayment($tableOrder, $request->user());

        return redirect()
            ->route('table-orders.index')
            ->with('success', "Pembayaran {$tableOrder->order_number} dikonfirmasi. Invoice {$transaction->invoice} diteruskan ke dapur.");
    }
}
