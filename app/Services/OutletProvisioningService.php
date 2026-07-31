<?php

namespace App\Services;

use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\Outlet;

class OutletProvisioningService
{
    public function provisionKitchenSetup(Outlet $outlet): void
    {
        $station = KitchenStation::create([
            'outlet_id' => $outlet->id,
            'name' => 'Dapur '.$outlet->name,
            'slug' => $this->resolveStationSlug($outlet),
            'code' => 'ST-'.strtoupper($outlet->code),
            'station_type' => 'kitchen',
            'display_mode' => 'screen',
            'sort_order' => 0,
            'is_active' => true,
        ]);

        $this->createDefaultDevices($station);
    }

    private function resolveStationSlug(Outlet $outlet): string
    {
        $base = strtolower($outlet->code);
        $base = preg_replace('/[^a-z0-9-]+/', '-', $base);
        $base = trim($base, '-');

        if ($base === '') {
            $base = 'outlet-'.$outlet->id;
        }

        if (KitchenStation::query()->where('outlet_id', $outlet->id)->where('slug', $base)->exists()) {
            $base = $base.'-'.$outlet->id;
        }

        return $base;
    }

    private function createDefaultDevices(KitchenStation $station): void
    {
        KitchenStationDevice::create([
            'kitchen_station_id' => $station->id,
            'name' => 'Layar '.$station->name,
            'device_type' => 'screen',
            'connection_driver' => 'browser',
            'endpoint' => 'screen://'.$station->slug.'-queue',
            'is_primary' => true,
            'is_active' => true,
            'meta' => [
                'dispatch_mode' => 'manual',
                'print_profile' => KitchenStationDevice::PRINT_PROFILE_BROWSER,
            ],
        ]);

        KitchenStationDevice::create([
            'kitchen_station_id' => $station->id,
            'name' => 'Printer '.$station->name,
            'device_type' => 'printer',
            'connection_driver' => 'browser',
            'endpoint' => 'bluetooth://rawbt/'.$station->slug,
            'is_primary' => true,
            'is_active' => true,
            'meta' => [
                'paper_width' => '80mm',
                'template_style' => 'kitchen',
                'print_copies' => 1,
                'dispatch_mode' => 'auto',
                'print_profile' => KitchenStationDevice::PRINT_PROFILE_RAWBT,
                'rawbt_intent_url' => 'rawbt:base64',
            ],
        ]);
    }
}
