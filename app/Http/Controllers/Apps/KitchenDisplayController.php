<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\KitchenTicket;
use App\Services\OutletResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class KitchenDisplayController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');

        $stations = KitchenStation::query()
            ->with(['devices' => fn ($query) => $query->where('is_active', true)->orderByDesc('is_primary')->orderBy('name')])
            ->where('outlet_id', $outlet->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $activeStation = $stations->first();
        $statusFilter = $this->statusFilter($request);
        $selectedDevice = $activeStation ? $this->resolveDevice($activeStation, $request->integer('device_id')) : null;

        return Inertia::render('Dashboard/Kitchen/Index', [
            'stations' => $stations->map(fn (KitchenStation $station) => $this->stationPayload($station))->values(),
            'activeStation' => $activeStation ? $this->stationPayload($activeStation) : null,
            'tickets' => $activeStation ? $this->ticketPayloads($activeStation, $statusFilter) : [],
            'refreshMeta' => $this->refreshMeta(),
            'filters' => [
                'status' => $statusFilter,
                'device_id' => $selectedDevice?->id,
            ],
            'selectedDevice' => $selectedDevice ? $this->devicePayload($selectedDevice) : null,
            'boardMode' => [
                'device_type' => $selectedDevice?->device_type ?? ($activeStation?->display_mode ?? 'screen'),
                'interactive' => ($selectedDevice?->device_type ?? 'screen') !== 'printer',
            ],
        ]);
    }

    public function show(Request $request, string $stationSlug)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404);

        $stations = KitchenStation::query()
            ->with(['devices' => fn ($query) => $query->where('is_active', true)->orderByDesc('is_primary')->orderBy('name')])
            ->where('outlet_id', $outlet->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
        $kitchenStation = $stations->firstWhere('slug', $stationSlug);
        abort_if(! $kitchenStation, 404);
        $statusFilter = $this->statusFilter($request);
        $selectedDevice = $this->resolveDevice($kitchenStation, $request->integer('device_id'));

        return Inertia::render('Dashboard/Kitchen/Index', [
            'stations' => $stations->map(fn (KitchenStation $station) => $this->stationPayload($station))->values(),
            'activeStation' => $this->stationPayload($kitchenStation),
            'tickets' => $this->ticketPayloads($kitchenStation, $statusFilter),
            'refreshMeta' => $this->refreshMeta(),
            'filters' => [
                'status' => $statusFilter,
                'device_id' => $selectedDevice?->id,
            ],
            'selectedDevice' => $selectedDevice ? $this->devicePayload($selectedDevice) : null,
            'boardMode' => [
                'device_type' => $selectedDevice?->device_type ?? $kitchenStation->display_mode,
                'interactive' => ($selectedDevice?->device_type ?? 'screen') !== 'printer',
            ],
        ]);
    }

    public function feed(Request $request, string $stationSlug): JsonResponse
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404);

        $station = KitchenStation::query()
            ->with(['devices' => fn ($query) => $query->where('is_active', true)->orderByDesc('is_primary')->orderBy('name')])
            ->where('outlet_id', $outlet->id)
            ->where('slug', $stationSlug)
            ->where('is_active', true)
            ->firstOrFail();
        $statusFilter = $this->statusFilter($request);
        $selectedDevice = $this->resolveDevice($station, $request->integer('device_id'));

        return response()->json([
            'activeStation' => $this->stationPayload($station),
            'tickets' => $this->ticketPayloads($station, $statusFilter),
            'refreshMeta' => $this->refreshMeta(),
            'filters' => [
                'status' => $statusFilter,
                'device_id' => $selectedDevice?->id,
            ],
            'selectedDevice' => $selectedDevice ? $this->devicePayload($selectedDevice) : null,
            'boardMode' => [
                'device_type' => $selectedDevice?->device_type ?? $station->display_mode,
                'interactive' => ($selectedDevice?->device_type ?? 'screen') !== 'printer',
            ],
        ]);
    }

    public function acknowledge(Request $request, KitchenTicket $kitchenTicket): RedirectResponse
    {
        $this->ensureKitchenAccess($request, $kitchenTicket);

        $kitchenTicket->forceFill([
            'status' => 'acknowledged',
            'acknowledged_at' => $kitchenTicket->acknowledged_at ?? now(),
        ])->save();

        $kitchenTicket->items()->where('status', 'pending')->update([
            'status' => 'acknowledged',
        ]);

        $kitchenTicket->events()->create([
            'user_id' => $request->user()?->id,
            'event' => 'ticket.acknowledged',
            'payload' => [
                'station_id' => $kitchenTicket->kitchen_station_id,
            ],
            'created_at' => now(),
        ]);

        return back()->with('success', 'Ticket dapur diambil oleh station.');
    }

    public function complete(Request $request, KitchenTicket $kitchenTicket): RedirectResponse
    {
        $this->ensureKitchenAccess($request, $kitchenTicket);

        $kitchenTicket->forceFill([
            'status' => 'completed',
            'acknowledged_at' => $kitchenTicket->acknowledged_at ?? now(),
            'completed_at' => now(),
        ])->save();

        $kitchenTicket->items()->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        $kitchenTicket->events()->create([
            'user_id' => $request->user()?->id,
            'event' => 'ticket.completed',
            'payload' => [
                'station_id' => $kitchenTicket->kitchen_station_id,
            ],
            'created_at' => now(),
        ]);

        return back()->with('success', 'Ticket dapur selesai.');
    }

    public function dispatch(Request $request, KitchenTicket $kitchenTicket): RedirectResponse|JsonResponse
    {
        $this->ensureKitchenAccess($request, $kitchenTicket);

        $validated = $request->validate([
            'device_id' => ['required', 'integer'],
        ]);

        $device = KitchenStationDevice::query()
            ->where('kitchen_station_id', $kitchenTicket->kitchen_station_id)
            ->where('is_active', true)
            ->findOrFail($validated['device_id']);

        $event = $kitchenTicket->events()->create([
            'user_id' => $request->user()?->id,
            'event' => 'ticket.dispatched',
            'payload' => [
                'station_id' => $kitchenTicket->kitchen_station_id,
                'device_id' => $device->id,
                'device_name' => $device->name,
                'device_type' => $device->device_type,
                'connection_driver' => $device->connection_driver,
                'endpoint' => $device->endpoint,
            ],
            'created_at' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Ticket berhasil didispatch ke device dapur.',
                'event_id' => $event->id,
            ]);
        }

        return back()->with('success', 'Ticket berhasil didispatch ke device dapur.');
    }

    private function ensureKitchenAccess(Request $request, KitchenTicket $kitchenTicket): void
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet || (int) $kitchenTicket->outlet_id !== (int) $outlet->id, 404);
    }

    private function stationPayload(KitchenStation $station): array
    {
        $pendingCount = $station->kitchenTickets()->where('status', 'pending')->count();
        $acknowledgedCount = $station->kitchenTickets()->where('status', 'acknowledged')->count();

        return [
            'id' => $station->id,
            'name' => $station->name,
            'slug' => $station->slug,
            'code' => $station->code,
            'display_mode' => $station->display_mode,
            'station_type' => $station->station_type,
            'pending_count' => $pendingCount,
            'acknowledged_count' => $acknowledgedCount,
            'devices' => $station->devices->map(fn ($device) => [
                ...$this->devicePayload($device),
            ])->values(),
        ];
    }

    private function ticketPayloads(KitchenStation $station, string $statusFilter = 'active'): array
    {
        $query = KitchenTicket::query()
            ->with(['transaction.customer:id,name', 'items'])
            ->where('outlet_id', $station->outlet_id)
            ->where('kitchen_station_id', $station->id)
            ->latest('fired_at')
            ->limit(50);

        match ($statusFilter) {
            'pending' => $query->where('status', 'pending'),
            'acknowledged' => $query->where('status', 'acknowledged'),
            default => $query->whereIn('status', ['pending', 'acknowledged']),
        };

        return $query
            ->get()
            ->map(function (KitchenTicket $ticket) {
                $latestDispatchEvent = $ticket->events()
                    ->where('event', 'ticket.dispatched')
                    ->latest('created_at')
                    ->first();

                return [
                    'id' => $ticket->id,
                    'ticket_number' => $ticket->ticket_number,
                    'status' => $ticket->status,
                    'fired_at' => optional($ticket->fired_at)?->toIso8601String(),
                    'acknowledged_at' => optional($ticket->acknowledged_at)?->toIso8601String(),
                    'invoice' => $ticket->transaction?->invoice,
                    'customer_name' => $ticket->transaction?->customer?->name,
                    'notes' => $ticket->notes,
                    'dispatch' => $latestDispatchEvent ? [
                        'dispatched_at' => optional($latestDispatchEvent->created_at)?->toIso8601String(),
                        'device_id' => data_get($latestDispatchEvent->payload, 'device_id'),
                        'device_name' => data_get($latestDispatchEvent->payload, 'device_name'),
                        'device_type' => data_get($latestDispatchEvent->payload, 'device_type'),
                    ] : null,
                    'items' => $ticket->items->map(fn ($item) => [
                        'id' => $item->id,
                        'product_title' => $item->product_title,
                        'qty' => (int) $item->qty,
                        'status' => $item->status,
                        'notes' => $item->notes,
                    ])->values(),
                ];
            })
            ->values()
            ->all();
    }

    private function statusFilter(Request $request): string
    {
        return match ((string) $request->query('status', 'active')) {
            'pending' => 'pending',
            'acknowledged' => 'acknowledged',
            default => 'active',
        };
    }

    private function refreshMeta(): array
    {
        return [
            'polled_at' => now()->toIso8601String(),
            'interval_seconds' => 15,
        ];
    }

    private function resolveDevice(KitchenStation $station, ?int $deviceId = null): ?KitchenStationDevice
    {
        if ($deviceId) {
            $matchedDevice = $station->devices->firstWhere('id', $deviceId);

            if ($matchedDevice instanceof KitchenStationDevice) {
                return $matchedDevice;
            }
        }

        return $station->devices->firstWhere('is_primary', true) ?? $station->devices->first();
    }

    private function devicePayload(KitchenStationDevice $device): array
    {
        return [
            'id' => $device->id,
            'name' => $device->name,
            'device_type' => $device->device_type,
            'connection_driver' => $device->connection_driver,
            'endpoint' => $device->endpoint,
            'is_primary' => (bool) $device->is_primary,
            'is_active' => (bool) $device->is_active,
        ];
    }
}
