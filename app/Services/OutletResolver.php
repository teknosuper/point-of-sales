<?php

namespace App\Services;

use App\Models\Outlet;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class OutletResolver
{
    public function resolve(?Request $request = null, ?User $user = null): ?Outlet
    {
        if (! Schema::hasTable('outlets')) {
            return null;
        }

        $user ??= $request?->user();
        $requestedOutletId = $request?->session()->get('active_outlet_id');

        if ($user) {
            if ($user->isKitchenWorkspace() && $user->preferredKitchenStation?->outlet_id) {
                return $user->outlets()
                    ->where('outlets.id', (int) $user->preferredKitchenStation->outlet_id)
                    ->active()
                    ->first();
            }

            if ($requestedOutletId) {
                $matchedOutlet = $user->outlets()
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
