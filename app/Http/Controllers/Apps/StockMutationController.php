<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMutation;
use App\Services\OutletResolver;
use App\Services\StockMutationService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StockMutationController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver,
        private readonly StockMutationService $stockMutationService
    ) {}

    public function index(Request $request): Response
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $filters = [
            'product_id' => $request->input('product_id'),
            'mutation_type' => $request->input('mutation_type'),
            'date_from' => $request->input('date_from'),
            'date_to' => $request->input('date_to'),
        ];

        $stockMutations = StockMutation::query()
            ->with(['product:id,title,barcode,sku', 'creator:id,name'])
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->when($filters['product_id'], fn ($query, $productId) => $query->where('product_id', $productId))
            ->when($filters['mutation_type'], fn ($query, $mutationType) => $query->where('mutation_type', $mutationType))
            ->when($filters['date_from'], fn ($query, $date) => $query->whereDate('created_at', '>=', $date))
            ->when($filters['date_to'], fn ($query, $date) => $query->whereDate('created_at', '<=', $date))
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Dashboard/StockMutations/Index', [
            'stockMutations' => $stockMutations,
            'products' => Product::query()->orderBy('title')->get(['id', 'title', 'barcode', 'sku', 'stock'])
                ->map(function (Product $product) use ($outlet) {
                    if ($outlet) {
                        $product->setAttribute('stock', $this->stockMutationService->stockForOutlet($product, $outlet->id));
                    }

                    return $product;
                }),
            'filters' => $filters,
        ]);
    }
}
