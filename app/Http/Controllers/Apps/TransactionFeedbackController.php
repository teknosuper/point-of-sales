<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\TransactionItemFeedback;
use App\Services\OutletResolver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TransactionFeedbackController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $outlet = $this->outletResolver->resolve($request, $user);
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');

        $isTenantWorkspace = (string) ($outlet->outlet_type ?? '') === 'tenant';
        $rootOutletId = $isTenantWorkspace ? ((int) $outlet->parent_outlet_id ?: (int) $outlet->id) : (int) $outlet->id;

        $filters = [
            'q' => trim((string) $request->input('q', '')),
            'rating' => (string) $request->input('rating', ''),
            'delivery_status' => (string) $request->input('delivery_status', ''),
            'tenant_outlet_id' => $isTenantWorkspace ? (string) $outlet->id : (string) $request->input('tenant_outlet_id', ''),
            'per_page' => (int) $request->input('per_page', 10),
        ];

        if (! in_array($filters['per_page'], [10, 25, 50], true)) {
            $filters['per_page'] = 10;
        }

        $query = TransactionItemFeedback::query()
            ->with([
                'transaction:id,invoice,customer_id,table_id,order_reference_name,created_at',
                'transaction.customer:id,name',
                'transaction.diningTable:id,code,name',
                'transactionDetail:id,transaction_id,tenant_outlet_id,product_id,qty,notes',
                'transactionDetail.product:id,title',
                'transactionDetail.tenantOutlet:id,name',
            ])
            ->where('outlet_id', $rootOutletId);

        $this->applyFilters($query, $filters, $isTenantWorkspace, (int) $outlet->id);

        $summaryQuery = clone $query;
        $summary = [
            'total_feedback' => (clone $summaryQuery)->count(),
            'average_rating' => round((float) ((clone $summaryQuery)->whereNotNull('rating')->avg('rating') ?? 0), 1),
            'not_received_count' => (clone $summaryQuery)->where('delivery_status', 'not_received')->count(),
            'with_message_count' => (clone $summaryQuery)
                ->where(function (Builder $builder) {
                    $builder
                        ->whereNotNull('feedback_text')
                        ->where('feedback_text', '!=', '');
                })
                ->count(),
        ];

        $feedbacks = $query
            ->latest('customer_alert_requested_at')
            ->latest('updated_at')
            ->latest('id')
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(function (TransactionItemFeedback $feedback) {
                $detail = $feedback->transactionDetail;
                $transaction = $feedback->transaction;
                $tableCode = $transaction?->diningTable?->code;
                $tableName = $transaction?->diningTable?->name;

                return [
                    'id' => (int) $feedback->id,
                    'invoice' => $transaction?->invoice,
                    'customer_name' => $transaction?->customer?->name ?: ($transaction?->order_reference_name ?: 'Pelanggan'),
                    'order_reference_name' => $transaction?->order_reference_name,
                    'table_label' => $tableCode ? trim($tableCode.' '.($tableName ?: '')) : null,
                    'tenant_name' => $detail?->tenantOutlet?->name ?: 'Outlet Utama',
                    'tenant_outlet_id' => (int) ($detail?->tenant_outlet_id ?? 0),
                    'product_name' => $detail?->product?->title ?? 'Produk',
                    'qty' => (int) ($detail?->qty ?? 0),
                    'item_notes' => $detail?->notes,
                    'rating' => $feedback->rating ? (int) $feedback->rating : null,
                    'feedback_text' => $feedback->feedback_text,
                    'delivery_status' => $feedback->delivery_status,
                    'customer_alert_message' => $feedback->customer_alert_message,
                    'customer_alert_count' => (int) ($feedback->customer_alert_count ?? 0),
                    'customer_alert_requested_at' => optional($feedback->customer_alert_requested_at)->toIso8601String(),
                    'created_at' => optional($feedback->created_at)->toIso8601String(),
                    'updated_at' => optional($feedback->updated_at)->toIso8601String(),
                    'transaction_created_at' => $transaction?->getRawOriginal('created_at')
                        ? \Carbon\Carbon::parse($transaction->getRawOriginal('created_at'))->toIso8601String()
                        : null,
                ];
            });

        $tenantOptions = $isTenantWorkspace
            ? collect()
            : Outlet::query()
                ->where('parent_outlet_id', $rootOutletId)
                ->where('outlet_type', 'tenant')
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Outlet $tenant) => [
                    'id' => (int) $tenant->id,
                    'name' => $tenant->name,
                ])
                ->values();

        return Inertia::render('Dashboard/TransactionFeedback/Index', [
            'filters' => $filters,
            'summary' => $summary,
            'feedbacks' => $feedbacks,
            'tenantOptions' => $tenantOptions,
            'workspace' => [
                'is_tenant' => $isTenantWorkspace,
                'active_outlet' => [
                    'id' => (int) $outlet->id,
                    'name' => $outlet->name,
                    'outlet_type' => $outlet->outlet_type ?? 'main',
                ],
                'is_super_admin' => (bool) $user?->isSuperAdmin(),
            ],
        ]);
    }

    private function applyFilters(Builder $query, array $filters, bool $isTenantWorkspace, int $activeOutletId): void
    {
        if ($isTenantWorkspace) {
            $query->whereHas('transactionDetail', fn (Builder $builder) => $builder->where('tenant_outlet_id', $activeOutletId));
        } elseif (($filters['tenant_outlet_id'] ?? '') !== '') {
            $tenantOutletId = (int) $filters['tenant_outlet_id'];
            $query->whereHas('transactionDetail', fn (Builder $builder) => $builder->where('tenant_outlet_id', $tenantOutletId));
        }

        if (($filters['rating'] ?? '') !== '') {
            $query->where('rating', (int) $filters['rating']);
        }

        if (($filters['delivery_status'] ?? '') !== '') {
            $query->where('delivery_status', $filters['delivery_status']);
        }

        if (($filters['q'] ?? '') !== '') {
            $search = $filters['q'];

            $query->where(function (Builder $builder) use ($search) {
                $builder
                    ->where('feedback_text', 'like', '%'.$search.'%')
                    ->orWhere('customer_alert_message', 'like', '%'.$search.'%')
                    ->orWhereHas('transaction', function (Builder $transactionQuery) use ($search) {
                        $transactionQuery
                            ->where('invoice', 'like', '%'.$search.'%')
                            ->orWhere('order_reference_name', 'like', '%'.$search.'%')
                            ->orWhereHas('customer', fn (Builder $customerQuery) => $customerQuery->where('name', 'like', '%'.$search.'%'));
                    })
                    ->orWhereHas('transactionDetail.product', fn (Builder $productQuery) => $productQuery->where('title', 'like', '%'.$search.'%'))
                    ->orWhereHas('transactionDetail.tenantOutlet', fn (Builder $tenantQuery) => $tenantQuery->where('name', 'like', '%'.$search.'%'));
            });
        }
    }
}
