<?php

namespace App\Services;

use App\Models\TransactionDetail;
use Carbon\Carbon;
use App\Support\ReportTimezone;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SalesAnalyticsService
{
    public function __construct(
        private readonly TransactionReturnImpactService $transactionReturnImpactService
    ) {}

    /**
     * Build hourly sales breakdown
     */
    public function buildHourlyBreakdown($query): array
    {
        $rows = $this->transactionReturnImpactService->enrichTransactions(
            (clone $query)->get(['id', 'created_at', 'grand_total', 'discount', 'customer_id'])
        );

        return $rows
            ->groupBy(fn ($row) => ReportTimezone::sourceToDisplayCarbon(
                method_exists($row, 'getRawOriginal') ? $row->getRawOriginal('created_at') : $row->created_at
            )?->format('H'))
            ->sortKeys()
            ->map(function ($rows, $hour) {
                $activeRows = $rows->filter(fn ($row) => ! (bool) data_get($row, 'is_fully_returned', false));
                $hourInt = (int) $hour;

                return [
                    'hour' => $hourInt,
                    'label' => str_pad((string) $hour, 2, '0', STR_PAD_LEFT).':00',
                    'orders_count' => $activeRows->count(),
                    'revenue_total' => (int) $rows->sum(fn ($row) => (int) data_get($row, 'net_grand_total', $row->grand_total ?? 0)),
                    'discount_total' => (int) $rows->sum('discount'),
                ];
            })
            ->values()
            ->toArray();
    }

    /**
     * Build daily sales breakdown (last 30 days)
     */
    public function buildDailyBreakdown($query): array
    {
        $rows = $this->transactionReturnImpactService->enrichTransactions(
            (clone $query)->get(['id', 'created_at', 'grand_total', 'discount', 'customer_id'])
        );

        return $rows
            ->groupBy(fn ($row) => ReportTimezone::sourceDateKey(
                method_exists($row, 'getRawOriginal') ? $row->getRawOriginal('created_at') : $row->created_at
            ))
            ->sortKeysDesc()
            ->take(30)
            ->map(function ($rows, $date) {
                $activeRows = $rows->filter(fn ($row) => ! (bool) data_get($row, 'is_fully_returned', false));
                return [
                    'date' => $date,
                    'label' => Carbon::createFromFormat('Y-m-d', $date, ReportTimezone::timezone())->translatedFormat('d M'),
                    'orders_count' => $activeRows->count(),
                    'revenue_total' => (int) $rows->sum(fn ($row) => (int) data_get($row, 'net_grand_total', $row->grand_total ?? 0)),
                    'discount_total' => (int) $rows->sum('discount'),
                ];
            })
            ->reverse()
            ->values()
            ->toArray();
    }

    /**
     * Build top selling products with detailed stats
     */
    public function buildTopProducts($transactionIds, int $limit = 10, ?int $tenantOutletId = null): array
    {
        return $this->buildProductPerformance($transactionIds, $limit, $tenantOutletId);
    }

    /**
     * Build complete product performance breakdown.
     */
    public function buildProductPerformance($transactionIds, ?int $limit = null, ?int $tenantOutletId = null): array
    {
        if ($transactionIds instanceof Collection && $transactionIds->isEmpty()) {
            return [];
        }

        $query = TransactionDetail::query()
            ->select('product_id')
            ->selectRaw('SUM(qty) as total_qty')
            ->selectRaw('SUM(price) as total_revenue')
            ->selectRaw('COUNT(DISTINCT transaction_id) as transaction_count')
            ->selectRaw('AVG(price) as avg_price')
            ->selectRaw('MIN(price) as min_price')
            ->selectRaw('MAX(price) as max_price')
            ->whereIn('transaction_id', $transactionIds)
            ->whereNotNull('product_id');

        // Filter by tenant_outlet_id if specified (for tenant workspace)
        if ($tenantOutletId !== null) {
            $query->where('tenant_outlet_id', $tenantOutletId);
        }

        $query->groupBy('product_id')
            ->orderByDesc('total_revenue')
            ->with('product:id,title,category_id,stock,sku,barcode')
            ->with('product.category:id,name');

        if ($limit !== null) {
            $query->limit($limit);
        }

        $results = $query->get();
        $grandRevenueTotal = (int) $results->sum('total_revenue');
        $grandQtyTotal = (int) $results->sum('total_qty');

        return $results->map(function ($row) use ($grandRevenueTotal, $grandQtyTotal) {
            $totalQty = (int) $row->total_qty;
            $totalRevenue = (int) $row->total_revenue;
            $transactionCount = (int) $row->transaction_count;

            return [
                'product_id' => $row->product_id,
                'product_name' => $row->product?->title ?? 'Produk',
                'product_sku' => $row->product?->sku ?? '-',
                'category_name' => $row->product?->category?->name ?? 'Tanpa Kategori',
                'category_id' => $row->product?->category_id,
                'total_qty' => $totalQty,
                'total_revenue' => $totalRevenue,
                'transaction_count' => $transactionCount,
                'average_price' => $totalQty > 0 ? (int) round($totalRevenue / $totalQty) : 0,
                'average_qty_per_transaction' => $transactionCount > 0 ? round($totalQty / $transactionCount, 2) : 0,
                'average_revenue_per_transaction' => $transactionCount > 0 ? (int) round($totalRevenue / $transactionCount) : 0,
                'min_price' => (int) $row->min_price,
                'max_price' => (int) $row->max_price,
                'avg_price' => (int) round($row->avg_price),
                'current_stock' => (int) ($row->product?->stock ?? 0),
                'revenue_share_percent' => $grandRevenueTotal > 0
                    ? round(($totalRevenue / $grandRevenueTotal) * 100, 2)
                    : 0,
                'qty_share_percent' => $grandQtyTotal > 0
                    ? round(($totalQty / $grandQtyTotal) * 100, 2)
                    : 0,
            ];
        })->toArray();
    }

    /**
     * Build slow moving products (products with lowest sales)
     */
    public function buildSlowMovingProducts($transactionIds, int $limit = 10, ?int $tenantOutletId = null): array
    {
        if ($transactionIds instanceof Collection && $transactionIds->isEmpty()) {
            return [];
        }

        $query = TransactionDetail::query()
            ->select('product_id')
            ->selectRaw('SUM(qty) as total_qty')
            ->selectRaw('SUM(price) as total_revenue')
            ->selectRaw('COUNT(DISTINCT transaction_id) as transaction_count')
            ->whereIn('transaction_id', $transactionIds)
            ->whereNotNull('product_id');

        if ($tenantOutletId !== null) {
            $query->where('tenant_outlet_id', $tenantOutletId);
        }

        $results = $query->groupBy('product_id')
            ->orderBy('total_qty')
            ->limit($limit)
            ->with('product:id,title,category_id,stock')
            ->with('product.category:id,name')
            ->get();

        return $results->map(fn ($row) => [
            'product_id' => $row->product_id,
            'product_name' => $row->product?->title ?? 'Produk',
            'category_name' => $row->product?->category?->name ?? 'Tanpa Kategori',
            'total_qty' => (int) $row->total_qty,
            'total_revenue' => (int) $row->total_revenue,
            'transaction_count' => (int) $row->transaction_count,
            'current_stock' => (int) ($row->product?->stock ?? 0),
            'average_price' => $row->total_qty > 0 ? (int) round($row->total_revenue / $row->total_qty) : 0,
        ])->toArray();
    }

    /**
     * Build sales breakdown by category
     */
    public function buildCategoryBreakdown($transactionIds, ?int $tenantOutletId = null): array
    {
        if ($transactionIds instanceof Collection && $transactionIds->isEmpty()) {
            return [];
        }

        $query = DB::table('transaction_details')
            ->join('products', 'transaction_details.product_id', '=', 'products.id')
            ->leftJoin('categories', 'products.category_id', '=', 'categories.id')
            ->select('categories.id as category_id', 'categories.name as category_name')
            ->selectRaw('SUM(transaction_details.qty) as total_qty')
            ->selectRaw('SUM(transaction_details.price) as total_revenue')
            ->selectRaw('COUNT(DISTINCT transaction_details.transaction_id) as transaction_count')
            ->whereIn('transaction_details.transaction_id', $transactionIds);

        if ($tenantOutletId !== null) {
            $query->where('transaction_details.tenant_outlet_id', $tenantOutletId);
        }

        $results = $query->groupBy('categories.id', 'categories.name')
            ->orderByDesc('total_revenue')
            ->get();

        return $results->map(fn ($row) => [
            'category_id' => $row->category_id,
            'category_name' => $row->category_name ?? 'Tanpa Kategori',
            'total_qty' => (int) $row->total_qty,
            'total_revenue' => (int) $row->total_revenue,
            'transaction_count' => (int) $row->transaction_count,
        ])->toArray();
    }

    /**
     * Build payment method breakdown
     */
    public function buildPaymentMethodBreakdown($query): array
    {
        $grossByMethod = (clone $query)
            ->selectRaw("COALESCE(payment_method, 'unknown') as method")
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(grand_total), 0) as gross_total')
            ->groupBy('method')
            ->get();

        // Retur completed per nota (grouped, hanya nota yang punya retur) agar
        // revenue bersih = gross - retur (dibatasi grand_total) tanpa hydrate semua nota.
        $returnGroups = DB::table('sales_returns')
            ->join('transactions', 'transactions.id', '=', 'sales_returns.transaction_id')
            ->whereIn('sales_returns.transaction_id', (clone $query)->select('transactions.id'))
            ->where('sales_returns.status', 'completed')
            ->groupBy('sales_returns.transaction_id', 'transactions.grand_total', 'transactions.payment_method')
            ->selectRaw('sales_returns.transaction_id as transaction_id, COUNT(*) as returns_count')
            ->selectRaw('COALESCE(SUM(sales_returns.total_return_amount), 0) as returned_total')
            ->selectRaw('transactions.grand_total as grand_total, transactions.payment_method as payment_method')
            ->get();

        $adjustByMethod = [];
        foreach ($returnGroups as $group) {
            $method = $group->payment_method ?? 'unknown';
            $grand = (int) ($group->grand_total ?? 0);
            $capped = min($grand, max(0, (int) ($group->returned_total ?? 0)));

            $adjustByMethod[$method] ??= ['returned_total' => 0, 'fully_returned_count' => 0];
            $adjustByMethod[$method]['returned_total'] += $capped;

            if ($grand > 0 && $grand - $capped === 0 && (int) ($group->returns_count ?? 0) > 0) {
                $adjustByMethod[$method]['fully_returned_count']++;
            }
        }

        return $grossByMethod
            ->map(function ($row) use ($adjustByMethod) {
                $method = $row->method ?? 'unknown';
                $adjust = $adjustByMethod[$method] ?? ['returned_total' => 0, 'fully_returned_count' => 0];

                return [
                    'payment_method' => $method,
                    'payment_method_label' => $this->formatPaymentMethod($method),
                    'orders_count' => max(0, (int) ($row->orders_count ?? 0) - (int) $adjust['fully_returned_count']),
                    'revenue_total' => max(0, (int) ($row->gross_total ?? 0) - (int) $adjust['returned_total']),
                ];
            })
            ->sortByDesc('revenue_total')
            ->values()
            ->toArray();
    }

    /**
     * Format payment method label
     */
    protected function formatPaymentMethod(?string $method): string
    {
        return match($method) {
            'cash' => 'Cash',
            'bank_transfer' => 'Transfer Bank',
            'qris' => 'QRIS',
            'midtrans' => 'Midtrans',
            'xendit' => 'Xendit',
            'pay_later' => 'Bayar Nanti',
            default => ucfirst($method ?? 'Tidak Diketahui'),
        };
    }
}
