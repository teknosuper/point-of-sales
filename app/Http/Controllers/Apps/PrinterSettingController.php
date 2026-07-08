<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\Setting;
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
        $printClientVersion = $this->resolvePrintClientVersion();

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

        $legacyReceiptDevice = $devices->first(fn (KitchenStationDevice $device) => $device->device_type === 'receipt_printer');
        $configuredCashierPaperWidth = Setting::get('cashier_receipt_paper_width', null, $outlet->id);
        $configuredCashierReceiptProfile = Setting::get('cashier_receipt_profile', null, $outlet->id);

        $cashierPaperWidth = (string) ($configuredCashierPaperWidth
            ?? ($legacyReceiptDevice ? data_get($legacyReceiptDevice->meta, 'paper_width', '58mm') : '80mm'));

        $cashierReceiptProfile = (string) ($configuredCashierReceiptProfile ?? Setting::get(
            'cashier_receipt_profile',
            $cashierPaperWidth === '58mm' ? '58_small' : '80_standard',
            $outlet->id
        ));

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
            'print_client_url' => "{$baseUrl}/print-client.html?v={$printClientVersion}&base_url=" . urlencode($baseUrl) . "&token={$token}&outlet_id={$outlet->id}&type=kitchen&station_id={$station->id}&autostart=1",
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
            'receiptProfiles' => KitchenStationDevice::receiptProfiles(),
            'config' => [
                'token' => $token,
                'base_url' => $baseUrl,
                'outlet_id' => $outlet->id,
                'outlet_name' => $outlet->name,
                'done_url' => "{$baseUrl}/api/print-queue/{id}/done?token={$token}",
                'fail_url' => "{$baseUrl}/api/print-queue/{id}/fail?token={$token}",
                'print_client_cashier' => "{$baseUrl}/print-client.html?v={$printClientVersion}&base_url=" . urlencode($baseUrl) . "&token={$token}&outlet_id={$outlet->id}&type=cashier&autostart=1"
                    . ($configuredCashierPaperWidth ? "&paper_width=" . urlencode((string) $configuredCashierPaperWidth) : '')
                    . ($configuredCashierReceiptProfile ? "&receipt_profile=" . urlencode((string) $configuredCashierReceiptProfile) : ''),
                'print_client_kitchen' => "{$baseUrl}/print-client.html?v={$printClientVersion}&base_url=" . urlencode($baseUrl) . "&token={$token}&outlet_id={$outlet->id}&type=kitchen&autostart=1",
            ],
            'cashierReceipt' => [
                'paper_width' => $cashierPaperWidth,
                'receipt_profile' => $cashierReceiptProfile,
            ],
        ]);
    }

    public function updateCashierReceipt(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');

        $validated = $request->validate([
            'paper_width' => ['required', 'in:58mm,80mm'],
            'receipt_profile' => ['required', 'in:' . implode(',', array_keys(KitchenStationDevice::receiptProfiles()))],
        ]);

        Setting::set(
            'cashier_receipt_paper_width',
            $validated['paper_width'],
            'Lebar kertas default untuk struk kasir.',
            $outlet->id
        );

        Setting::set(
            'cashier_receipt_profile',
            $validated['receipt_profile'],
            'Profile layout default untuk struk kasir.',
            $outlet->id
        );

        return back()->with('success', 'Pengaturan struk kasir berhasil diperbarui.');
    }

    private function resolvePrintClientVersion(): string
    {
        $paths = [
            public_path('print-client.html'),
            app_path('Http/Controllers/Api/PrintQueueController.php'),
            app_path('Services/ReceiptLayoutService.php'),
            app_path('Services/PrintJobService.php'),
        ];

        $signature = collect($paths)
            ->filter(fn ($path) => file_exists($path))
            ->map(fn ($path) => basename($path).':'.filemtime($path))
            ->implode('|');

        if ($signature === '') {
            return now()->format('YmdHis');
        }

        return substr(sha1($signature), 0, 12);
    }
}
