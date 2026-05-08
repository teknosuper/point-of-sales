<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreStockOpnameItemRequest;
use App\Http\Requests\StoreStockOpnameRequest;
use App\Http\Requests\UpdateStockOpnameItemRequest;
use App\Http\Requests\UpdateStockOpnameRequest;
use App\Models\Product;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Services\AuditLogService;
use App\Services\OutletResolver;
use App\Services\StockMutationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class StockOpnameController extends Controller
{
    public function __construct(
        private readonly StockMutationService $stockMutationService,
        private readonly AuditLogService $auditLogService,
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request): Response
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $filters = [
            'search' => $request->input('search'),
            'status' => $request->input('status'),
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
        ];

        $stockOpnames = StockOpname::query()
            ->with(['creator:id,name', 'finalizer:id,name'])
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->when($filters['search'], function ($query, $search) {
                $query->where(function ($builder) use ($search) {
                    $builder
                        ->where('code', 'like', '%'.$search.'%')
                        ->orWhere('notes', 'like', '%'.$search.'%');
                });
            })
            ->when($filters['status'], fn ($query, $status) => $query->where('status', $status))
            ->when($filters['date_from'], fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'], fn ($query, $date) => $query->whereDate('created_at', '<=', $date))
            ->withCount('items')
            ->latest()
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('Dashboard/StockOpnames/Index', [
            'stockOpnames' => $stockOpnames,
            'filters' => $filters,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Dashboard/StockOpnames/Create');
    }

    public function store(StoreStockOpnameRequest $request): RedirectResponse
    {
        $stockOpname = StockOpname::create([
            'code' => $this->generateCode(),
            'outlet_id' => $this->outletResolver->resolve($request, $request->user())?->id,
            'notes' => $request->validated('notes'),
            'status' => 'draft',
            'created_by' => $request->user()?->id,
        ]);

        return to_route('stock-opnames.show', $stockOpname);
    }

    public function show(Request $request, StockOpname $stockOpname): Response
    {
        $this->ensureAccessibleOutlet($request, $stockOpname->outlet_id);
        $stockOpname->load([
            'creator:id,name',
            'finalizer:id,name',
            'items.product.category:id,name',
        ]);

        $productFilters = [
            'search' => $request->input('product_search', ''),
        ];

        $selectedProductIds = $stockOpname->items->pluck('product_id');

        $availableProducts = blank($productFilters['search'])
            ? collect()
            : Product::query()
                ->with('category:id,name')
                ->where(function ($builder) use ($productFilters) {
                    $builder
                        ->where('title', 'like', '%'.$productFilters['search'].'%')
                        ->orWhere('barcode', 'like', '%'.$productFilters['search'].'%')
                        ->orWhere('sku', 'like', '%'.$productFilters['search'].'%');
                })
                ->whereNotIn('id', $selectedProductIds)
                ->orderBy('title')
                ->limit(20)
                ->get()
                ->map(function (Product $product) use ($stockOpname) {
                    $product->setAttribute(
                        'stock',
                        $this->stockMutationService->stockForOutlet($product, (int) $stockOpname->outlet_id)
                    );

                    return $product;
                });

        return Inertia::render('Dashboard/StockOpnames/Show', [
            'stockOpname' => $stockOpname,
            'availableProducts' => $availableProducts,
            'productFilters' => $productFilters,
        ]);
    }

    public function update(UpdateStockOpnameRequest $request, StockOpname $stockOpname): RedirectResponse
    {
        $this->ensureAccessibleOutlet($request, $stockOpname->outlet_id);
        $this->ensureDraft($stockOpname);

        $stockOpname->update($request->validated());

        return back()->with('success', 'Catatan stock opname berhasil diperbarui.');
    }

    public function storeItem(StoreStockOpnameItemRequest $request, StockOpname $stockOpname): RedirectResponse
    {
        $this->ensureAccessibleOutlet($request, $stockOpname->outlet_id);
        $this->ensureDraft($stockOpname);

        $product = Product::findOrFail($request->validated('product_id'));

        if ($stockOpname->items()->where('product_id', $product->id)->exists()) {
            throw ValidationException::withMessages([
                'product_id' => 'Produk sudah ada di sesi stock opname ini.',
            ]);
        }

        $stockOpname->items()->create([
            'product_id' => $product->id,
            'system_stock' => $this->stockMutationService->stockForOutlet($product, (int) $stockOpname->outlet_id),
        ]);

        return back()->with('success', 'Produk berhasil ditambahkan ke stock opname.');
    }

    public function updateItem(
        UpdateStockOpnameItemRequest $request,
        StockOpname $stockOpname,
        StockOpnameItem $item
    ): RedirectResponse {
        $this->ensureAccessibleOutlet($request, $stockOpname->outlet_id);
        $this->ensureDraft($stockOpname);
        $this->ensureItemBelongsToOpname($stockOpname, $item);

        $validated = $request->validated();
        $physicalStock = $validated['physical_stock'] ?? null;
        $difference = $physicalStock !== null
            ? $physicalStock - $item->system_stock
            : null;

        $adjustmentReason = $validated['adjustment_reason'] ?? null;

        if ($difference !== null && $difference !== 0 && blank($adjustmentReason)) {
            throw ValidationException::withMessages([
                'adjustment_reason' => 'Alasan adjustment wajib diisi jika ada selisih stok.',
            ]);
        }

        if ($difference === 0) {
            $adjustmentReason = null;
        }

        $item->update([
            'physical_stock' => $physicalStock,
            'difference' => $difference,
            'adjustment_reason' => $adjustmentReason,
        ]);

        return back()->with('success', 'Item stock opname berhasil diperbarui.');
    }

    public function finalize(Request $request, StockOpname $stockOpname): RedirectResponse
    {
        $this->ensureAccessibleOutlet($request, $stockOpname->outlet_id);
        $this->ensureDraft($stockOpname);

        $stockOpname->load('items.product');
        $beforeStatus = $stockOpname->status;

        foreach ($stockOpname->items as $item) {
            if ($item->difference !== null && $item->difference !== 0 && blank($item->adjustment_reason)) {
                throw ValidationException::withMessages([
                    'finalize' => 'Masih ada item selisih yang belum memiliki alasan adjustment.',
                ]);
            }
        }

        DB::transaction(function () use ($request, $stockOpname) {
            foreach ($stockOpname->items as $item) {
                if ($item->physical_stock === null) {
                    continue;
                }

                $product = $item->product()->lockForUpdate()->first();

                if (! $product) {
                    continue;
                }

                $stockAfter = (int) $item->physical_stock;

                $this->stockMutationService->recordStockOpnameAdjustment(
                    product: $product,
                    stockOpname: $stockOpname,
                    stockBefore: (int) $item->system_stock,
                    stockAfter: $stockAfter,
                    reason: $item->adjustment_reason,
                    userId: $request->user()?->id,
                );
            }

            $stockOpname->update([
                'status' => 'finalized',
                'finalized_by' => $request->user()?->id,
                'finalized_at' => now(),
            ]);
        });

        $stockOpname->refresh();
        $stockOpname->load('items.product');

        $this->auditLogService->log(
            event: 'stock.opname.finalized',
            module: 'stock',
            auditable: $stockOpname,
            description: 'Stock opname difinalisasi.',
            before: ['status' => $beforeStatus],
            after: ['status' => $stockOpname->status],
            meta: [
                'code' => $stockOpname->code,
                'notes' => $stockOpname->notes,
                'items' => $stockOpname->items->map(fn (StockOpnameItem $item) => [
                    'product_id' => $item->product_id,
                    'product_title' => $item->product?->title,
                    'stock_before' => (int) $item->system_stock,
                    'stock_after' => $item->physical_stock !== null ? (int) $item->physical_stock : null,
                    'difference' => $item->difference !== null ? (int) $item->difference : null,
                    'reason' => $item->adjustment_reason,
                    'reference' => $stockOpname->code,
                ])->values()->all(),
            ],
        );

        return back()->with('success', 'Stock opname berhasil difinalisasi.');
    }

    private function ensureDraft(StockOpname $stockOpname): void
    {
        if (! $stockOpname->isDraft()) {
            throw ValidationException::withMessages([
                'stock_opname' => 'Sesi stock opname yang sudah final tidak dapat diubah.',
            ]);
        }
    }

    private function ensureItemBelongsToOpname(StockOpname $stockOpname, StockOpnameItem $item): void
    {
        if ($item->stock_opname_id !== $stockOpname->id) {
            abort(404);
        }
    }

    private function generateCode(): string
    {
        do {
            $code = 'SO-'.now()->format('YmdHis').'-'.Str::upper(Str::random(4));
        } while (StockOpname::where('code', $code)->exists());

        return $code;
    }

    private function ensureAccessibleOutlet(Request $request, ?int $outletId): void
    {
        $activeOutletId = $this->outletResolver->resolve($request, $request->user())?->id;

        if ($activeOutletId && $outletId && (int) $activeOutletId !== (int) $outletId) {
            abort(404);
        }
    }
}
