<?php

namespace App\Http\Middleware;

use App\Models\CashierShift;
use App\Models\NotificationRead;
use App\Models\Outlet;
use App\Models\Payable;
use App\Models\Product;
use App\Models\ProductOutletStock;
use App\Models\Receivable;
use App\Services\CashierShiftService;
use App\Services\OutletResolver;
use App\Services\PayableAgingService;
use App\Services\ReceivableService;
use App\Support\ProductionSecurityBaseline;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $lowStockNotifications = [];
        $receivableNotifications = [];
        $payableNotifications = [];
        $notificationAccess = [
            'stock' => false,
            'finance' => false,
            'qrOrders' => false,
        ];
        $activeCashierShift = null;
        $availableOutlets = collect();
        $securityWarnings = [];
        $stepUpFreshUntil = null;
        $payableAgingSummary = null;
        $receivableAgingSummary = null;
        $activeOutlet = app(OutletResolver::class)->resolve($request);
        $isTenantScopedAccount = false;
        $manifestPath = public_path('build/manifest.json');
        $buildVersion = null;
        $buildGeneratedAt = null;

        if (File::exists($manifestPath)) {
            $buildVersion = substr(sha1_file($manifestPath) ?: '', 0, 10) ?: null;
            $buildGeneratedAt = date(DATE_ATOM, File::lastModified($manifestPath));
        }

        if ($request->user()) {
            $user = $request->user();
            $userId = $user->id;
            $isKitchenWorkspace = $user->isKitchenWorkspace();

            if (Schema::hasTable('outlets')) {
                $directOutletMeta = $user->outlets()
                    ->get(['outlets.id', 'outlets.outlet_type', 'outlet_user.is_primary'])
                    ->keyBy('id');

                $availableOutletsQuery = $user
                    ->accessibleOutletsQuery()
                    ->active()
                    ->ordered();

                if (app(OutletResolver::class)->shouldRestrictCashierToMainOutlet($user)) {
                    $availableOutletsQuery->where('outlets.outlet_type', 'main');
                }

                if ($user->isKitchenWorkspace() && $user->preferredKitchenStation?->outlet_id) {
                    $availableOutletsQuery->where(
                        'outlets.id',
                        (int) $user->preferredKitchenStation->outlet_id
                    );
                }

                $availableOutlets = $availableOutletsQuery
                    ->get()
                    ->map(fn (Outlet $outlet) => [
                        'id' => $outlet->id,
                        'code' => $outlet->code,
                        'slug' => $outlet->slug,
                        'name' => $outlet->name,
                        'city' => $outlet->city,
                        'parent_outlet_id' => $outlet->parent_outlet_id,
                        'outlet_type' => $outlet->outlet_type ?? 'main',
                        'is_primary' => (bool) ($directOutletMeta->get($outlet->id)?->pivot?->is_primary ?? false),
                    ])
                    ->values();
                $availableOutlets = $availableOutlets->all();
                $availableOutletCollection = collect($availableOutlets);
                $isTenantScopedAccount = $availableOutletCollection->isNotEmpty()
                    && $availableOutletCollection->every(
                        fn (array $outlet) => ($outlet['outlet_type'] ?? 'main') === 'tenant'
                    );
            }

            if (
                ! $isKitchenWorkspace
                && ! $isTenantScopedAccount
                && (
                    $user->can('products-stock-update')
                    || $user->can('stock-opnames-access')
                    || $user->can('stock-mutations-access')
                )
            ) {
                if ($activeOutlet && Schema::hasTable('product_outlet_stocks')) {
                    $lowStockNotifications = ProductOutletStock::query()
                        ->with('product:id,title')
                        ->where('outlet_id', $activeOutlet->id)
                        ->where('stock', '<=', 0)
                        ->orderByDesc('updated_at')
                        ->limit(10)
                        ->get()
                        ->map(function ($stock) {
                            return [
                                'id' => $stock->product_id,
                                'title' => $stock->product?->title ?? 'Produk',
                                'stock' => (int) $stock->stock,
                                'time' => optional($stock->updated_at)->diffForHumans(),
                            ];
                        });
                } else {
                    $lowStockNotifications = Product::where('stock', '<=', 0)
                        ->whereNotExists(function ($query) use ($userId) {
                            $query->selectRaw('1')
                                ->from('product_notification_reads as pr')
                                ->whereColumn('pr.product_id', 'products.id')
                                ->where('pr.user_id', $userId)
                                ->whereColumn('pr.updated_at', '>=', 'products.updated_at');
                        })
                        ->orderByDesc('updated_at')
                        ->limit(10)
                        ->get(['id', 'title', 'stock', 'updated_at'])
                        ->map(function ($product) {
                            return [
                                'id' => $product->id,
                                'title' => $product->title,
                                'stock' => (int) $product->stock,
                                'time' => optional($product->updated_at)->diffForHumans(),
                            ];
                        });
                }
            }

            $payableAgingService = new PayableAgingService;
            $receivableService = new ReceivableService;

            $payableAgingSummary = $payableAgingService->getAgingSummary($activeOutlet?->id);
            $receivableAgingSummary = $receivableService->getAgingSummary($activeOutlet?->id);

            $receivableQuery = Receivable::whereNot('status', 'paid')
                ->whereNotNull('due_date');

            $payableQuery = Payable::whereNot('status', 'paid')
                ->whereNotNull('due_date');

            if ($activeOutlet && Schema::hasColumn('receivables', 'outlet_id')) {
                $receivableQuery->where('outlet_id', $activeOutlet->id);
            }

            if ($activeOutlet && Schema::hasColumn('payables', 'outlet_id')) {
                $payableQuery->where('outlet_id', $activeOutlet->id);
            }

            if (
                ! $isKitchenWorkspace
                && ! $isTenantScopedAccount
                && ($user->can('receivables-access') || $user->can('payables-access'))
            ) {
                if ($user->can('receivables-access')) {
                    $receivableNotifications = $receivableQuery
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
                        ->get(['id', 'invoice', 'customer_id', 'due_date', 'total', 'paid', 'status'])
                        ->map(function ($item) {
                            return [
                                'id' => $item->id,
                                'title' => "Piutang: {$item->invoice}",
                                'subtitle' => 'Sisa '.number_format(max(0, ($item->total ?? 0) - ($item->paid ?? 0)), 0, ',', '.'),
                                'time' => optional($item->due_date)->diffForHumans(),
                                'status' => $item->status,
                                'aging_bucket' => $item->aging_bucket,
                            ];
                        });
                }

                if ($user->can('payables-access')) {
                    $payableNotifications = $payableQuery
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
                        });
                }
            }

            $activeShift = app(CashierShiftService::class)->getActiveShiftForUser(
                $userId,
                $activeOutlet && Schema::hasColumn('cashier_shifts', 'outlet_id') ? $activeOutlet->id : null
            );

            if ($activeShift) {
                $activeCashierShift = app(CashierShiftService::class)->summarizeForDisplay($activeShift);
            }

            $securityWarnings = ProductionSecurityBaseline::issues();

            $confirmedAt = (int) $request->session()->get('auth.password_confirmed_at', 0);
            if ($confirmedAt > 0) {
                $stepUpFreshUntil = now()
                    ->setTimestamp($confirmedAt + (int) config('auth.password_timeout', 900))
                    ->toISOString();
            }
        }

        $storeProfile = app(OutletResolver::class)->profilePayload($request);
        $availableOutletCollection = collect($availableOutlets);
        $accessibleOutletTypes = $availableOutletCollection
            ->pluck('outlet_type')
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($request->user()) {
            $user = $request->user();
            $isKitchenWorkspace = $user->isKitchenWorkspace();
            $operationalNotificationAudience = ! $isKitchenWorkspace && ! $isTenantScopedAccount;

            $notificationAccess = [
                'stock' => $operationalNotificationAudience && (
                    $user->can('products-stock-update')
                    || $user->can('stock-opnames-access')
                    || $user->can('stock-mutations-access')
                ),
                'finance' => $operationalNotificationAudience && (
                    $user->can('receivables-access')
                    || $user->can('payables-access')
                ),
                'qrOrders' => $operationalNotificationAudience && (
                    $user->can('transactions-access')
                    || $user->can('table-orders-access')
                    || $user->can('table-orders-approve')
                ),
            ];
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
                'permissions' => $request->user()
                    ? $request->user()
                        ->getAllPermissions()
                        ->pluck('name')
                        ->mapWithKeys(fn ($name) => [$name => true])
                        ->all()
                    : [],
                'roleNames' => $request->user() ? $request->user()->getRoleNames()->values()->all() : [],
                'accessProfile' => [
                    'tenantScoped' => $isTenantScopedAccount,
                    'accessibleOutletTypes' => $accessibleOutletTypes,
                    'primaryOutletType' => $availableOutletCollection
                        ->firstWhere('is_primary', true)['outlet_type']
                        ?? $availableOutletCollection->first()['outlet_type']
                        ?? null,
                ],
                'super' => $request->user() ? $request->user()->isSuperAdmin() : false,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
                'info' => fn () => $request->session()->get('info'),
                'status' => fn () => $request->session()->get('status'),
            ],
            'lowStockNotifications' => $lowStockNotifications,
            'receivableNotifications' => $receivableNotifications,
            'payableNotifications' => $payableNotifications,
            'payableAgingSummary' => $payableAgingSummary,
            'receivableAgingSummary' => $receivableAgingSummary,
            'activeCashierShift' => $activeCashierShift,
            'activeOutlet' => $activeOutlet ? [
                'id' => $activeOutlet->id,
                'outlet_type' => $activeOutlet->outlet_type ?? 'main',
                'code' => $activeOutlet->code,
                'slug' => $activeOutlet->slug,
                'name' => $activeOutlet->name,
                'city' => $activeOutlet->city,
            ] : null,
            'availableOutlets' => $availableOutlets,
            'storeProfile' => $storeProfile,
            'notificationAccess' => $notificationAccess,
            'security' => [
                'warnings' => $securityWarnings,
                'publicRegistrationEnabled' => config('security.auth.public_registration'),
                'stepUpFreshUntil' => $stepUpFreshUntil,
            ],
            'appMeta' => [
                'buildVersion' => $buildVersion,
                'buildGeneratedAt' => $buildGeneratedAt,
            ],
        ];
    }
}
