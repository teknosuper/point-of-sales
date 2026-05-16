<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\Outlet;
use App\Models\PrintJob;
use App\Models\ProductKitchenStationMapping;
use App\Models\Setting;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class KitchenSettingsController extends Controller
{
    private const PRINT_PROFILES = [
        KitchenStationDevice::PRINT_PROFILE_BROWSER,
        KitchenStationDevice::PRINT_PROFILE_RAWBT,
        KitchenStationDevice::PRINT_PROFILE_QZ_TRAY,
        KitchenStationDevice::PRINT_PROFILE_BRIDGE,
    ];

    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $lockedKitchenOutletId = $user?->isKitchenWorkspace() && $user->preferredKitchenStation?->outlet_id
            ? (int) $user->preferredKitchenStation->outlet_id
            : null;

        $filters = [
            'outlet_id' => $lockedKitchenOutletId ?: $request->input('outlet_id', ''),
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

        $latestDeviceJobs = PrintJob::query()
            ->with(['device:id,name'])
            ->where('job_type', PrintJob::TYPE_KITCHEN_TICKET)
            ->whereIn('kitchen_station_device_id', $stations->pluck('devices.*.id')->flatten()->filter()->values())
            ->latest()
            ->get()
            ->groupBy('kitchen_station_device_id')
            ->map(fn (Collection $jobs) => $jobs->first());

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
            'stations' => $stations->map(fn (KitchenStation $station) => $this->stationPayload($station, $latestDeviceJobs))->values(),
            'filters' => $filters,
            'outlets' => Outlet::active()
                ->ordered()
                ->when($lockedKitchenOutletId, fn ($query) => $query->where('id', $lockedKitchenOutletId))
                ->get(['id', 'name', 'code']),
            'printProfiles' => KitchenStationDevice::printProfiles(),
            'setupStatus' => $setupStatus,
            'operationalSettings' => $this->operationalSettingsPayload(
                $lockedKitchenOutletId ?: ($filters['outlet_id'] !== '' ? (int) $filters['outlet_id'] : null)
            ),
            'recentPrintJobs' => PrintJob::query()
                ->with([
                    'device:id,name,kitchen_station_id',
                    'device.kitchenStation:id,name,outlet_id',
                    'device.kitchenStation.outlet:id,name,code',
                    'kitchenTicket:id,ticket_number,transaction_id',
                    'kitchenTicket.transaction:id,invoice',
                ])
                ->where('job_type', PrintJob::TYPE_KITCHEN_TICKET)
                ->when($filters['outlet_id'] !== '', fn ($query) => $query->where('outlet_id', $filters['outlet_id']))
                ->latest()
                ->limit(12)
                ->get()
                ->map(fn (PrintJob $job) => [
                    'id' => $job->id,
                    'status' => $job->status,
                    'job_type' => $job->job_type,
                    'copies' => (int) $job->copies,
                    'queued_at' => optional($job->queued_at)->toIso8601String(),
                    'processed_at' => optional($job->processed_at)->toIso8601String(),
                    'failed_at' => optional($job->failed_at)->toIso8601String(),
                    'failure_reason' => $job->failure_reason,
                    'device_name' => $job->device?->name,
                    'station_name' => $job->device?->kitchenStation?->name,
                    'outlet_name' => $job->device?->kitchenStation?->outlet?->name,
                    'outlet_code' => $job->device?->kitchenStation?->outlet?->code,
                    'ticket_number' => $job->kitchenTicket?->ticket_number,
                    'invoice' => $job->kitchenTicket?->transaction?->invoice,
                ])
                ->values(),
            'ui' => [
                'show_station_form' => $request->boolean('station_create'),
                'show_device_form' => $request->boolean('device_create'),
                'preset_outlet_id' => $request->input('outlet_id'),
            ],
        ]);
    }

    public function updateOperational(Request $request)
    {
        $user = $request->user();
        $lockedKitchenOutletId = $user?->isKitchenWorkspace() && $user->preferredKitchenStation?->outlet_id
            ? (int) $user->preferredKitchenStation->outlet_id
            : null;

        $data = $request->validate([
            'outlet_id' => ['nullable', 'integer', 'exists:outlets,id'],
            'is_open' => ['required', 'boolean'],
            'open_time' => ['nullable', 'date_format:H:i'],
            'close_time' => ['nullable', 'date_format:H:i'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $outletId = $lockedKitchenOutletId ?: (int) ($data['outlet_id'] ?: 0);
        abort_if($outletId <= 0, 422, 'Outlet operasional tidak ditemukan.');

        if (! $lockedKitchenOutletId) {
            abort_unless($user?->hasAccessToOutlet($outletId), 403);
        }

        Setting::setMany([
            'daily_store_open' => [
                'value' => $data['is_open'] ? '1' : '0',
                'description' => 'Status buka toko hari ini',
            ],
            'daily_store_open_time' => [
                'value' => $data['open_time'] ?: '',
                'description' => 'Jam buka toko hari ini',
            ],
            'daily_store_close_time' => [
                'value' => $data['close_time'] ?: '',
                'description' => 'Jam tutup toko hari ini',
            ],
            'daily_store_notes' => [
                'value' => trim((string) ($data['notes'] ?? '')),
                'description' => 'Catatan operasional toko hari ini',
            ],
        ], $outletId);

        return back()->with('success', 'Operasional outlet hari ini berhasil diperbarui.');
    }

    public function accessSheet(Request $request, KitchenStation $station): Response
    {
        $station->loadMissing(['outlet:id,name,code', 'devices']);

        return Inertia::render('Dashboard/KitchenSettings/AccessSheet', [
            'station' => [
                'id' => $station->id,
                'name' => $station->name,
                'slug' => $station->slug,
                'code' => $station->code,
                'station_type' => $station->station_type,
                'display_mode' => $station->display_mode,
                'outlet' => $station->outlet ? [
                    'id' => $station->outlet->id,
                    'name' => $station->outlet->name,
                    'code' => $station->outlet->code,
                ] : null,
                'devices' => $station->devices
                    ->where('is_active', true)
                    ->sortByDesc('is_primary')
                    ->map(fn (KitchenStationDevice $device) => [
                        'id' => $device->id,
                        'name' => $device->name,
                        'device_type' => $device->device_type,
                        'is_primary' => (bool) $device->is_primary,
                        'print_profile' => $device->meta['print_profile'] ?? null,
                    ])
                    ->values(),
                'shortcut_urls' => [
                    'entry_url' => route('kitchen.entry', ['stationSlug' => $station->slug]),
                    'kiosk_url' => route('kitchen.entry', ['stationSlug' => $station->slug, 'kiosk' => 1]),
                    'queue_url' => route('kitchen.show', ['stationSlug' => $station->slug]),
                    'login_url' => route('kitchen.login', ['station' => $station->slug]),
                ],
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
            'print_profile' => ['nullable', 'string', 'in:'.implode(',', self::PRINT_PROFILES)],
            'dispatch_mode' => ['nullable', 'string', 'in:manual,auto'],
            'fallback_device_id' => ['nullable', 'integer', 'exists:kitchen_station_devices,id'],
            'rawbt_intent_url' => ['nullable', 'string', 'max:255'],
            'qz_printer_name' => ['nullable', 'string', 'max:120'],
            'bridge_device_key' => ['nullable', 'string', 'max:120'],
            'is_primary' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'paper_width' => ['nullable', 'string', 'in:58mm,80mm'],
            'template_style' => ['nullable', 'string', 'in:compact,standard,kitchen'],
            'print_copies' => ['nullable', 'integer', 'min:1', 'max:3'],
        ]);

        $this->ensureFallbackDeviceBelongsToStation($station, $data['fallback_device_id'] ?? null);

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
                'print_profile' => $data['print_profile'] ?? $this->defaultPrintProfile($data['connection_driver'], $data['device_type']),
                'dispatch_mode' => $data['dispatch_mode'] ?? 'manual',
                'fallback_device_id' => $data['fallback_device_id'] ?? null,
                'rawbt_intent_url' => $data['rawbt_intent_url'] ?? null,
                'qz_printer_name' => $data['qz_printer_name'] ?? null,
                'bridge_device_key' => $data['bridge_device_key'] ?? null,
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
            'print_profile' => ['nullable', 'string', 'in:'.implode(',', self::PRINT_PROFILES)],
            'dispatch_mode' => ['nullable', 'string', 'in:manual,auto'],
            'fallback_device_id' => ['nullable', 'integer', 'exists:kitchen_station_devices,id'],
            'rawbt_intent_url' => ['nullable', 'string', 'max:255'],
            'qz_printer_name' => ['nullable', 'string', 'max:120'],
            'bridge_device_key' => ['nullable', 'string', 'max:120'],
            'is_primary' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'paper_width' => ['nullable', 'string', 'in:58mm,80mm'],
            'template_style' => ['nullable', 'string', 'in:compact,standard,kitchen'],
            'print_copies' => ['nullable', 'integer', 'min:1', 'max:3'],
        ]);

        $this->ensureFallbackDeviceBelongsToStation($device->kitchenStation, $data['fallback_device_id'] ?? null, $device->id);

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
                'print_profile' => $data['print_profile'] ?? (($device->meta ?? [])['print_profile'] ?? $this->defaultPrintProfile($data['connection_driver'], $data['device_type'])),
                'dispatch_mode' => $data['dispatch_mode'] ?? (($device->meta ?? [])['dispatch_mode'] ?? 'manual'),
                'fallback_device_id' => $data['fallback_device_id'] ?? (($device->meta ?? [])['fallback_device_id'] ?? null),
                'rawbt_intent_url' => $data['rawbt_intent_url'] ?? (($device->meta ?? [])['rawbt_intent_url'] ?? null),
                'qz_printer_name' => $data['qz_printer_name'] ?? (($device->meta ?? [])['qz_printer_name'] ?? null),
                'bridge_device_key' => $data['bridge_device_key'] ?? (($device->meta ?? [])['bridge_device_key'] ?? null),
            ],
        ]);

        return back()->with('success', 'Device dapur berhasil diperbarui.');
    }

    private function operationalSettingsPayload(?int $outletId): array
    {
        return [
            'outlet_id' => $outletId,
            'is_open' => Setting::getBool('daily_store_open', true, $outletId),
            'open_time' => (string) Setting::get('daily_store_open_time', '08:00', $outletId),
            'close_time' => (string) Setting::get('daily_store_close_time', '22:00', $outletId),
            'notes' => (string) Setting::get('daily_store_notes', '', $outletId),
        ];
    }

    public function testDevice(KitchenStationDevice $device)
    {
        $meta = $device->meta ?? [];
        $profile = $meta['print_profile'] ?? $this->defaultPrintProfile($device->connection_driver, $device->device_type);
        $meta['last_test'] = [
            'type' => 'print',
            'status' => 'ok',
            'message' => $this->testMessage($device, $profile),
            'tested_at' => now()->toDateTimeString(),
        ];

        $device->update(['meta' => $meta]);

        return back()->with('success', 'Test device berhasil dicatat.');
    }

    public function healthCheckDevice(KitchenStationDevice $device)
    {
        $meta = $device->meta ?? [];
        $profile = $meta['print_profile'] ?? $this->defaultPrintProfile($device->connection_driver, $device->device_type);
        $status = 'warning';
        $message = 'Device aktif, tetapi endpoint atau profile print belum lengkap.';

        if (! $device->is_active) {
            $status = 'inactive';
            $message = 'Device nonaktif. Aktifkan dulu sebelum dipakai.';
        } elseif ($profile === KitchenStationDevice::PRINT_PROFILE_BROWSER || $device->connection_driver === 'browser') {
            $status = 'ok';
            $message = 'Mode browser manual siap dipakai. Cocok untuk preview atau print dialog biasa.';
        } elseif ($profile === KitchenStationDevice::PRINT_PROFILE_RAWBT) {
            $status = filled($device->endpoint) ? 'ok' : 'warning';
            $message = filled($device->endpoint)
                ? 'Profile RawBT siap. Pastikan Android sudah terpasang RawBT dan printer Bluetooth sudah dipair.'
                : 'Profile RawBT dipilih. Isi endpoint atau petunjuk intent RawBT untuk device ini.';
        } elseif ($profile === KitchenStationDevice::PRINT_PROFILE_QZ_TRAY) {
            $status = filled($device->endpoint) ? 'ok' : 'warning';
            $message = filled($device->endpoint)
                ? 'Profile QZ Tray siap. Pastikan client desktop sudah memasang QZ Tray dan printer tersedia.'
                : 'Profile QZ Tray dipilih. Isi nama printer atau queue yang akan dipakai oleh QZ Tray.';
        } elseif ($profile === KitchenStationDevice::PRINT_PROFILE_BRIDGE) {
            $status = filled($device->endpoint) ? 'ok' : 'warning';
            $message = filled($device->endpoint)
                ? 'Profile local bridge siap. Endpoint dapat dipakai agent printer lokal atau network bridge.'
                : 'Profile local bridge dipilih. Isi endpoint device atau queue bridge.';
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

    public function toggleDevice(KitchenStationDevice $device)
    {
        $nextStatus = ! $device->is_active;

        if ($nextStatus && $device->is_primary) {
            KitchenStationDevice::query()
                ->where('kitchen_station_id', $device->kitchen_station_id)
                ->whereKeyNot($device->id)
                ->update(['is_primary' => false]);
        }

        $device->update([
            'is_active' => $nextStatus,
        ]);

        return back()->with('success', $nextStatus ? 'Device berhasil diaktifkan.' : 'Device berhasil dinonaktifkan.');
    }

    private function defaultPrintProfile(string $connectionDriver, string $deviceType): string
    {
        if ($deviceType !== 'printer') {
            return KitchenStationDevice::PRINT_PROFILE_BROWSER;
        }

        return match ($connectionDriver) {
            'usb', 'network', 'cloud' => KitchenStationDevice::PRINT_PROFILE_BRIDGE,
            default => KitchenStationDevice::PRINT_PROFILE_BROWSER,
        };
    }

    private function testMessage(KitchenStationDevice $device, string $profile): string
    {
        if ($device->device_type !== 'printer') {
            return 'Test device dummy ditandai berhasil.';
        }

        return match ($profile) {
            KitchenStationDevice::PRINT_PROFILE_RAWBT => 'Test profile RawBT dicatat. Lanjutkan uji dari browser Android ke aplikasi RawBT.',
            KitchenStationDevice::PRINT_PROFILE_QZ_TRAY => 'Test profile QZ Tray dicatat. Lanjutkan uji print langsung dari browser desktop yang sudah memasang QZ Tray.',
            KitchenStationDevice::PRINT_PROFILE_BRIDGE => 'Test profile local bridge dicatat. Lanjutkan uji pull/ack dari printer agent lokal.',
            default => 'Test print dummy ditandai berhasil. Lanjutkan integrasi printer fisik di endpoint device.',
        };
    }

    private function ensureFallbackDeviceBelongsToStation(KitchenStation $station, ?int $fallbackDeviceId = null, ?int $currentDeviceId = null): void
    {
        if (! $fallbackDeviceId) {
            return;
        }

        abort_if($currentDeviceId && $fallbackDeviceId === $currentDeviceId, 422, 'Fallback device tidak boleh sama dengan device utama.');

        $exists = KitchenStationDevice::query()
            ->where('kitchen_station_id', $station->id)
            ->whereKey($fallbackDeviceId)
            ->exists();

        abort_if(! $exists, 422, 'Fallback device harus berasal dari station yang sama.');
    }

    private function stationPayload(KitchenStation $station, Collection $latestDeviceJobs): array
    {
        $devices = $station->devices->map(function (KitchenStationDevice $device) use ($latestDeviceJobs) {
            $latestJob = $latestDeviceJobs->get($device->id);
            $operationalStatus = $this->deviceOperationalStatus($device, $latestJob);

            return [
                ...$device->toArray(),
                'operational_status' => $operationalStatus,
                'latest_print_job' => $latestJob ? [
                    'id' => $latestJob->id,
                    'status' => $latestJob->status,
                    'queued_at' => optional($latestJob->queued_at)->toIso8601String(),
                    'processed_at' => optional($latestJob->processed_at)->toIso8601String(),
                    'failed_at' => optional($latestJob->failed_at)->toIso8601String(),
                    'failure_reason' => $latestJob->failure_reason,
                ] : null,
            ];
        })->values();

        $issueCount = $devices->filter(fn (array $device) => (bool) data_get($device, 'operational_status.is_issue'))->count();

        return [
            ...$station->toArray(),
            'devices' => $devices,
            'shortcut_urls' => [
                'entry_url' => route('kitchen.entry', ['stationSlug' => $station->slug]),
                'kiosk_url' => route('kitchen.entry', ['stationSlug' => $station->slug, 'kiosk' => 1]),
                'queue_url' => route('kitchen.show', ['stationSlug' => $station->slug]),
                'login_url' => route('kitchen.login', ['station' => $station->slug]),
                'access_sheet_url' => route('settings.kitchen-stations.access-sheet', ['station' => $station->id]),
            ],
            'operational_summary' => [
                'devices_count' => $devices->count(),
                'issue_count' => $issueCount,
                'healthy_count' => max(0, $devices->count() - $issueCount),
            ],
        ];
    }

    private function deviceOperationalStatus(KitchenStationDevice $device, ?PrintJob $latestJob = null): array
    {
        if (! $device->is_active) {
            return [
                'key' => 'offline',
                'label' => 'Nonaktif',
                'is_issue' => true,
                'tone' => 'amber',
                'message' => 'Device dinonaktifkan dari admin.',
            ];
        }

        if ($latestJob?->status === PrintJob::STATUS_FAILED) {
            return [
                'key' => 'failed',
                'label' => 'Gagal',
                'is_issue' => true,
                'tone' => 'rose',
                'message' => $latestJob->failure_reason ?: 'Print job terakhir gagal.',
            ];
        }

        if ($latestJob?->status === PrintJob::STATUS_PROCESSING) {
            return [
                'key' => 'processing',
                'label' => 'Processing',
                'is_issue' => false,
                'tone' => 'blue',
                'message' => 'Sedang memproses antrian print.',
            ];
        }

        if ($latestJob?->status === PrintJob::STATUS_QUEUED) {
            return [
                'key' => 'queued',
                'label' => 'Queued',
                'is_issue' => false,
                'tone' => 'amber',
                'message' => 'Ada antrian print yang belum selesai.',
            ];
        }

        $healthStatus = data_get($device->meta, 'last_health_check.status');
        if (in_array($healthStatus, ['warning', 'inactive'], true)) {
            return [
                'key' => 'warning',
                'label' => 'Perlu Cek',
                'is_issue' => true,
                'tone' => 'amber',
                'message' => data_get($device->meta, 'last_health_check.message', 'Perlu verifikasi printer atau koneksi.'),
            ];
        }

        return [
            'key' => 'ready',
            'label' => 'Siap',
            'is_issue' => false,
            'tone' => 'emerald',
            'message' => 'Device siap dipakai untuk operasional.',
        ];
    }
}
