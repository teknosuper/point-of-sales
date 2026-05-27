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
use Illuminate\Validation\ValidationException;
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
        $suppliers = $this->supplierOptions($outlet);

        return Inertia::render('Dashboard/PurchaseOrders/Index', [
            'orders' => $orders,
            'filters' => $filters,
            'suppliers' => $suppliers,
        ]);
    }

    public function create(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $suppliers = $this->supplierOptions($outlet);
        $products = Product::query()
            ->when(
                $outlet?->outlet_type === 'tenant',
                fn ($query) => $query->where('tenant_outlet_id', $outlet->id)
            )
            ->orderBy('title')
            ->get(['id', 'title', 'sku', 'buy_price', 'stock', 'tenant_outlet_id'])
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

        $this->assertSupplierBelongsToOutlet($outlet?->id, $data['supplier_id'] ?? null);
        $this->assertProductsBelongToOutlet($outlet?->id, $outlet?->outlet_type, $data['items'] ?? []);

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

    private function supplierOptions($outlet)
    {
        return Supplier::query()
            ->when(
                $outlet,
                fn ($query) => $query->where('outlet_id', $outlet->id),
                fn ($query) => $query->whereNull('outlet_id')
            )
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    private function assertSupplierBelongsToOutlet(?int $outletId, ?int $supplierId): void
    {
        if (! $supplierId) {
            return;
        }

        $exists = Supplier::query()
            ->whereKey($supplierId)
            ->when(
                $outletId,
                fn ($query) => $query->where('outlet_id', $outletId),
                fn ($query) => $query->whereNull('outlet_id')
            )
            ->exists();

        if (! $exists) {
            throw ValidationException::withMessages([
                'supplier_id' => 'Supplier tidak tersedia untuk outlet aktif.',
            ]);
        }
    }

    private function assertProductsBelongToOutlet(?int $outletId, ?string $outletType, array $items): void
    {
        if ($outletType !== 'tenant' || ! $outletId || $items === []) {
            return;
        }

        $productIds = collect($items)
            ->pluck('product_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $allowedCount = Product::query()
            ->whereIn('id', $productIds)
            ->where('tenant_outlet_id', $outletId)
            ->count();

        if ($allowedCount !== $productIds->count()) {
            throw ValidationException::withMessages([
                'items' => 'Tenant hanya dapat membuat procurement untuk produk miliknya sendiri.',
            ]);
        }
    }
}
