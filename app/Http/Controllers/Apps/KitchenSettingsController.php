<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\Outlet;
use App\Models\ProductKitchenStationMapping;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class KitchenSettingsController extends Controller
{
    public function index(Request $request)
    {
        $filters = [
            'outlet_id' => $request->input('outlet_id', ''),
            'status' => $request->input('status', ''),
        ];

        $stations = KitchenStation::query()
            ->with(['outlet:id,name,code', 'devices'])
            ->when($filters['outlet_id'] !== '', fn ($query) => $query->where('outlet_id', $filters['outlet_id']))
            ->when($filters['status'] !== '', function ($query) use ($filters) {
                return match ($filters['status']) {
                    'active' => $query->where('is_active', true),
                    'inactive' => $query->where('is_active', false),
                    default => $query,
                };
            })
            ->orderBy('outlet_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $stationBaseQuery = KitchenStation::query()
            ->when($filters['outlet_id'] !== '', fn ($query) => $query->where('outlet_id', $filters['outlet_id']));

        $deviceBaseQuery = KitchenStationDevice::query()
            ->when($filters['outlet_id'] !== '', function ($query) use ($filters) {
                $query->whereHas('kitchenStation', fn ($builder) => $builder->where('outlet_id', $filters['outlet_id']));
            });

        $mappingBaseQuery = ProductKitchenStationMapping::query()
            ->where('is_active', true)
            ->when($filters['outlet_id'] !== '', function ($query) use ($filters) {
                $query->whereHas('kitchenStation', fn ($builder) => $builder->where('outlet_id', $filters['outlet_id']));
            });

        $setupStatus = [
            'stations_count' => (clone $stationBaseQuery)->count(),
            'devices_count' => (clone $deviceBaseQuery)->count(),
            'printer_count' => (clone $deviceBaseQuery)->where('device_type', 'printer')->count(),
            'screen_count' => (clone $deviceBaseQuery)->where('device_type', 'screen')->count(),
            'mapped_products_count' => (clone $mappingBaseQuery)->count(),
        ];

        $setupStatus['has_station'] = $setupStatus['stations_count'] > 0;
        $setupStatus['has_device'] = $setupStatus['devices_count'] > 0;
        $setupStatus['has_printer_or_screen'] = ($setupStatus['printer_count'] + $setupStatus['screen_count']) > 0;
        $setupStatus['has_product_mapping'] = $setupStatus['mapped_products_count'] > 0 || $setupStatus['stations_count'] === 0;

        return Inertia::render('Dashboard/KitchenSettings/Index', [
            'stations' => $stations,
            'filters' => $filters,
            'outlets' => Outlet::active()->ordered()->get(['id', 'name', 'code']),
            'setupStatus' => $setupStatus,
            'ui' => [
                'show_station_form' => $request->boolean('station_create'),
                'show_device_form' => $request->boolean('device_create'),
                'preset_outlet_id' => $request->input('outlet_id'),
            ],
        ]);
    }

    public function storeStation(Request $request)
    {
        $data = $request->validate([
            'outlet_id' => ['required', 'exists:outlets,id'],
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:30'],
            'station_type' => ['nullable', 'string', 'max:30'],
            'display_mode' => ['nullable', 'string', 'max:30'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        KitchenStation::create([
            ...$data,
            'slug' => Str::slug($data['name']),
            'station_type' => $data['station_type'] ?? 'kitchen',
            'display_mode' => $data['display_mode'] ?? 'screen',
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'is_active' => (bool) ($data['is_active'] ?? true),
        ]);

        return back()->with('success', 'Station dapur berhasil ditambahkan.');
    }

    public function updateStation(Request $request, KitchenStation $station)
    {
        $data = $request->validate([
            'outlet_id' => ['required', 'exists:outlets,id'],
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:30'],
            'station_type' => ['nullable', 'string', 'max:30'],
            'display_mode' => ['nullable', 'string', 'max:30'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $station->update([
            ...$data,
            'slug' => Str::slug($data['name']),
            'station_type' => $data['station_type'] ?? 'kitchen',
            'display_mode' => $data['display_mode'] ?? 'screen',
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'is_active' => (bool) ($data['is_active'] ?? false),
        ]);

        return back()->with('success', 'Station dapur berhasil diperbarui.');
    }

    public function storeDevice(Request $request, KitchenStation $station)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'device_type' => ['required', 'string', 'max:30'],
            'connection_driver' => ['required', 'string', 'max:30'],
            'endpoint' => ['nullable', 'string', 'max:255'],
            'is_primary' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'paper_width' => ['nullable', 'string', 'in:58mm,80mm'],
            'template_style' => ['nullable', 'string', 'in:compact,standard,kitchen'],
            'print_copies' => ['nullable', 'integer', 'min:1', 'max:3'],
        ]);

        if (($data['is_primary'] ?? false) === true) {
            $station->devices()->update(['is_primary' => false]);
        }

        $station->devices()->create([
            'name' => $data['name'],
            'device_type' => $data['device_type'],
            'connection_driver' => $data['connection_driver'],
            'endpoint' => $data['endpoint'] ?? null,
            'is_primary' => (bool) ($data['is_primary'] ?? false),
            'is_active' => (bool) ($data['is_active'] ?? true),
            'meta' => [
                'paper_width' => $data['paper_width'] ?? '80mm',
                'template_style' => $data['template_style'] ?? 'standard',
                'print_copies' => (int) ($data['print_copies'] ?? 1),
            ],
        ]);

        return back()->with('success', 'Device dapur berhasil ditambahkan.');
    }

    public function updateDevice(Request $request, KitchenStationDevice $device)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'device_type' => ['required', 'string', 'max:30'],
            'connection_driver' => ['required', 'string', 'max:30'],
            'endpoint' => ['nullable', 'string', 'max:255'],
            'is_primary' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'paper_width' => ['nullable', 'string', 'in:58mm,80mm'],
            'template_style' => ['nullable', 'string', 'in:compact,standard,kitchen'],
            'print_copies' => ['nullable', 'integer', 'min:1', 'max:3'],
        ]);

        if (($data['is_primary'] ?? false) === true) {
            KitchenStationDevice::query()
                ->where('kitchen_station_id', $device->kitchen_station_id)
                ->whereKeyNot($device->id)
                ->update(['is_primary' => false]);
        }

        $device->update([
            'name' => $data['name'],
            'device_type' => $data['device_type'],
            'connection_driver' => $data['connection_driver'],
            'endpoint' => $data['endpoint'] ?? null,
            'is_primary' => (bool) ($data['is_primary'] ?? false),
            'is_active' => (bool) ($data['is_active'] ?? false),
            'meta' => [
                ...($device->meta ?? []),
                'paper_width' => $data['paper_width'] ?? (($device->meta ?? [])['paper_width'] ?? '80mm'),
                'template_style' => $data['template_style'] ?? (($device->meta ?? [])['template_style'] ?? 'standard'),
                'print_copies' => (int) ($data['print_copies'] ?? (($device->meta ?? [])['print_copies'] ?? 1)),
            ],
        ]);

        return back()->with('success', 'Device dapur berhasil diperbarui.');
    }

    public function testDevice(KitchenStationDevice $device)
    {
        $meta = $device->meta ?? [];
        $meta['last_test'] = [
            'type' => 'print',
            'status' => 'ok',
            'message' => $device->device_type === 'printer'
                ? 'Test print dummy ditandai berhasil. Lanjutkan integrasi printer fisik di endpoint device.'
                : 'Test device dummy ditandai berhasil.',
            'tested_at' => now()->toDateTimeString(),
        ];

        $device->update(['meta' => $meta]);

        return back()->with('success', 'Test device berhasil dicatat.');
    }

    public function healthCheckDevice(KitchenStationDevice $device)
    {
        $meta = $device->meta ?? [];
        $status = 'warning';
        $message = 'Device aktif, tetapi endpoint belum diisi.';

        if (! $device->is_active) {
            $status = 'inactive';
            $message = 'Device nonaktif. Aktifkan dulu sebelum dipakai.';
        } elseif ($device->connection_driver === 'browser') {
            $status = 'ok';
            $message = 'Driver browser siap dipakai dari halaman kitchen display.';
        } elseif (filled($device->endpoint)) {
            $status = 'ok';
            $message = 'Endpoint device tersedia. Lanjutkan verifikasi fisik di jaringan/printer service.';
        }

        $meta['last_health_check'] = [
            'status' => $status,
            'message' => $message,
            'checked_at' => now()->toDateTimeString(),
        ];

        $device->update(['meta' => $meta]);

        return back()->with('success', 'Health check device berhasil dicatat.');
    }
}
