<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Profit;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use App\Services\OutletResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProfitReportController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $outletId = $this->outletResolver->resolve($request, $request->user())?->id;
        $filters = [
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'invoice' => $request->input('invoice'),
            'cashier_id' => $request->input('cashier_id'),
            'customer_id' => $request->input('customer_id'),
            'outlet_id' => $outletId,
        ];

        $baseQuery = $this->applyFilters(
            Transaction::query()
                ->with(['cashier:id,name', 'customer:id,name'])
                ->withSum('profits as total_profit', 'total')
                ->withSum('details as total_items', 'qty'),
            $filters
        )->orderByDesc('created_at');

        $transactions = (clone $baseQuery)
            ->paginate(10)
            ->withQueryString();

        $transactionIds = (clone $baseQuery)->pluck('id');

        $profitTotal = $transactionIds->isNotEmpty()
            ? Profit::whereIn('transaction_id', $transactionIds)->sum('total')
            : 0;

        $revenueTotal = (clone $baseQuery)->sum('grand_total');

        $ordersCount = (clone $baseQuery)->count();

        $itemsSold = $transactionIds->isNotEmpty()
            ? TransactionDetail::whereIn('transaction_id', $transactionIds)->sum('qty')
            : 0;

        $bestTransaction = (clone $baseQuery)->get()->sortByDesc('total_profit')->first();

        $summary = [
            'profit_total' => (int) $profitTotal,
            'revenue_total' => (int) $revenueTotal,
            'orders_count' => (int) $ordersCount,
            'items_sold' => (int) $itemsSold,
            'walk_in_count' => (int) ((clone $baseQuery)->whereNull('customer_id')->count()),
            'average_profit' => $ordersCount > 0 ? (int) round($profitTotal / $ordersCount) : 0,
            'margin' => $revenueTotal > 0 ? round(($profitTotal / $revenueTotal) * 100, 2) : 0,
            'best_invoice' => $bestTransaction?->invoice,
            'best_profit' => (int) ($bestTransaction?->total_profit ?? 0),
        ];
        $summary['registered_customer_count'] = max(0, $summary['orders_count'] - $summary['walk_in_count']);

        return Inertia::render('Dashboard/Reports/Profit', [
            'transactions' => $transactions,
            'summary' => $summary,
            'cashierSummary' => $this->cashierSummary($filters),
            'filters' => $filters,
            'cashiers' => User::select('id', 'name')->orderBy('name')->get(),
            'customers' => Customer::select('id', 'name')->orderBy('name')->get(),
        ]);
    }

    protected function cashierSummary(array $filters): array
    {
        return $this->applyFilters(Transaction::query(), $filters)
            ->leftJoin('profits', 'profits.transaction_id', '=', 'transactions.id')
            ->leftJoin('users', 'users.id', '=', 'transactions.cashier_id')
            ->selectRaw('
                transactions.cashier_id,
                users.name as cashier_name,
                COUNT(DISTINCT transactions.id) as orders_count,
                COALESCE(SUM(transactions.grand_total), 0) as revenue_total,
                COALESCE(SUM(profits.total), 0) as profit_total,
                SUM(CASE WHEN transactions.customer_id IS NULL THEN 1 ELSE 0 END) as walk_in_count
            ')
            ->groupBy('transactions.cashier_id', 'users.name')
            ->orderByDesc(DB::raw('COALESCE(SUM(profits.total), 0)'))
            ->get()
            ->map(function ($row) {
                $ordersCount = (int) ($row->orders_count ?? 0);
                $walkInCount = (int) ($row->walk_in_count ?? 0);

                return [
                    'cashier_id' => (int) $row->cashier_id,
                    'cashier_name' => $row->cashier_name,
                    'orders_count' => $ordersCount,
                    'walk_in_count' => $walkInCount,
                    'registered_customer_count' => max(0, $ordersCount - $walkInCount),
                    'revenue_total' => (int) round($row->revenue_total ?? 0),
                    'profit_total' => (int) round($row->profit_total ?? 0),
                    'walk_in_share' => $ordersCount > 0
                        ? round(($walkInCount / $ordersCount) * 100, 2)
                        : 0,
                    'average_profit' => $ordersCount > 0
                        ? (int) round(($row->profit_total ?? 0) / $ordersCount)
                        : 0,
                ];
            })
            ->all();
    }

    protected function applyFilters($query, array $filters)
    {
        return $query
            ->when($filters['outlet_id'] ?? null, fn ($q, $outletId) => $q->where('outlet_id', $outletId))
            ->when($filters['invoice'] ?? null, fn ($q, $invoice) => $q->where('invoice', 'like', '%'.$invoice.'%'))
            ->when($filters['cashier_id'] ?? null, fn ($q, $cashier) => $q->where('cashier_id', $cashier))
            ->when($filters['customer_id'] ?? null, function ($q, $customer) {
                return match ((string) $customer) {
                    'walk_in' => $q->whereNull('customer_id'),
                    default => $q->where('customer_id', $customer),
                };
            })
            ->when($filters['start_date'] ?? null, fn ($q, $start) => $q->whereDate('created_at', '>=', $start))
            ->when($filters['end_date'] ?? null, fn ($q, $end) => $q->whereDate('created_at', '<=', $end));
    }
}
