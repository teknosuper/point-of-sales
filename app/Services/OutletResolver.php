<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class OutletResolver
{
    public function shouldRestrictCashierToMainOutlet(?User $user): bool
    {
        if (! $user || $user->isSuperAdmin() || $user->isKitchenWorkspace()) {
            return false;
        }

        return ($user->can('cashier-shifts-open') || $user->can('transactions-access'))
            && ! $user->can('outlets-access');
    }

    public function resolve(?Request $request = null, ?User $user = null): ?Outlet
    {
        if (! Schema::hasTable('outlets')) {
            return null;
        }

        $user ??= $request?->user();
        $requestedOutletId = $request?->session()->get('active_outlet_id');

        if ($user) {
            // For tenant owner (has direct tenant access), return their tenant outlet directly
            if ($requestedOutletId) {
                $matchedOutlet = $user->accessibleOutletsQuery()
                    ->where('outlets.id', $requestedOutletId)
                    ->active()
                    ->first();

                if ($matchedOutlet) {
                    return $matchedOutlet;
                }
            }

            // If user has only tenant outlets (not main), return the primary tenant outlet
            $primaryTenantOutlet = $user->outlets()
                ->active()
                ->where('outlets.outlet_type', 'tenant')
                ->orderByDesc('outlet_user.is_primary')
                ->orderBy('outlets.sort_order')
                ->orderBy('outlets.name')
                ->first();

            if ($primaryTenantOutlet) {
                return $primaryTenantOutlet;
            }

            if ($this->shouldRestrictCashierToMainOutlet($user)) {
                $mainOutlet = $this->resolveCashierMainOutlet($user, $requestedOutletId);

                if ($mainOutlet) {
                    return $mainOutlet;
                }
            }

            if ($user->isKitchenWorkspace() && $user->preferredKitchenStation?->outlet_id) {
                return $user->accessibleOutletsQuery()
                    ->where('outlets.id', (int) $user->preferredKitchenStation->outlet_id)
                    ->active()
                    ->first();
            }

            if ($requestedOutletId) {
                $matchedOutlet = $user->accessibleOutletsQuery()
                    ->where('outlets.id', $requestedOutletId)
                    ->active()
                    ->first();

                if ($matchedOutlet) {
                    return $matchedOutlet;
                }
            }

            $primaryOutlet = $user->outlets()
                ->active()
                ->orderByDesc('outlet_user.is_primary')
                ->orderBy('outlets.sort_order')
                ->orderBy('outlets.name')
                ->first();

            if ($primaryOutlet) {
                return $primaryOutlet;
            }
        }

        return Outlet::query()
            ->active()
            ->orderByDesc('is_default')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->first();
    }

    private function resolveCashierMainOutlet(User $user, mixed $requestedOutletId = null): ?Outlet
    {
        if ($requestedOutletId) {
            $requestedOutlet = $user->accessibleOutletsQuery()
                ->active()
                ->where('outlets.id', (int) $requestedOutletId)
                ->first();

            if ($requestedOutlet) {
                if (($requestedOutlet->outlet_type ?? 'main') === 'main') {
                    return $requestedOutlet;
                }

                if ($requestedOutlet->parent_outlet_id) {
                    $parentOutlet = $user->accessibleOutletsQuery()
                        ->active()
                        ->where('outlets.id', (int) $requestedOutlet->parent_outlet_id)
                        ->where('outlets.outlet_type', 'main')
                        ->first();

                    if ($parentOutlet) {
                        return $parentOutlet;
                    }
                }
            }
        }

        $primaryMainOutlet = $user->outlets()
            ->active()
            ->where('outlets.outlet_type', 'main')
            ->orderByDesc('outlet_user.is_primary')
            ->orderBy('outlets.sort_order')
            ->orderBy('outlets.name')
            ->first();

        if ($primaryMainOutlet) {
            return $primaryMainOutlet;
        }

        $directTenantParentIds = $user->outlets()
            ->active()
            ->where('outlets.outlet_type', 'tenant')
            ->whereNotNull('outlets.parent_outlet_id')
            ->pluck('outlets.parent_outlet_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($directTenantParentIds->isNotEmpty()) {
            $tenantParentOutlet = $user->accessibleOutletsQuery()
                ->active()
                ->where('outlets.outlet_type', 'main')
                ->whereIn('outlets.id', $directTenantParentIds->all())
                ->orderBy('outlets.sort_order')
                ->orderBy('outlets.name')
                ->first();

            if ($tenantParentOutlet) {
                return $tenantParentOutlet;
            }
        }

        return $user->accessibleOutletsQuery()
            ->active()
            ->where('outlets.outlet_type', 'main')
            ->orderBy('outlets.sort_order')
            ->orderBy('outlets.name')
            ->first();
    }

    public function profilePayload(?Request $request = null, ?User $user = null): array
    {
        $outlet = $this->resolve($request, $user);

        if ($outlet) {
            return $outlet->profilePayload();
        }

        return [
            'id' => null,
            'code' => null,
            'slug' => null,
            'name' => 'GTC KASIR',
            'logo' => null,
            'address' => '',
            'phone' => '',
            'email' => '',
            'website' => '',
            'city' => '',
        ];
    }
}
