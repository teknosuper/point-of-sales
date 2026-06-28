<?php

namespace App\Http\Controllers;

use App\Models\NotificationRead;
use App\Models\Payable;
use App\Models\Product;
use App\Models\ProductNotificationRead;
use App\Models\Receivable;
use App\Models\TableOrder;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class NotificationController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function snapshot(Request $request)
    {
        $user = $request->user();
        $userId = $user->id;
        $activeOutlet = $this->outletResolver->resolve($request);
        $isKitchenWorkspace = $user->isKitchenWorkspace();
        $isTenantScopedAccount = $user->outlets()
            ->active()
            ->exists()
            && $user->outlets()
                ->active()
                ->where('outlet_type', '!=', 'tenant')
                ->doesntExist();

        $canSeeStockNotifications = ! $isKitchenWorkspace
            && ! $isTenantScopedAccount
            && (
                $user->can('products-stock-update')
                || $user->can('stock-opnames-access')
                || $user->can('stock-mutations-access')
            );
        $canSeeFinanceNotifications = ! $isKitchenWorkspace
            && ! $isTenantScopedAccount
            && (
                $user->can('receivables-access')
                || $user->can('payables-access')
            );
        $canSeeQrNotifications = ! $isKitchenWorkspace
            && ! $isTenantScopedAccount
            && (
                $user->can('transactions-access')
                || $user->can('table-orders-access')
                || $user->can('table-orders-approve')
            );

        $lowStockNotifications = collect();

        if ($canSeeStockNotifications) {
            $lowStockNotifications = $this->globalLowStockProductsQuery()
                ->whereNotExists(function ($query) use ($userId) {
                    $query->selectRaw('1')
                        ->from('product_notification_reads as pr')
                        ->whereColumn('pr.product_id', 'products.id')
                        ->where('pr.user_id', $userId)
                        ->whereColumn('pr.updated_at', '>=', 'products.updated_at');
                })
                ->orderByDesc('products.updated_at')
                ->limit(10)
                ->get()
                ->map(function ($product) {
                    return [
                        'id' => $product->id,
                        'title' => $product->title,
                        'stock' => (int) ($product->resolved_stock ?? 0),
                        'time' => optional($product->updated_at)->diffForHumans(),
                    ];
                })
                ->values();
        }

        $receivableQuery = Receivable::query()
            ->whereNot('status', 'paid')
            ->whereNotNull('due_date');

        $payableQuery = Payable::query()
            ->whereNot('status', 'paid')
            ->whereNotNull('due_date');

        if ($activeOutlet && Schema::hasColumn('receivables', 'outlet_id')) {
            $receivableQuery->where('outlet_id', $activeOutlet->id);
        }

        if ($activeOutlet && Schema::hasColumn('payables', 'outlet_id')) {
            $payableQuery->where('outlet_id', $activeOutlet->id);
        }

        $receivableNotifications = $canSeeFinanceNotifications && $user->can('receivables-access')
            ? $receivableQuery
                ->when(Schema::hasTable('notification_reads'), function ($query) use ($userId) {
                    $query->whereNotExists(function ($subQuery) use ($userId) {
                        $subQuery->selectRaw('1')
                            ->from('notification_reads as nr')
                            ->where('nr.user_id', $userId)
                            ->where('nr.type', 'receivable')
                            ->whereColumn('nr.reference_id', 'receivables.id');
                    });
                })
                ->whereDate('due_date', '<=', now()->addDays(3))
                ->orderBy('due_date')
                ->limit(5)
                ->get(['id', 'invoice', 'due_date', 'total', 'paid', 'status'])
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'title' => "Piutang: {$item->invoice}",
                        'subtitle' => 'Sisa '.number_format(max(0, ($item->total ?? 0) - ($item->paid ?? 0)), 0, ',', '.'),
                        'time' => optional($item->due_date)->diffForHumans(),
                        'status' => $item->status,
                        'aging_bucket' => $item->aging_bucket,
                    ];
                })
                ->values()
            : collect();

        $payableNotifications = $canSeeFinanceNotifications && $user->can('payables-access')
            ? $payableQuery
                ->when(Schema::hasTable('notification_reads'), function ($query) use ($userId) {
                    $query->whereNotExists(function ($subQuery) use ($userId) {
                        $subQuery->selectRaw('1')
                            ->from('notification_reads as nr')
                            ->where('nr.user_id', $userId)
                            ->where('nr.type', 'payable')
                            ->whereColumn('nr.reference_id', 'payables.id');
                    });
                })
                ->whereDate('due_date', '<=', now()->addDays(3))
                ->orderBy('due_date')
                ->limit(5)
                ->get(['id', 'document_number', 'due_date', 'total', 'paid', 'status'])
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'title' => "Hutang: {$item->document_number}",
                        'subtitle' => 'Sisa '.number_format(max(0, ($item->total ?? 0) - ($item->paid ?? 0)), 0, ',', '.'),
                        'time' => optional($item->due_date)->diffForHumans(),
                        'status' => $item->status,
                        'aging_bucket' => $item->aging_bucket,
                    ];
                })
                ->values()
            : collect();

        $pendingTableOrders = $canSeeQrNotifications
            ? TableOrder::query()
                ->with(['diningTable:id,name,code'])
                ->when($activeOutlet, fn ($query) => $query->where('outlet_id', $activeOutlet->id))
                ->where('status', 'pending_cashier_payment')
                ->latest('created_at')
                ->limit(60)
                ->get()
                ->map(fn (TableOrder $order) => [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'customer_name' => $order->customer_name,
                    'customer_phone' => $order->customer_phone,
                    'notes' => $order->notes,
                    'grand_total' => (int) $order->grand_total,
                    'created_at' => optional($order->created_at)->toISOString(),
                    'created_at_label' => optional($order->created_at)->format('d M Y H:i'),
                    'table' => [
                        'name' => $order->diningTable?->name,
                        'code' => $order->diningTable?->code,
                    ],
                ])
                ->values()
            : collect();

        return response()->json([
            'lowStockNotifications' => $lowStockNotifications,
            'receivableNotifications' => $receivableNotifications,
            'payableNotifications' => $payableNotifications,
            'pendingTableOrders' => $pendingTableOrders,
            'polled_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Mark a single low-stock notification as read for the current user.
     */
    public function markLowStockRead(Request $request)
    {
        $request->validate([
            'product_id' => ['required', 'exists:products,id'],
        ]);

        ProductNotificationRead::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'product_id' => $request->product_id,
            ],
            []
        );

        return back()->with('status', 'notification-read');
    }

    /**
     * Mark all low-stock notifications as read for the current user.
     */
    public function markAllLowStockRead(Request $request)
    {
        $productIds = $this->globalLowStockProductsQuery()
            ->pluck('products.id')
            ->all();

        if (count($productIds) === 0) {
            return back();
        }

        $payload = collect($productIds)->map(function ($productId) use ($request) {
            return [
                'user_id' => $request->user()->id,
                'product_id' => $productId,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        });

        ProductNotificationRead::upsert(
            $payload->toArray(),
            ['user_id', 'product_id'],
            ['updated_at']
        );

        return back()->with('status', 'notification-read-all');
    }

    private function globalLowStockProductsQuery()
    {
        return Product::query()
            ->select('products.*')
            ->selectRaw('products.stock as resolved_stock')
            ->where('products.stock', '<=', 0);
    }

    public function markRead(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:receivable,payable'],
            'reference_id' => ['required', 'integer', 'min:1'],
        ]);

        NotificationRead::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'type' => $validated['type'],
                'reference_id' => $validated['reference_id'],
            ],
            []
        );

        return back()->with('status', 'notification-read');
    }

    public function markAllRead(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.type' => ['required', 'in:receivable,payable'],
            'items.*.reference_id' => ['required', 'integer', 'min:1'],
        ]);

        $payload = collect($validated['items'])
            ->unique(fn ($item) => $item['type'].'-'.$item['reference_id'])
            ->map(fn ($item) => [
                'user_id' => $request->user()->id,
                'type' => $item['type'],
                'reference_id' => $item['reference_id'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

        NotificationRead::upsert(
            $payload->toArray(),
            ['user_id', 'type', 'reference_id'],
            ['updated_at']
        );

        return back()->with('status', 'notification-read-all');
    }
}
