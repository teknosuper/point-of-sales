<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Services\OutletResolver;
use App\Services\StockMutationService;
use App\Services\PurchaseOrderService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PurchaseOrderController extends Controller
{
    public function __construct(
        private readonly PurchaseOrderService $purchaseOrderService,
        private readonly OutletResolver $outletResolver,
        private readonly StockMutationService $stockMutationService
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $filters = [
            'status' => $request->input('status'),
            'supplier' => $request->input('supplier'),
            'search' => $request->input('search'),
        ];

        $query = PurchaseOrder::with([
            'supplier:id,name',
            'items',
            'creator:id,name',
        ])->when($outlet, fn ($builder) => $builder->where('outlet_id', $outlet->id))
            ->withCount('items as items_count')
            ->orderByDesc('created_at');

        $query->when($filters['status'], fn ($q, $s) => $q->where('status', $s))
            ->when($filters['supplier'], fn ($q, $s) => $q->where('supplier_id', $s))
            ->when($filters['search'], fn ($q, $s) => $q->where('document_number', 'like', "%{$s}%"));

        $orders = $query->paginate(10)->withQueryString();
        $suppliers = Supplier::orderBy('name')->get(['id', 'name']);

        return Inertia::render('Dashboard/PurchaseOrders/Index', [
            'orders' => $orders,
            'filters' => $filters,
            'suppliers' => $suppliers,
        ]);
    }

    public function create(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $suppliers = Supplier::orderBy('name')->get(['id', 'name']);
        $products = Product::orderBy('title')->get(['id', 'title', 'sku', 'buy_price', 'stock'])
            ->map(function (Product $product) use ($outlet) {
                if ($outlet) {
                    $product->setAttribute('stock', $this->stockMutationService->stockForOutlet($product, $outlet->id));
                }

                return $product;
            });

        return Inertia::render('Dashboard/PurchaseOrders/Create', [
            'suppliers' => $suppliers,
            'products' => $products,
        ]);
    }

    public function store(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $data = $request->validate([
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'document_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.qty_ordered' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        $order = $this->purchaseOrderService->createOrder([
            ...$data,
            'outlet_id' => $outlet?->id,
        ], $data['items'], $request->user()->id);

        return redirect()
            ->route('purchase-orders.show', $order)
            ->with('success', 'Purchase order berhasil dibuat.');
    }

    public function show(Request $request, PurchaseOrder $purchaseOrder)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        if ($outlet && (int) $purchaseOrder->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        $purchaseOrder->load([
            'supplier:id,name,phone,email,address',
            'items.product:id,title,sku,image',
            'goodsReceivings' => function ($q) {
                $q->with('items.product:id,title,sku')->orderByDesc('received_at');
            },
            'creator:id,name',
            'payable:id,purchase_order_id,total,paid,status,document_number',
        ]);

        return Inertia::render('Dashboard/PurchaseOrders/Show', [
            'order' => $purchaseOrder,
        ]);
    }

    public function placeOrder(Request $request, PurchaseOrder $purchaseOrder)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        if ($outlet && (int) $purchaseOrder->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        if ($purchaseOrder->status !== 'draft') {
            return back()->with('error', 'Hanya PO dengan status draft yang bisa dipesan.');
        }

        $this->purchaseOrderService->placeOrder($purchaseOrder);

        return redirect()
            ->route('purchase-orders.show', $purchaseOrder)
            ->with('success', 'Purchase order berhasil dipesan.');
    }

    public function cancel(Request $request, PurchaseOrder $purchaseOrder)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        if ($outlet && (int) $purchaseOrder->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        if (! in_array($purchaseOrder->status, ['draft', 'ordered', 'partial_received'])) {
            return back()->with('error', 'PO tidak dapat dibatalkan.');
        }

        $this->purchaseOrderService->cancelOrder($purchaseOrder);

        return redirect()
            ->route('purchase-orders.index')
            ->with('success', 'Purchase order dibatalkan.');
    }
}
