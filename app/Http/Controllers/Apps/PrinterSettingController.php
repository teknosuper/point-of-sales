<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PrinterSettingController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request): Response
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');

        $token = (string) config('services.print_bridge.token', '0000');
        $baseUrl = rtrim((string) config('app.url'), '/');

        $stations = KitchenStation::query()
            ->where('outlet_id', $outlet->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'code']);

        $devices = KitchenStationDevice::query()
            ->whereHas('kitchenStation', fn ($q) => $q->where('outlet_id', $outlet->id))
            ->where('is_active', true)
            ->with('kitchenStation:id,name,slug,code,outlet_id')
            ->orderBy('name')
            ->get(['id', 'kitchen_station_id', 'name', 'device_type', 'connection_driver', 'endpoint', 'meta']);

        $queueUrls = [
            'cashier' => [
                'label' => 'Struk Kasir (Receipt)',
                'description' => 'Antrian cetak struk transaksi kasir.',
                'url' => "{$baseUrl}/api/print-queue/cashier?token={$token}&outlet_id={$outlet->id}",
                'poll_url' => "{$baseUrl}/api/print-queue/cashier",
            ],
            'kitchen' => [
                'label' => 'Tiket Dapur (Kitchen Ticket)',
                'description' => 'Antrian cetak tiket pesanan untuk dapur.',
                'url' => "{$baseUrl}/api/print-queue/kitchen?token={$token}&outlet_id={$outlet->id}",
                'poll_url' => "{$baseUrl}/api/print-queue/kitchen",
            ],
            'status' => [
                'label' => 'Status Antrian',
                'description' => 'Cek jumlah job yang menunggu dicetak.',
                'url' => "{$baseUrl}/api/print-queue/status?token={$token}&outlet_id={$outlet->id}",
                'poll_url' => "{$baseUrl}/api/print-queue/status",
            ],
        ];

        // Build per-station URLs for kitchen
        $stationUrls = $stations->map(fn (KitchenStation $station) => [
            'id' => $station->id,
            'name' => $station->name,
            'code' => $station->code,
            'url' => "{$baseUrl}/api/print-queue/kitchen?token={$token}&outlet_id={$outlet->id}&station_id={$station->id}",
        ]);

        // Build per-device URLs
        $deviceUrls = $devices->map(fn (KitchenStationDevice $device) => [
            'id' => $device->id,
            'name' => $device->name,
            'station_name' => $device->kitchenStation?->name ?? '-',
            'device_type' => $device->device_type,
            'url_cashier' => "{$baseUrl}/api/print-queue/cashier?token={$token}&outlet_id={$outlet->id}&device_id={$device->id}",
            'url_kitchen' => "{$baseUrl}/api/print-queue/kitchen?token={$token}&outlet_id={$outlet->id}&device_id={$device->id}",
        ]);

        return Inertia::render('Dashboard/Settings/Printer', [
            'queueUrls' => $queueUrls,
            'stationUrls' => $stationUrls,
            'deviceUrls' => $deviceUrls,
            'config' => [
                'token' => $token,
                'base_url' => $baseUrl,
                'outlet_id' => $outlet->id,
                'outlet_name' => $outlet->name,
                'done_url' => "{$baseUrl}/api/print-queue/{id}/done?token={$token}",
                'fail_url' => "{$baseUrl}/api/print-queue/{id}/fail?token={$token}",
                'print_client_cashier' => "{$baseUrl}/print-client.html?base_url=" . urlencode($baseUrl) . "&token={$token}&outlet_id={$outlet->id}&type=cashier&autostart=1",
                'print_client_kitchen' => "{$baseUrl}/print-client.html?base_url=" . urlencode($baseUrl) . "&token={$token}&outlet_id={$outlet->id}&type=kitchen&autostart=1",
            ],
        ]);
    }
}
