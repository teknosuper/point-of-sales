<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Setting;
use App\Services\AuditLogService;
use App\Services\LoyaltyService;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class SettingController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly LoyaltyService $loyaltyService,
        private readonly OutletResolver $outletResolver
    ) {}

    /**
     * Show the target settings page
     */
    public function target()
    {
        $outlet = $this->resolvedOutlet(request());
        $outletId = $outlet?->id;
        $daysInMonth = now()->daysInMonth;
        $productTargets = $this->normalizeProductTargets(
            Setting::get('monthly_product_item_targets', '[]', $outletId)
        );

        $settings = [
            'monthly_sales_target' => Setting::get('monthly_sales_target', 0, $outletId),
            'monthly_profit_target' => Setting::get('monthly_profit_target', 0, $outletId),
            'daily_global_item_target' => Setting::get('daily_global_item_target', 0, $outletId),
        ];

        $products = Product::query()
            ->select('id', 'title', 'buy_price', 'sell_price', 'category_id', 'tenant_outlet_id', 'stock')
            ->with([
                'category:id,name',
                'tenantOutlet:id,name,code',
                'kitchenStationMappings' => fn ($query) => $query
                    ->where('is_active', true)
                    ->orderBy('priority')
                    ->with(['kitchenStation:id,name,code,outlet_id']),
            ])
            ->orderBy('title')
            ->when($outlet && Schema::hasTable('product_outlet_stocks'), function ($query) use ($outlet) {
                $query->with(['outletStocks' => fn ($stockQuery) => $stockQuery
                    ->select('id', 'product_id', 'outlet_id', 'stock')
                    ->where('outlet_id', $outlet->id)]);
            })
            ->get()
            ->map(function (Product $product) use ($productTargets, $outlet, $daysInMonth) {
                $monthlyTarget = (int) ($productTargets[$product->id] ?? 0);
                $stock = $outlet && Schema::hasTable('product_outlet_stocks')
                    ? (int) ($product->outletStocks->first()?->stock ?? 0)
                    : (int) ($product->stock ?? 0);
                $stationMapping = $product->kitchenStationMappings->first();

                return [
                    'id' => $product->id,
                    'title' => $product->title,
                    'buy_price' => (int) ($product->buy_price ?? 0),
                    'sell_price' => (int) ($product->sell_price ?? 0),
                    'category_id' => $product->category_id ? (int) $product->category_id : null,
                    'category_name' => $product->category?->name ?? 'Tanpa Kategori',
                    'tenant_outlet_id' => $product->tenant_outlet_id ? (int) $product->tenant_outlet_id : null,
                    'tenant_outlet' => $product->tenantOutlet ? [
                        'id' => $product->tenantOutlet->id,
                        'name' => $product->tenantOutlet->name,
                        'code' => $product->tenantOutlet->code,
                    ] : null,
                    'kitchen_station_id' => $stationMapping?->kitchenStation?->id
                        ? (int) $stationMapping->kitchenStation->id
                        : null,
                    'kitchen_station_name' => $stationMapping?->kitchenStation?->name ?? 'Belum Dipetakan',
                    'kitchen_station_code' => $stationMapping?->kitchenStation?->code,
                    'stock' => $stock,
                    'monthly_target' => $monthlyTarget,
                    'daily_target' => $monthlyTarget > 0 ? round($monthlyTarget / $daysInMonth, 2) : 0,
                ];
            })
            ->values();

        return Inertia::render('Dashboard/Settings/Target', [
            'settings' => $settings,
            'products' => $products,
            'targetMeta' => [
                'days_in_month' => $daysInMonth,
                'month_label' => now()->translatedFormat('F Y'),
            ],
        ]);
    }

    /**
     * Update target settings
     */
    public function updateTarget(Request $request)
    {
        $validated = $request->validate([
            'monthly_sales_target' => 'nullable|numeric|min:0',
            'monthly_profit_target' => 'nullable|numeric|min:0',
            'daily_global_item_target' => 'nullable|integer|min:0',
            'product_targets' => 'nullable|array',
            'product_targets.*.product_id' => 'required|integer|exists:products,id',
            'product_targets.*.monthly_target' => 'nullable|integer|min:0',
        ]);

        $outletId = $this->resolvedOutlet($request)?->id;
        $beforeSalesTarget = Setting::get('monthly_sales_target', 0, $outletId);
        $beforeProfitTarget = Setting::get('monthly_profit_target', 0, $outletId);
        $beforeDailyGlobalItemTarget = Setting::get('daily_global_item_target', 0, $outletId);
        $beforeTargets = $this->normalizeProductTargets(
            Setting::get('monthly_product_item_targets', '[]', $outletId)
        );
        $normalizedTargets = collect($validated['product_targets'] ?? [])
            ->map(fn (array $row) => [
                'product_id' => (int) $row['product_id'],
                'monthly_target' => (int) ($row['monthly_target'] ?? 0),
            ])
            ->filter(fn (array $row) => $row['monthly_target'] > 0)
            ->unique('product_id')
            ->values()
            ->all();

        Setting::setMany([
            'monthly_sales_target' => [
                'value' => $validated['monthly_sales_target'] ?? 0,
                'description' => 'Target penjualan bulanan',
            ],
            'monthly_profit_target' => [
                'value' => $validated['monthly_profit_target'] ?? 0,
                'description' => 'Target keuntungan bulanan',
            ],
            'daily_global_item_target' => [
                'value' => $validated['daily_global_item_target'] ?? 0,
                'description' => 'Target item harian global',
            ],
        ], $outletId);
        Setting::set(
            'monthly_product_item_targets',
            json_encode($normalizedTargets),
            'Target penjualan item bulanan per produk',
            $outletId
        );

        $this->auditLogService->log(
            event: 'settings.target.updated',
            module: 'target_settings',
            auditable: ['target_label' => 'Target Settings'],
            description: 'Pengaturan target bulanan diperbarui.',
            before: [
                'monthly_sales_target' => $beforeSalesTarget,
                'monthly_profit_target' => $beforeProfitTarget,
                'daily_global_item_target' => $beforeDailyGlobalItemTarget,
                'product_targets' => $beforeTargets,
            ],
            after: [
                'monthly_sales_target' => $validated['monthly_sales_target'] ?? 0,
                'monthly_profit_target' => $validated['monthly_profit_target'] ?? 0,
                'daily_global_item_target' => $validated['daily_global_item_target'] ?? 0,
                'product_targets' => $normalizedTargets,
            ]
        );

        return back()->with('success', 'Target berhasil disimpan');
    }

    private function normalizeProductTargets(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        if (! is_array($decoded)) {
            return [];
        }

        return collect($decoded)
            ->mapWithKeys(function ($row) {
                $productId = (int) ($row['product_id'] ?? 0);
                $monthlyTarget = (int) ($row['monthly_target'] ?? 0);

                if ($productId <= 0 || $monthlyTarget <= 0) {
                    return [];
                }

                return [$productId => $monthlyTarget];
            })
            ->all();
    }

    /**
     * Store profile settings page
     */
    public function storeProfile()
    {
        $outlet = $this->resolvedOutlet(request());

        $settings = [
            'store_name' => $outlet?->name ?? Setting::get('store_name', ''),
            'store_logo' => $this->resolveStoreLogoUrl($outlet?->logo ?? Setting::get('store_logo', '')),
            'store_address' => $outlet?->address ?? Setting::get('store_address', ''),
            'store_phone' => $outlet?->phone ?? Setting::get('store_phone', ''),
            'store_email' => $outlet?->email ?? Setting::get('store_email', ''),
            'store_website' => $outlet?->website ?? Setting::get('store_website', ''),
            'store_city' => $outlet?->city ?? Setting::get('store_city', ''),
        ];

        $tenantOutlets = Outlet::query()
            ->active()
            ->ordered()
            ->get(['id', 'name', 'code', 'commission_rate_percent'])
            ->map(fn (Outlet $tenantOutlet) => [
                'id' => $tenantOutlet->id,
                'name' => $tenantOutlet->name,
                'code' => $tenantOutlet->code,
                'commission_rate_percent' => (float) ($tenantOutlet->commission_rate_percent ?? 0),
            ])
            ->values();

        return Inertia::render('Dashboard/Settings/Store', [
            'settings' => $settings,
            'tenantOutlets' => $tenantOutlets,
        ]);
    }

    /**
     * Update store profile settings
     */
    public function updateStoreProfile(Request $request)
    {
        $request->validate([
            'store_name' => 'required|string|max:255',
            'store_address' => 'required|string|max:500',
            'store_phone' => 'nullable|string|max:50',
            'store_email' => 'nullable|email|max:255',
            'store_website' => 'nullable|string|max:255',
            'store_city' => 'nullable|string|max:255',
            'store_logo' => 'nullable|image|max:2048',
            'tenant_commissions' => 'nullable|array',
            'tenant_commissions.*' => 'nullable|numeric|min:0|max:100',
        ]);

        $outlet = $this->resolvedOutlet($request);

        $before = [
            'store_name' => $outlet?->name ?? Setting::get('store_name', ''),
            'store_address' => $outlet?->address ?? Setting::get('store_address', ''),
            'store_phone' => $outlet?->phone ?? Setting::get('store_phone', ''),
            'store_email' => $outlet?->email ?? Setting::get('store_email', ''),
            'store_website' => $outlet?->website ?? Setting::get('store_website', ''),
            'store_city' => $outlet?->city ?? Setting::get('store_city', ''),
            'store_logo_changed' => false,
            'tenant_commissions' => Outlet::query()
                ->active()
                ->ordered()
                ->get(['id', 'commission_rate_percent'])
                ->mapWithKeys(fn (Outlet $tenantOutlet) => [
                    (string) $tenantOutlet->id => (float) ($tenantOutlet->commission_rate_percent ?? 0),
                ])
                ->all(),
        ];

        $logoPath = $outlet?->logo ?? Setting::get('store_logo');
        $logoChanged = false;

        if ($request->file('store_logo')) {
            if ($logoPath) {
                Storage::disk('public')->delete($this->normalizePublicStoragePath($logoPath));
            }
            $logoPath = $request->file('store_logo')->store('store', 'public');
            $logoChanged = true;
        }

        if ($outlet) {
            $outlet->update([
                'name' => $request->store_name,
                'legal_name' => $request->store_name,
                'address' => $request->store_address,
                'phone' => $request->store_phone,
                'email' => $request->store_email,
                'website' => $request->store_website,
                'city' => $request->store_city,
                'logo' => $logoPath,
            ]);
        } else {
            Setting::set('store_name', $request->store_name, 'Nama toko');
            Setting::set('store_address', $request->store_address, 'Alamat toko');
            Setting::set('store_phone', $request->store_phone, 'Telepon toko');
            Setting::set('store_email', $request->store_email, 'Email toko');
            Setting::set('store_website', $request->store_website, 'Website toko');
            Setting::set('store_city', $request->store_city, 'Kota/Kabupaten toko');
            Setting::set('store_logo', $logoPath, 'Logo toko');
        }

        collect($request->input('tenant_commissions', []))
            ->each(function ($rate, $tenantOutletId) {
                Outlet::query()
                    ->whereKey((int) $tenantOutletId)
                    ->update([
                        'commission_rate_percent' => round((float) $rate, 2),
                    ]);
            });

        $this->auditLogService->log(
            event: 'store.setting.updated',
            module: 'store_settings',
            auditable: ['target_label' => 'Store Profile'],
            description: 'Profil toko diperbarui.',
            before: $before,
            after: [
                'store_name' => $request->store_name,
                'store_address' => $request->store_address,
                'store_phone' => $request->store_phone,
                'store_email' => $request->store_email,
                'store_website' => $request->store_website,
                'store_city' => $request->store_city,
                'store_logo_changed' => $logoChanged,
                'tenant_commissions' => Outlet::query()
                    ->active()
                    ->ordered()
                    ->get(['id', 'commission_rate_percent'])
                    ->mapWithKeys(fn (Outlet $tenantOutlet) => [
                        (string) $tenantOutlet->id => (float) ($tenantOutlet->commission_rate_percent ?? 0),
                    ])
                    ->all(),
            ],
        );

        return back()->with('success', 'Profil toko berhasil diperbarui');
    }

    private function resolvedOutlet(Request $request): ?Outlet
    {
        if (! Schema::hasTable('outlets')) {
            return null;
        }

        return $this->outletResolver->resolve($request, $request->user());
    }

    private function resolveStoreLogoUrl(?string $logoPath): ?string
    {
        if (! $logoPath) {
            return null;
        }

        if (
            Str::startsWith($logoPath, ['http://', 'https://', '/storage/'])
            || Str::startsWith($logoPath, 'data:')
        ) {
            return $logoPath;
        }

        return '/storage/'.ltrim($logoPath, '/');
    }

    private function normalizePublicStoragePath(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (Str::startsWith($path, '/storage/')) {
            return Str::after($path, '/storage/');
        }

        if (Str::contains($path, '/storage/')) {
            return Str::after($path, '/storage/');
        }

        return $path;
    }

    public function loyalty()
    {
        $outletId = $this->resolvedOutlet(request())?->id;

        return Inertia::render('Dashboard/Settings/Loyalty', [
            'settings' => $this->loyaltyService->settingsPayload($outletId),
        ]);
    }

    public function updateLoyalty(Request $request)
    {
        $validated = $request->validate([
            'enable_earn' => ['required', 'boolean'],
            'enable_redeem' => ['required', 'boolean'],
            'earn_rate_amount' => ['required', 'integer', 'min:1'],
            'redeem_point_value' => ['required', 'integer', 'min:1'],
            'tiers' => ['required', 'array'],
            'tiers.regular' => ['required', 'integer', 'min:0'],
            'tiers.silver' => ['required', 'integer', 'min:0'],
            'tiers.gold' => ['required', 'integer', 'min:0'],
            'tiers.platinum' => ['required', 'integer', 'min:0'],
        ]);

        $orderedThresholds = [
            'regular' => (int) $validated['tiers']['regular'],
            'silver' => (int) $validated['tiers']['silver'],
            'gold' => (int) $validated['tiers']['gold'],
            'platinum' => (int) $validated['tiers']['platinum'],
        ];

        if (
            $orderedThresholds['silver'] < $orderedThresholds['regular']
            || $orderedThresholds['gold'] < $orderedThresholds['silver']
            || $orderedThresholds['platinum'] < $orderedThresholds['gold']
        ) {
            return back()
                ->withErrors([
                    'tiers' => 'Threshold tier harus berurutan dari Regular ke Platinum.',
                ])
                ->withInput();
        }

        $outletId = $this->resolvedOutlet($request)?->id;
        $before = $this->loyaltyService->settingsPayload($outletId);
        $this->loyaltyService->updateSettings([
            ...$validated,
            'tiers' => $orderedThresholds,
        ], $outletId);
        $this->loyaltyService->syncAllMemberTiers($outletId);

        $this->auditLogService->log(
            event: 'loyalty.setting.updated',
            module: 'loyalty_settings',
            auditable: ['target_label' => 'Loyalty Settings'],
            description: 'Pengaturan loyalty diperbarui.',
            before: $before,
            after: $this->loyaltyService->settingsPayload($outletId)
        );

        return back()->with('success', 'Pengaturan loyalty berhasil disimpan');
    }
}
