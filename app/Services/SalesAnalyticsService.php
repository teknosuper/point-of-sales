<?php

namespace App\Services;

use App\Models\TransactionDetail;
use Carbon\Carbon;
use App\Support\ReportTimezone;
use Illuminate\Support\Facades\DB;

class SalesAnalyticsService
{
    /**
     * Build hourly sales breakdown
     */
    public function buildHourlyBreakdown($query): array
    {
        return (clone $query)
            ->get(['created_at', 'grand_total', 'discount'])
            ->groupBy(fn ($row) => ReportTimezone::localHourKey($row->created_at))
            ->sortKeys()
            ->map(function ($rows, $hour) {
                $hourInt = (int) $hour;

                return [
                    'hour' => $hourInt,
                    'label' => str_pad((string) $hour, 2, '0', STR_PAD_LEFT).':00',
                    'orders_count' => $rows->count(),
                    'revenue_total' => (int) $rows->sum('grand_total'),
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
        return (clone $query)
            ->get(['created_at', 'grand_total', 'discount'])
            ->groupBy(fn ($row) => ReportTimezone::localDateKey($row->created_at))
            ->sortKeysDesc()
            ->take(30)
            ->map(function ($rows, $date) {
                return [
                    'date' => $date,
                    'label' => Carbon::createFromFormat('Y-m-d', $date, ReportTimezone::timezone())->translatedFormat('d M'),
                    'orders_count' => $rows->count(),
                    'revenue_total' => (int) $rows->sum('grand_total'),
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
    public function buildTopProducts($transactionIds, int $limit = 10): array
    {
        if ($transactionIds->isEmpty()) {
            return [];
        }

        $results = TransactionDetail::query()
            ->select('product_id')
            ->selectRaw('SUM(qty) as total_qty')
            ->selectRaw('SUM(price) as total_revenue')
            ->selectRaw('COUNT(DISTINCT transaction_id) as transaction_count')
            ->selectRaw('AVG(price) as avg_price')
            ->selectRaw('MIN(price) as min_price')
            ->selectRaw('MAX(price) as max_price')
            ->whereIn('transaction_id', $transactionIds)
            ->whereNotNull('product_id')
            ->groupBy('product_id')
            ->orderByDesc('total_revenue')
            ->limit($limit)
            ->with('product:id,title,category_id,stock,sku,barcode')
            ->with('product.category:id,name')
            ->get();

        return $results->map(fn ($row) => [
            'product_id' => $row->product_id,
            'product_name' => $row->product?->title ?? 'Produk',
            'product_sku' => $row->product?->sku ?? '-',
            'category_name' => $row->product?->category?->name ?? 'Tanpa Kategori',
            'category_id' => $row->product?->category_id,
            'total_qty' => (int) $row->total_qty,
            'total_revenue' => (int) $row->total_revenue,
            'transaction_count' => (int) $row->transaction_count,
            'average_price' => $row->total_qty > 0 ? (int) round($row->total_revenue / $row->total_qty) : 0,
            'min_price' => (int) $row->min_price,
            'max_price' => (int) $row->max_price,
            'avg_price' => (int) round($row->avg_price),
            'current_stock' => (int) ($row->product?->stock ?? 0),
        ])->toArray();
    }

    /**
     * Build slow moving products (products with lowest sales)
     */
    public function buildSlowMovingProducts($transactionIds, int $limit = 10): array
    {
        if ($transactionIds->isEmpty()) {
            return [];
        }

        $results = TransactionDetail::query()
            ->select('product_id')
            ->selectRaw('SUM(qty) as total_qty')
            ->selectRaw('SUM(price) as total_revenue')
            ->selectRaw('COUNT(DISTINCT transaction_id) as transaction_count')
            ->whereIn('transaction_id', $transactionIds)
            ->whereNotNull('product_id')
            ->groupBy('product_id')
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
    public function buildCategoryBreakdown($transactionIds): array
    {
        if ($transactionIds->isEmpty()) {
            return [];
        }

        $results = DB::table('transaction_details')
            ->join('products', 'transaction_details.product_id', '=', 'products.id')
            ->leftJoin('categories', 'products.category_id', '=', 'categories.id')
            ->select('categories.id as category_id', 'categories.name as category_name')
            ->selectRaw('SUM(transaction_details.qty) as total_qty')
            ->selectRaw('SUM(transaction_details.price) as total_revenue')
            ->selectRaw('COUNT(DISTINCT transaction_details.transaction_id) as transaction_count')
            ->whereIn('transaction_details.transaction_id', $transactionIds)
            ->groupBy('categories.id', 'categories.name')
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
        $results = (clone $query)
            ->selectRaw('payment_method')
            ->selectRaw('COUNT(*) as orders_count')
            ->selectRaw('COALESCE(SUM(grand_total), 0) as revenue_total')
            ->groupBy('payment_method')
            ->orderByDesc('revenue_total')
            ->get();

        return $results->map(fn ($row) => [
            'payment_method' => $row->payment_method ?? 'unknown',
            'payment_method_label' => $this->formatPaymentMethod($row->payment_method),
            'orders_count' => (int) $row->orders_count,
            'revenue_total' => (int) $row->revenue_total,
        ])->toArray();
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
