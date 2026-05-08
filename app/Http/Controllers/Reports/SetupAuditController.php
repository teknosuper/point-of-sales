<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\Outlet;
use App\Models\Product;
use Inertia\Inertia;

class SetupAuditController extends Controller
{
    public function index()
    {
        $outletsWithoutUsers = Outlet::query()
            ->withCount('users')
            ->having('users_count', '=', 0)
            ->ordered()
            ->get(['id', 'name', 'code', 'outlet_type']);

        $outletsWithoutStations = Outlet::query()
            ->withCount('kitchenStations')
            ->having('kitchen_stations_count', '=', 0)
            ->ordered()
            ->get(['id', 'name', 'code', 'outlet_type']);

        $stationsWithoutDevices = KitchenStation::query()
            ->with(['outlet:id,name,code'])
            ->withCount('devices')
            ->having('devices_count', '=', 0)
            ->orderBy('name')
            ->get(['id', 'outlet_id', 'name', 'code', 'display_mode']);

        $printersWithoutEndpoint = KitchenStationDevice::query()
            ->with(['kitchenStation.outlet:id,name,code'])
            ->where('device_type', 'printer')
            ->where(function ($query) {
                $query->whereNull('endpoint')->orWhere('endpoint', '');
            })
            ->orderBy('name')
            ->get(['id', 'kitchen_station_id', 'name', 'connection_driver', 'endpoint', 'is_active']);

        $productsWithoutTenant = Product::query()
            ->with(['category:id,name'])
            ->whereNull('tenant_outlet_id')
            ->orderBy('title')
            ->get(['id', 'title', 'sku', 'barcode', 'category_id']);

        $productsWithoutKitchenMapping = Product::query()
            ->with(['tenantOutlet:id,name,code', 'category:id,name'])
            ->whereDoesntHave('kitchenStationMappings', fn ($query) => $query->where('is_active', true))
            ->orderBy('title')
            ->get(['id', 'title', 'sku', 'barcode', 'category_id', 'tenant_outlet_id']);

        $summary = [
            'outlets_without_users' => $outletsWithoutUsers->count(),
            'outlets_without_stations' => $outletsWithoutStations->count(),
            'stations_without_devices' => $stationsWithoutDevices->count(),
            'printers_without_endpoint' => $printersWithoutEndpoint->count(),
            'products_without_tenant' => $productsWithoutTenant->count(),
            'products_without_kitchen_mapping' => $productsWithoutKitchenMapping->count(),
        ];

        return Inertia::render('Dashboard/Reports/SetupAudit', [
            'summary' => $summary,
            'outletsWithoutUsers' => $outletsWithoutUsers,
            'outletsWithoutStations' => $outletsWithoutStations,
            'stationsWithoutDevices' => $stationsWithoutDevices,
            'printersWithoutEndpoint' => $printersWithoutEndpoint,
            'productsWithoutTenant' => $productsWithoutTenant,
            'productsWithoutKitchenMapping' => $productsWithoutKitchenMapping,
        ]);
    }
}
