<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceiving;
use App\Models\PurchaseOrder;
use App\Services\GoodsReceivingService;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GoodsReceivingController extends Controller
{
    public function __construct(
        private readonly GoodsReceivingService $goodsReceivingService,
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $filters = [
            'search' => $request->input('search'),
            'purchase_order_id' => $request->input('purchase_order_id'),
        ];

        $query = GoodsReceiving::with([
            'purchaseOrder:id,document_number,status',
            'supplier:id,name',
            'receiver:id,name',
        ])->when($outlet, fn ($builder) => $builder->where('outlet_id', $outlet->id))
            ->orderByDesc('received_at');

        $query->when($filters['search'], fn ($q, $s) => $q->where('document_number', 'like', "%{$s}%"))
            ->when($filters['purchase_order_id'], fn ($q, $id) => $q->where('purchase_order_id', $id));

        $receivings = $query->paginate(10)->withQueryString();

        return Inertia::render('Dashboard/GoodsReceivings/Index', [
            'receivings' => $receivings,
            'filters' => $filters,
        ]);
    }

    public function create(Request $request)
    {
        $purchaseOrderId = $request->input('purchase_order_id');
        $outlet = $this->outletResolver->resolve($request, $request->user());

        $orders = PurchaseOrder::with([
            'supplier:id,name',
            'items.product:id,title,sku',
        ])->whereIn('status', ['ordered', 'partial_received'])
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->orderByDesc('created_at')
            ->get();

        if ($purchaseOrderId) {
            $orders = $orders->where('id', $purchaseOrderId);
        }

        return Inertia::render('Dashboard/GoodsReceivings/Create', [
            'orders' => $orders,
        ]);
    }

    public function store(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $data = $request->validate([
            'purchase_order_id' => ['required', 'exists:purchase_orders,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.purchase_order_item_id' => ['required', 'exists:purchase_order_items,id'],
            'items.*.qty_received' => ['required', 'integer', 'min:1'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
        ]);

        $order = PurchaseOrder::with('items')
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->findOrFail($data['purchase_order_id']);

        foreach ($data['items'] as $item) {
            $poItem = $order->items->firstWhere('id', $item['purchase_order_item_id']);
            if (! $poItem) {
                return back()->with('error', 'Item tidak ditemukan di PO.');
            }
            $outstanding = $poItem->qty_ordered - $poItem->qty_received;
            if ($item['qty_received'] > $outstanding) {
                return back()->with('error', "Qty diterima melebihi sisa item {$poItem->product_id}.");
            }
        }

        $receiving = $this->goodsReceivingService->receive(
            order: $order,
            items: $data['items'],
            notes: $data['notes'] ?? null,
            userId: $request->user()->id,
        );

        return redirect()
            ->route('goods-receivings.show', $receiving)
            ->with('success', 'Penerimaan barang berhasil dicatat.');
    }

    public function show(Request $request, GoodsReceiving $goodsReceiving)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        if ($outlet && (int) $goodsReceiving->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        $goodsReceiving->load([
            'purchaseOrder:id,document_number,status',
            'supplier:id,name',
            'items.product:id,title,sku',
            'items.purchaseOrderItem:id,unit_price',
            'receiver:id,name',
        ]);

        return Inertia::render('Dashboard/GoodsReceivings/Show', [
            'receiving' => $goodsReceiving,
        ]);
    }
}
