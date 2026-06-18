<?php

namespace App\Http\Middleware;

use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\KitchenTicket;
use App\Models\Outlet;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccessibleOutletContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->isSuperAdmin()) {
            return $next($request);
        }

        $kitchenTicket = $request->route('kitchenTicket');
        if ($kitchenTicket instanceof KitchenTicket && $this->canAccessKitchenTicketAsTenant($user, $kitchenTicket)) {
            return $next($request);
        }

        $outletIds = collect([
            $this->resolveRouteOutletId($request),
            $this->resolveRequestOutletId($request),
            ...$this->resolveModelBoundOutletIds($request),
        ])
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        foreach ($outletIds as $outletId) {
            abort_unless($user->hasAccessToOutlet($outletId), 403);
        }

        return $next($request);
    }

    private function canAccessKitchenTicketAsTenant($user, KitchenTicket $kitchenTicket): bool
    {
        if ($user->hasAccessToOutlet((int) $kitchenTicket->outlet_id)) {
            return false;
        }

        $tenantOutletIds = $kitchenTicket->items()
            ->with('transactionDetail:id,tenant_outlet_id')
            ->get()
            ->pluck('transactionDetail.tenant_outlet_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($tenantOutletIds->isEmpty()) {
            return false;
        }

        return $tenantOutletIds->every(fn (int $tenantOutletId) => $user->hasAccessToOutlet($tenantOutletId));
    }

    private function resolveRouteOutletId(Request $request): ?int
    {
        $outlet = $request->route('outlet');
        if ($outlet instanceof Outlet) {
            return (int) $outlet->id;
        }

        $tenantOutlet = $request->route('tenantOutlet');
        if ($tenantOutlet instanceof Outlet) {
            return (int) $tenantOutlet->id;
        }

        $station = $request->route('station');
        if ($station instanceof KitchenStation) {
            return (int) $station->outlet_id;
        }

        $device = $request->route('device');
        if ($device instanceof KitchenStationDevice) {
            $device->loadMissing('kitchenStation:id,outlet_id');

            return $device->kitchenStation?->outlet_id
                ? (int) $device->kitchenStation->outlet_id
                : null;
        }

        return null;
    }

    private function resolveRequestOutletId(Request $request): ?int
    {
        $outletId = $request->input('outlet_id');

        if ($outletId === null || $outletId === '') {
            return null;
        }

        return (int) $outletId;
    }

    private function resolveModelBoundOutletIds(Request $request): array
    {
        return collect($request->route()?->parameters() ?? [])
            ->filter(fn ($parameter) => $parameter instanceof Model)
            ->flatMap(function (Model $model) {
                $ids = [];

                $outletId = $model->getAttribute('outlet_id');
                if ($outletId) {
                    $ids[] = (int) $outletId;
                }

                $tenantOutletId = $model->getAttribute('tenant_outlet_id');
                if ($tenantOutletId) {
                    $ids[] = (int) $tenantOutletId;
                }

                return $ids;
            })
            ->unique()
            ->values()
            ->all();
    }
}
