<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Models\Setting;
use App\Services\AuditLogService;
use App\Services\LoyaltyService;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
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
        $outletId = $this->resolvedOutlet(request())?->id;

        $settings = [
            'monthly_sales_target' => Setting::get('monthly_sales_target', 0, $outletId),
        ];

        return Inertia::render('Dashboard/Settings/Target', [
            'settings' => $settings,
        ]);
    }

    /**
     * Update target settings
     */
    public function updateTarget(Request $request)
    {
        $request->validate([
            'monthly_sales_target' => 'required|numeric|min:0',
        ]);

        Setting::set(
            'monthly_sales_target',
            $request->monthly_sales_target,
            'Target penjualan bulanan',
            $this->resolvedOutlet($request)?->id
        );

        return back()->with('success', 'Target berhasil disimpan');
    }

    /**
     * Store profile settings page
     */
    public function storeProfile()
    {
        $outlet = $this->resolvedOutlet(request());

        $settings = [
            'store_name' => $outlet?->name ?? Setting::get('store_name', ''),
            'store_logo' => $outlet?->logo ?? Setting::get('store_logo', ''),
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
                Storage::disk('public')->delete($logoPath);
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
