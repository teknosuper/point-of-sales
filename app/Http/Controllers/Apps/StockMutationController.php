<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMutation;
use App\Services\OutletResolver;
use App\Services\StockMutationService;
use App\Support\ReportTimezone;
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
            ->when($filters['date_from'] || $filters['date_to'], fn ($query) => ReportTimezone::applySourceDateRange($query, 'created_at', $filters))
            ->latest()
            ->paginate(15)
            ->withQueryString();

        $productQuery = Product::query()
            ->when(
                $outlet?->outlet_type === 'tenant',
                fn ($query) => $query->where('tenant_outlet_id', $outlet->id)
            )
            ->orderBy('title');

        $products = $productQuery
            ->get(['id', 'title', 'barcode', 'sku', 'stock', 'tenant_outlet_id'])
            ->map(function (Product $product) use ($outlet) {
                if ($outlet) {
                    $product->setAttribute('stock', $this->stockMutationService->stockForOutlet($product, $outlet->id));
                }

                return $product;
            });

        $productIds = $products->pluck('id')->map(fn ($id) => (int) $id)->all();
        $summaryQuery = StockMutation::query()
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->when($productIds !== [], fn ($query) => $query->whereIn('product_id', $productIds))
            ->when($filters['product_id'], fn ($query, $productId) => $query->where('product_id', $productId))
            ->when($filters['mutation_type'], fn ($query, $mutationType) => $query->where('mutation_type', $mutationType))
            ->when($filters['date_from'] || $filters['date_to'], fn ($query) => ReportTimezone::applySourceDateRange($query, 'created_at', $filters));

        $summaryRows = (clone $summaryQuery)
            ->selectRaw('mutation_type, COALESCE(SUM(qty), 0) as total_qty, COUNT(*) as total_rows')
            ->groupBy('mutation_type')
            ->get()
            ->keyBy('mutation_type');

        $currentStockTotal = (int) $products->sum(fn ($product) => (int) ($product->stock ?? 0));

        return Inertia::render('Dashboard/StockMutations/Index', [
            'stockMutations' => $stockMutations,
            'products' => $products,
            'filters' => $filters,
            'summary' => [
                'current_stock_total' => $currentStockTotal,
                'products_count' => (int) $products->count(),
                'inbound_qty' => (int) ($summaryRows->get('in')->total_qty ?? 0),
                'inbound_rows' => (int) ($summaryRows->get('in')->total_rows ?? 0),
                'outbound_qty' => (int) ($summaryRows->get('out')->total_qty ?? 0),
                'outbound_rows' => (int) ($summaryRows->get('out')->total_rows ?? 0),
                'adjustment_qty' => (int) ($summaryRows->get('adjustment')->total_qty ?? 0),
                'adjustment_rows' => (int) ($summaryRows->get('adjustment')->total_rows ?? 0),
            ],
            'workspace' => [
                'active_outlet' => $outlet
                    ? [
                        'id' => $outlet->id,
                        'name' => $outlet->name,
                        'code' => $outlet->code,
                        'outlet_type' => $outlet->outlet_type,
                    ]
                    : null,
            ],
        ]);
    }
}
