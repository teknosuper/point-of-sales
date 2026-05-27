<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceiving;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\SupplierReturn;
use App\Services\OutletResolver;
use App\Services\StockMutationService;
use App\Services\SupplierReturnService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class SupplierReturnController extends Controller
{
    public function __construct(
        private readonly SupplierReturnService $supplierReturnService,
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

        $query = SupplierReturn::with([
            'supplier:id,name',
            'creator:id,name',
        ])->when($outlet, fn ($builder) => $builder->where('outlet_id', $outlet->id))
            ->withCount('items as items_count')
            ->orderByDesc('created_at');

        $query->when($filters['status'], fn ($q, $s) => $q->where('status', $s))
            ->when($filters['supplier'], fn ($q, $s) => $q->where('supplier_id', $s))
            ->when($filters['search'], fn ($q, $s) => $q->where('document_number', 'like', "%{$s}%"));

        $returns = $query->paginate(10)->withQueryString();
        $suppliers = $this->supplierOptions($outlet);

        return Inertia::render('Dashboard/SupplierReturns/Index', [
            'returns' => $returns,
            'filters' => $filters,
            'suppliers' => $suppliers,
        ]);
    }

    public function create(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $suppliers = $this->supplierOptions($outlet);

        $goodsReceivings = collect();
        if ($request->input('supplier_id')) {
            $goodsReceivings = GoodsReceiving::with([
                'supplier:id,name',
                'items.product:id,title,sku',
                'items.purchaseOrderItem:id,unit_price',
            ])->where('supplier_id', $request->input('supplier_id'))
                ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
                ->whereHas('purchaseOrder', fn ($q) => $q->whereIn('status', ['ordered', 'partial_received', 'completed']))
                ->orderByDesc('received_at')
                ->get();
        }

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

        return Inertia::render('Dashboard/SupplierReturns/Create', [
            'suppliers' => $suppliers,
            'goodsReceivings' => $goodsReceivings,
            'products' => $products,
        ]);
    }

    public function store(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $data = $request->validate([
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'goods_receiving_id' => ['nullable', 'exists:goods_receivings,id'],
            'payable_id' => ['nullable', 'exists:payables,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.qty_returned' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.reason' => ['nullable', 'string', 'max:100'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
        ]);

        $this->assertSupplierBelongsToOutlet($outlet?->id, $data['supplier_id'] ?? null);
        $this->assertProductsBelongToOutlet($outlet?->id, $outlet?->outlet_type, $data['items'] ?? []);

        $return = $this->supplierReturnService->createReturn(
            [
                ...$data,
                'outlet_id' => $outlet?->id,
            ],
            $data['items'],
            $request->user()->id,
        );

        return redirect()
            ->route('supplier-returns.show', $return)
            ->with('success', 'Retur supplier berhasil dibuat.');
    }

    public function show(Request $request, SupplierReturn $supplierReturn)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        if ($outlet && (int) $supplierReturn->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        $supplierReturn->load([
            'supplier:id,name,phone,email,address',
            'goodsReceiving:id,document_number',
            'payable:id,total,paid,status,document_number',
            'items.product:id,title,sku',
            'items.goodsReceivingItem',
            'creator:id,name',
        ]);

        return Inertia::render('Dashboard/SupplierReturns/Show', [
            'return' => $supplierReturn,
        ]);
    }

    public function complete(Request $request, SupplierReturn $supplierReturn)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        if ($outlet && (int) $supplierReturn->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        if ($supplierReturn->status !== 'draft') {
            return back()->with('error', 'Hanya retur dengan status draft yang bisa diselesaikan.');
        }

        $this->supplierReturnService->complete($supplierReturn);

        return redirect()
            ->route('supplier-returns.show', $supplierReturn)
            ->with('success', 'Retur supplier berhasil diselesaikan.');
    }

    public function cancel(Request $request, SupplierReturn $supplierReturn)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        if ($outlet && (int) $supplierReturn->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        if (! in_array($supplierReturn->status, ['draft'])) {
            return back()->with('error', 'Retur tidak dapat dibatalkan.');
        }

        $this->supplierReturnService->cancel($supplierReturn);

        return redirect()
            ->route('supplier-returns.index')
            ->with('success', 'Retur supplier dibatalkan.');
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
                'items' => 'Tenant hanya dapat membuat retur untuk produk miliknya sendiri.',
            ]);
        }
    }
}
