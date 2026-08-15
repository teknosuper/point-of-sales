<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\KitchenSoundConfig;
use App\Models\KitchenTicket;
use App\Models\KitchenTicketEvent;
use App\Models\TransactionTenantAllocationItem;
use App\Models\Outlet;
use App\Models\ProductKitchenStationMapping;
use App\Models\TransactionTenantAllocation;
use App\Services\OutletResolver;
use App\Services\PrintJobService;
use App\Services\WaiterFulfillmentService;
use App\Support\ReportTimezone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;

class KitchenDisplayController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver,
        private readonly PrintJobService $printJobService,
        private readonly WaiterFulfillmentService $waiterFulfillmentService
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404, 'Outlet aktif tidak ditemukan.');
        $kioskMode = $request->boolean('kiosk');
        $filters = $this->filtersPayload($request);
        $stations = $this->visibleStations($request, $outlet);
        $stations->each(fn (KitchenStation $station) => $this->autoCompleteDeliveredTickets($station, $request->user()?->id));

        $activeStation = $this->resolveDefaultActiveStation($request, $outlet, $stations, $kioskMode);
        $this->autoAcknowledgePendingTickets($activeStation, $request->user()?->id);
        $selectedDevice = $activeStation ? $this->resolveDevice($activeStation, $request->integer('device_id')) : null;

        return Inertia::render('Dashboard/Kitchen/Index', [
            'stations' => $stations->map(fn (KitchenStation $station) => $this->stationPayload($station))->values(),
            'activeStation' => $activeStation ? $this->stationPayload($activeStation) : null,
            'tickets' => $activeStation ? $this->ticketPayloads($activeStation, $filters) : $this->emptyTicketPayload(),
            'refreshMeta' => $this->refreshMeta(),
            'printClient' => $this->printClientPayload($outlet),
            'kioskMode' => $kioskMode,
            'filters' => [
                ...$filters,
                'device_id' => $selectedDevice?->id,
            ],
            'selectedDevice' => $selectedDevice ? $this->devicePayload($selectedDevice) : null,
            'boardMode' => [
                'device_type' => $selectedDevice?->device_type ?? ($activeStation?->display_mode ?? 'screen'),
                'interactive' => ($selectedDevice?->device_type ?? 'screen') !== 'printer',
            ],
            'soundConfigs' => KitchenSoundConfig::all()
                ->map(fn ($c) => [
                    'event_type' => $c->event_type,
                    'interval_seconds' => $c->interval_seconds,
                    'is_enabled' => $c->is_enabled,
                ]),
        ]);
    }

    public function entry(Request $request, string $stationSlug): RedirectResponse
    {
        $station = KitchenStation::query()
            ->where('slug', $stationSlug)
            ->where('is_active', true)
            ->firstOrFail();
        $kioskMode = $request->boolean('kiosk');

        if (! $request->user()) {
            $request->session()->put('active_outlet_id', (int) $station->outlet_id);
            $request->session()->put('url.intended', route('kitchen.show', [
                'stationSlug' => $station->slug,
                'kiosk' => $kioskMode ? 1 : null,
            ], absolute: false));

            return redirect()->guest(route('kitchen.login', [
                'station' => $station->slug,
                'kiosk' => $kioskMode ? 1 : null,
            ]));
        }

        abort_unless($request->user()->hasAccessToOutlet((int) $station->outlet_id), 403);

        $request->session()->put('active_outlet_id', (int) $station->outlet_id);

        return redirect()->route('kitchen.show', [
            'stationSlug' => $station->slug,
            'kiosk' => $kioskMode ? 1 : null,
        ]);
    }

    public function show(Request $request, string $stationSlug)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404);
        $kioskMode = $request->boolean('kiosk');
        $filters = $this->filtersPayload($request);
        $stations = $this->visibleStations($request, $outlet);
        $stations->each(fn (KitchenStation $station) => $this->autoCompleteDeliveredTickets($station, $request->user()?->id));
        $kitchenStation = $stations->firstWhere('slug', $stationSlug);
        abort_if(! $kitchenStation, 404);
        $this->autoAcknowledgePendingTickets($kitchenStation, $request->user()?->id);
        $selectedDevice = $this->resolveDevice($kitchenStation, $request->integer('device_id'));

        return Inertia::render('Dashboard/Kitchen/Index', [
            'stations' => $stations->map(fn (KitchenStation $station) => $this->stationPayload($station))->values(),
            'activeStation' => $this->stationPayload($kitchenStation),
            'tickets' => $this->ticketPayloads($kitchenStation, $filters),
            'refreshMeta' => $this->refreshMeta(),
            'printClient' => $this->printClientPayload($outlet),
            'kioskMode' => $kioskMode,
            'filters' => [
                ...$filters,
                'device_id' => $selectedDevice?->id,
            ],
            'selectedDevice' => $selectedDevice ? $this->devicePayload($selectedDevice) : null,
            'boardMode' => [
                'device_type' => $selectedDevice?->device_type ?? $kitchenStation->display_mode,
                'interactive' => ($selectedDevice?->device_type ?? 'screen') !== 'printer',
            ],
            'soundConfigs' => KitchenSoundConfig::all()
                ->map(fn ($c) => [
                    'event_type' => $c->event_type,
                    'interval_seconds' => $c->interval_seconds,
                    'is_enabled' => $c->is_enabled,
                ]),
        ]);
    }

    public function feed(Request $request, string $stationSlug): JsonResponse
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404);
        $filters = $this->filtersPayload($request);
        $station = $this->visibleStations($request, $outlet)->firstWhere('slug', $stationSlug);
        abort_if(! $station, 404);
        $this->autoCompleteDeliveredTickets($station, $request->user()?->id);

        $preferredStationId = $request->user()?->preferred_kitchen_station_id;
        abort_if(
            $request->user()?->isKitchenWorkspace()
            && $preferredStationId
            && (int) $preferredStationId !== (int) $station->id,
            404
        );
        $this->autoAcknowledgePendingTickets($station, $request->user()?->id);

        $selectedDevice = $this->resolveDevice($station, $request->integer('device_id'));

        return response()->json([
            'activeStation' => $this->stationPayload($station),
            'tickets' => $this->ticketPayloads($station, $filters),
            'refreshMeta' => $this->refreshMeta(),
            'printClient' => $this->printClientPayload($outlet),
            'filters' => [
                ...$filters,
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

        $validated = $request->validate([
            'item_ids' => ['nullable', 'array'],
            'item_ids.*' => ['integer'],
        ]);

        $selectedItemIds = collect($validated['item_ids'] ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();

        $itemsQuery = $kitchenTicket->items()
            ->whereIn('status', ['pending', 'acknowledged']);

        if ($selectedItemIds->isNotEmpty()) {
            $itemsQuery->whereIn('id', $selectedItemIds->all());
        }

        $itemsToComplete = $itemsQuery->get();
        $itemsToComplete = $this->filterReturnedKitchenTicketItems($itemsToComplete);

        if ($itemsToComplete->isEmpty()) {
            return back()->with('success', 'Tidak ada item baru yang perlu ditandai siap.');
        }

        $timestamp = now();

        foreach ($itemsToComplete as $item) {
            $item->forceFill([
                'status' => 'completed',
                'completed_at' => $timestamp,
            ])->save();
        }

        $detailIds = $itemsToComplete
            ->pluck('transaction_detail_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $this->waiterFulfillmentService->markAllocationItemsReadyByDetailIds($detailIds);

        $remainingOpenItems = $kitchenTicket->items()
            ->get()
            ->pipe(fn (Collection $items) => $this->filterReturnedKitchenTicketItems(
                $items->whereIn('status', ['pending', 'acknowledged'])->values()
            ))
            ->count();

        $kitchenTicket->forceFill([
            'status' => $remainingOpenItems === 0 ? 'ready' : 'acknowledged',
            'acknowledged_at' => $kitchenTicket->acknowledged_at ?? $timestamp,
            'ready_at' => $remainingOpenItems === 0
                ? ($kitchenTicket->ready_at ?? $timestamp)
                : $kitchenTicket->ready_at,
        ])->save();

        $kitchenTicket->events()->create([
            'user_id' => $request->user()?->id,
            'event' => $remainingOpenItems === 0 ? 'ticket.ready' : 'ticket.partial_ready',
            'payload' => [
                'station_id' => $kitchenTicket->kitchen_station_id,
                'item_ids' => $itemsToComplete->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
            ],
            'created_at' => $timestamp,
        ]);

        TransactionTenantAllocation::query()
            ->where('transaction_id', $kitchenTicket->transaction_id)
            ->whereIn(
                'tenant_outlet_id',
                $kitchenTicket->items()
                    ->with('transactionDetail:id,tenant_outlet_id')
                    ->get()
                    ->pluck('transactionDetail.tenant_outlet_id')
                    ->filter()
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values()
                    ->all()
            )
            ->update([
                'kitchen_status' => 'completed',
            ]);

        return back()->with('success', $remainingOpenItems === 0
            ? 'Ticket dapur siap diantar / diambil.'
            : 'Sebagian item ditandai siap diantar / diambil.');
    }

    public function syncTicketOutlets(Request $request): JsonResponse
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 403, 'Outlet aktif tidak ditemukan.');

        // Repair tickets whose outlet_id doesn't match their station's outlet_id.
        // This happens in foodcourt setups where the transaction belongs to the
        // main outlet but the kitchen station belongs to a tenant outlet.
        $tenantChildIds = \App\Models\Outlet::query()
            ->where('parent_outlet_id', $outlet->id)
            ->pluck('id');

        $tickets = KitchenTicket::query()
            ->join('kitchen_stations', 'kitchen_stations.id', '=', 'kitchen_tickets.kitchen_station_id')
            ->whereColumn('kitchen_tickets.outlet_id', '!=', 'kitchen_stations.outlet_id')
            ->where(function ($q) use ($outlet, $tenantChildIds) {
                $q->where('kitchen_stations.outlet_id', $outlet->id)
                  ->orWhereIn('kitchen_stations.outlet_id', $tenantChildIds);
            })
            ->select('kitchen_tickets.id', 'kitchen_stations.outlet_id as correct_outlet_id')
            ->get();

        $fixed = 0;
        foreach ($tickets as $ticket) {
            KitchenTicket::where('id', $ticket->id)
                ->update(['outlet_id' => $ticket->correct_outlet_id]);
            $fixed++;
        }

        return response()->json([
            'success' => true,
            'fixed'   => $fixed,
            'message' => $fixed > 0
                ? "{$fixed} tiket berhasil disinkronisasi outlet-nya."
                : 'Semua tiket sudah sinkron, tidak ada yang perlu diperbaiki.',
        ]);
    }

    public function deliver(Request $request, KitchenTicket $kitchenTicket): RedirectResponse
    {
        $this->ensureKitchenAccess($request, $kitchenTicket);

        $validated = $request->validate([
            'item_ids' => ['nullable', 'array'],
            'item_ids.*' => ['integer'],
        ]);

        $selectedItemIds = collect($validated['item_ids'] ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();

        $itemsQuery = $kitchenTicket->items()
            ->whereIn('status', ['pending', 'acknowledged', 'completed']);

        if ($selectedItemIds->isNotEmpty()) {
            $itemsQuery->whereIn('id', $selectedItemIds->all());
        }

        $itemsToDeliver = $itemsQuery->get();
        $itemsToDeliver = $this->filterReturnedKitchenTicketItems($itemsToDeliver);

        if ($itemsToDeliver->isEmpty()) {
            return back()->with('success', 'Tidak ada item yang bisa langsung ditandai diserahkan.');
        }

        $timestamp = now();

        foreach ($itemsToDeliver as $item) {
            if ($item->status !== 'completed') {
                $item->forceFill([
                    'status' => 'completed',
                    'completed_at' => $item->completed_at ?? $timestamp,
                ])->save();
            }
        }

        $detailIds = $itemsToDeliver
            ->pluck('transaction_detail_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->values();

        $this->waiterFulfillmentService->markAllocationItemsDeliveredByDetailIds(
            $detailIds->all(),
            $request->user()?->id
        );

        $ticketDetailIds = $kitchenTicket->items()
            ->get()
            ->pipe(fn (Collection $items) => $this->filterReturnedKitchenTicketItems($items))
            ->pluck('transaction_detail_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->values();

        $deliveredDetailIds = TransactionTenantAllocationItem::query()
            ->whereIn('transaction_detail_id', $ticketDetailIds->all())
            ->where('service_status', 'delivered')
            ->pluck('transaction_detail_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $allDelivered = $ticketDetailIds->isNotEmpty()
            && $ticketDetailIds->every(fn (int $detailId) => $deliveredDetailIds->contains($detailId));

        $kitchenTicket->forceFill([
            'status' => $allDelivered ? 'completed' : 'ready',
            'ready_at' => $kitchenTicket->ready_at ?? $timestamp,
            'completed_at' => $allDelivered ? $timestamp : null,
        ])->save();

        $kitchenTicket->events()->create([
            'user_id' => $request->user()?->id,
            'event' => $allDelivered ? 'ticket.delivered_direct' : 'ticket.partial_delivered',
            'payload' => [
                'station_id' => $kitchenTicket->kitchen_station_id,
                'delivered_by' => 'kitchen',
                'item_ids' => $itemsToDeliver->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
            ],
            'created_at' => $timestamp,
        ]);

        return back()->with('success', $allDelivered
            ? 'Pesanan ditandai sudah diambil / diserahkan.'
            : 'Sebagian item ditandai sudah diambil / diserahkan.');
    }

    public function dispatch(Request $request, KitchenTicket $kitchenTicket): RedirectResponse|JsonResponse
    {
        return $this->recordDispatchEvent($request, $kitchenTicket, 'ticket.dispatched', 'Ticket berhasil didispatch ke device dapur.');
    }

    public function queueDispatch(Request $request, KitchenTicket $kitchenTicket): RedirectResponse|JsonResponse
    {
        [$device] = $this->resolveDispatchDevice($request, $kitchenTicket);
        $printJob = $this->printJobService->queueKitchenTicket($kitchenTicket, $device, $request->user()?->id);

        return $this->recordDispatchEvent(
            $request,
            $kitchenTicket,
            'ticket.dispatch_queued',
            'Ticket berhasil masuk antrian printer.',
            [
                'print_job_id' => $printJob->id,
                'print_job_status' => $printJob->status,
            ]
        );
    }

    public function failDispatch(Request $request, KitchenTicket $kitchenTicket): RedirectResponse|JsonResponse
    {
        $this->ensureKitchenAccess($request, $kitchenTicket);

        [$device, $validated] = $this->resolveDispatchDevice($request, $kitchenTicket, withReason: true);
        $printJob = $this->printJobService->latestQueuedKitchenTicketJob($kitchenTicket->id, $device->id);
        if ($printJob) {
            $this->printJobService->markFailed($printJob, $validated['reason'] ?? null);
        }

        $fallbackDevice = $this->resolveFallbackDevice($device);
        $fallbackPrintJob = null;
        if ($fallbackDevice) {
            $fallbackPrintJob = $this->printJobService->queueKitchenTicket($kitchenTicket, $fallbackDevice, $request->user()?->id);
        }

        $event = $kitchenTicket->events()->create([
            'user_id' => $request->user()?->id,
            'event' => 'ticket.dispatch_failed',
            'payload' => [
                'station_id' => $kitchenTicket->kitchen_station_id,
                'device_id' => $device->id,
                'device_name' => $device->name,
                'device_type' => $device->device_type,
                'connection_driver' => $device->connection_driver,
                'endpoint' => $device->endpoint,
                'print_job_id' => $printJob?->id,
                'print_job_status' => $printJob?->status,
                'reason' => $validated['reason'] ?? 'Dispatch printer ditandai gagal dari board dapur.',
                'fallback_device_id' => $fallbackDevice?->id,
                'fallback_device_name' => $fallbackDevice?->name,
                'fallback_print_job_id' => $fallbackPrintJob?->id,
                'fallback_print_job_status' => $fallbackPrintJob?->status,
            ],
            'created_at' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => $fallbackDevice
                    ? 'Kegagalan dispatch printer dicatat dan fallback printer berhasil masuk antrian.'
                    : 'Kegagalan dispatch printer berhasil dicatat.',
                'event_id' => $event->id,
            ]);
        }

        return back()->with('success', $fallbackDevice
            ? 'Kegagalan dispatch printer dicatat dan fallback printer berhasil masuk antrian.'
            : 'Kegagalan dispatch printer berhasil dicatat.');
    }

    private function ensureKitchenAccess(Request $request, KitchenTicket $kitchenTicket): void
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404);

        $visibleStationIds = $this->visibleStations($request, $outlet)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        abort_if(! in_array((int) $kitchenTicket->kitchen_station_id, $visibleStationIds, true), 404);

        $preferredStationId = $request->user()?->preferred_kitchen_station_id;
        abort_if(
            $request->user()?->isKitchenWorkspace()
            && $preferredStationId
            && (int) $kitchenTicket->kitchen_station_id !== (int) $preferredStationId,
            404
        );
    }

    private function filterStationsForKitchenUser(Request $request, $stations)
    {
        $user = $request->user();
        $preferredStationId = $user?->preferred_kitchen_station_id;

        if (! $user?->isKitchenWorkspace() || ! $preferredStationId) {
            return $stations;
        }

        return $stations
            ->where('id', (int) $preferredStationId)
            ->values();
    }

    /**
     * Tentukan station default untuk halaman index kitchen.
     *
     * Aturan:
     * - Jika user punya preferred_kitchen_station_id dan station itu visible,
     *   pakai station tersebut.
     * - Untuk mode kiosk, fallback ke station pertama (layar dapur khusus).
     * - Untuk outlet main (bukan tenant terkait) tanpa preferensi, kembalikan
     *   null agar frontend menampilkan station picker, bukan memaksa station
     *   dengan sort_order terkecil (misal "Dapur Minuman").
     * - Untuk outlet tenant, hanya ada satu station hasil mapping, aman pakai first().
     */
    private function resolveDefaultActiveStation(Request $request, Outlet $outlet, Collection $stations, bool $kioskMode): ?KitchenStation
    {
        $preferredStationId = $request->user()?->preferred_kitchen_station_id;

        if ($preferredStationId) {
            $preferred = $stations->firstWhere('id', (int) $preferredStationId);

            if ($preferred) {
                return $preferred;
            }
        }

        if ($kioskMode || ($outlet->outlet_type ?? 'main') !== 'main') {
            return $stations->first();
        }

        return null;
    }

    private function visibleStations(Request $request, Outlet $outlet): Collection
    {
        $query = KitchenStation::query()
            ->with(['devices' => fn ($builder) => $builder
                ->where('is_active', true)
                ->orderByDesc('is_primary')
                ->orderBy('name')])
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name');

        if (($outlet->outlet_type ?? 'main') === 'tenant') {
            $mappedStationIds = ProductKitchenStationMapping::query()
                ->join('products', 'products.id', '=', 'product_kitchen_station_mappings.product_id')
                ->where('product_kitchen_station_mappings.is_active', true)
                ->where('products.tenant_outlet_id', $outlet->id)
                ->whereNotNull('product_kitchen_station_mappings.kitchen_station_id')
                ->distinct()
                ->pluck('product_kitchen_station_mappings.kitchen_station_id');

            $stations = $query
                ->whereIn('id', $mappedStationIds)
                ->get();

            return $this->filterStationsForKitchenUser($request, $stations);
        }

        $stations = $query
            ->where('outlet_id', $outlet->id)
            ->get();

        return $this->filterStationsForKitchenUser($request, $stations);
    }

    private function stationPayload(KitchenStation $station): array
    {
        $statusCounts = $this->stationTicketStatusCounts($station);

        return [
            'id' => $station->id,
            'name' => $station->name,
            'slug' => $station->slug,
            'code' => $station->code,
            'display_mode' => $station->display_mode,
            'processing_mode' => $station->processing_mode ?: 'auto',
            'station_type' => $station->station_type,
            'pending_count' => (int) ($statusCounts['pending'] ?? 0),
            'acknowledged_count' => (int) ($statusCounts['acknowledged'] ?? 0),
            'ready_count' => (int) ($statusCounts['ready'] ?? 0),
            'completed_count' => (int) ($statusCounts['completed'] ?? 0),
            'returned_count' => (int) ($statusCounts['returned'] ?? 0),
            'devices' => $station->devices->map(fn ($device) => [
                ...$this->devicePayload($device),
            ])->values(),
        ];
    }

    private function ticketPayloads(KitchenStation $station, array $filters): array
    {
        $statusFilter = $filters['status'] ?? 'active';
        $search = trim((string) ($filters['q'] ?? ''));
        $perPage = (int) ($filters['per_page'] ?? 15);
        $sort = ($filters['sort'] ?? 'oldest') === 'newest' ? 'newest' : 'oldest';

        $query = KitchenTicket::query()
            ->with([
                'transaction:id,invoice,customer_id,order_type,order_reference_name,order_reference_notes,table_id',
                'transaction.customer:id,name,no_telp',
                'transaction.diningTable:id,name,code',
                'items',
                'printJobs:id,kitchen_ticket_id,outlet_id,status,copies,queued_at,processing_at,processed_at,failed_at',
                'printJobs.outlet:id,name,code,outlet_type',
            ])
            ->where('outlet_id', $station->outlet_id)
            ->where('kitchen_station_id', $station->id);

        match ($statusFilter) {
            'pending' => $query->where('status', 'pending')->whereHas('items'),
            'acknowledged' => $query->where('status', 'acknowledged')->whereHas('items'),
            'ready' => $query->where('status', 'ready')->whereHas('items'),
            'completed' => $query->where('status', 'completed')->whereHas('items'),
            'returned' => $query->whereHas('events', fn ($builder) => $builder->whereIn('event', ['ticket.returned_partial', 'ticket.returned_full'])),
            default => $query->whereIn('status', ['pending', 'acknowledged', 'ready'])->whereHas('items'),
        };

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('ticket_number', 'like', "%{$search}%")
                    ->orWhereHas('transaction', function ($transactionQuery) use ($search) {
                        $transactionQuery
                            ->where('invoice', 'like', "%{$search}%")
                            ->orWhereHas('customer', fn ($customerQuery) => $customerQuery->where('name', 'like', "%{$search}%"));
                    })
                    ->orWhereHas('items', function ($itemQuery) use ($search) {
                        $itemQuery
                            ->where('product_title', 'like', "%{$search}%")
                            ->orWhere('notes', 'like', "%{$search}%");
                    });
            });
        }

        if ($sort === 'newest') {
            $query->orderByDesc('fired_at')->orderByDesc('id');
        } else {
            $query->orderBy('fired_at')->orderBy('id');
        }

        $paginator = $query->paginate($perPage);
        $tickets = $paginator->getCollection()->values();
        $ticketMaps = $this->kitchenBoardMaps($tickets);
        $ticketPayloads = $tickets
            ->map(fn (KitchenTicket $ticket) => $this->transformKitchenTicketPayload(
                $ticket,
                $ticketMaps['service_status_map'],
                $ticketMaps['latest_dispatch_event_map'],
                $ticketMaps['latest_return_event_map'],
                $ticketMaps['latest_customer_alert_event_map'],
                $statusFilter
            ))
            ->values();
        $paginator->setCollection($ticketPayloads);

        return [
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }

    private function transformKitchenTicketPayload(
        KitchenTicket $ticket,
        Collection $serviceStatusMap,
        Collection $latestDispatchEventMap,
        Collection $latestReturnEventMap,
        Collection $latestCustomerAlertEventMap,
        string $statusFilter = 'active'
    ): array
    {
        /** @var KitchenTicketEvent|null $latestReturnEvent */
        $latestReturnEvent = $latestReturnEventMap->get((int) $ticket->id);
        $returnedSnapshotItems = collect(data_get($latestReturnEvent?->payload, 'items', []))
            ->map(function ($item) {
                return [
                    'id' => (int) data_get($item, 'kitchen_ticket_item_id', 0),
                    'transaction_detail_id' => (int) data_get($item, 'transaction_detail_id', 0),
                    'product_title' => (string) data_get($item, 'product_title', 'Produk'),
                    'status' => 'returned',
                    'notes' => null,
                    'completed_at' => null,
                    'service_status' => 'returned',
                    'resolved_service_status' => 'returned',
                    'ready_at' => null,
                    'picked_up_at' => null,
                    'delivered_at' => null,
                    'original_qty' => (int) data_get($item, 'original_qty', 0),
                    'remaining_qty' => (int) data_get($item, 'remaining_qty', 0),
                    'returned_qty' => (int) data_get($item, 'cumulative_returned_qty', data_get($item, 'returned_qty', 0)),
                    'has_partial_return' => (int) data_get($item, 'remaining_qty', 0) > 0,
                    'is_returned' => true,
                    'qty' => (int) data_get($item, 'cumulative_returned_qty', data_get($item, 'returned_qty', 0)),
                ];
            })
            ->filter(fn (array $item) => (int) $item['returned_qty'] > 0)
            ->values();

        $activeItems = $ticket->items->map(function ($item) use ($serviceStatusMap) {
            $remainingQty = max(0, (int) $item->qty);
            $serviceStatus = (($serviceStatusMap->get((int) $item->transaction_detail_id)?->service_status === 'not_required')
                && $item->status === 'completed')
                ? 'ready'
                : (optional($serviceStatusMap->get((int) $item->transaction_detail_id))->service_status
                    ?? ($item->status === 'completed' ? 'ready' : 'pending'));

            return [
                'id' => $item->id,
                'transaction_detail_id' => (int) ($item->transaction_detail_id ?? 0),
                'product_title' => $item->product_title,
                'status' => $item->status,
                'notes' => $item->notes,
                'completed_at' => ReportTimezone::formatSourceIso8601($item->getRawOriginal('completed_at')),
                'service_status' => $serviceStatus,
                'resolved_service_status' => $serviceStatus,
                'ready_at' => ReportTimezone::formatSourceIso8601(optional($serviceStatusMap->get((int) $item->transaction_detail_id))->ready_at),
                'picked_up_at' => ReportTimezone::formatSourceIso8601(optional($serviceStatusMap->get((int) $item->transaction_detail_id))->picked_up_at),
                'delivered_at' => ReportTimezone::formatSourceIso8601(optional($serviceStatusMap->get((int) $item->transaction_detail_id))->delivered_at),
                'original_qty' => $remainingQty,
                'remaining_qty' => $remainingQty,
                'returned_qty' => 0,
                'has_partial_return' => false,
                'is_returned' => false,
                'qty' => $remainingQty,
            ];
        })->values();
        $returnedItems = $returnedSnapshotItems;
        /** @var KitchenTicketEvent|null $latestDispatchEvent */
        $latestDispatchEvent = $latestDispatchEventMap->get((int) $ticket->id);
        /** @var KitchenTicketEvent|null $latestCustomerAlertEvent */
        $latestCustomerAlertEvent = $latestCustomerAlertEventMap->get((int) $ticket->id);
        $printJobs = $ticket->printJobs->sortBy('id')->values();
        $latestPrintJob = $printJobs->last();
        $successfulPrintJobs = $printJobs->where('status', 'success');
        $queuedPrintJobs = $printJobs->whereIn('status', ['queued', 'processing']);
        $failedPrintJobs = $printJobs->where('status', 'failed');
        $printedCopies = (int) $successfulPrintJobs->sum(fn ($job) => max(1, (int) ($job->copies ?? 1)));
        $successfulPrintTimes = $successfulPrintJobs
            ->sortBy('processed_at')
            ->pluck('processed_at')
            ->filter()
            ->map(fn ($value) => ReportTimezone::formatSourceIso8601($value))
            ->values();
        $printStatus = match (true) {
            $queuedPrintJobs->isNotEmpty() && $successfulPrintJobs->isNotEmpty() => 'reprint_queued',
            $queuedPrintJobs->isNotEmpty() => 'queued',
            $latestPrintJob?->status === 'failed' => 'failed',
            $successfulPrintJobs->isNotEmpty() => 'printed',
            default => 'not_printed',
        };

        // Group print jobs by tenant outlet
        $printJobsByTenant = $printJobs
            ->groupBy(fn ($job) => $job->outlet_id)
            ->map(function ($jobs, $outletId) {
                $outlet = $jobs->first()?->outlet;
                $successJobs = $jobs->where('status', 'success');
                $queuedJobs = $jobs->whereIn('status', ['queued', 'processing']);
                $failedJobs = $jobs->where('status', 'failed');
                $latestJob = $jobs->sortByDesc('id')->first();
                
                $status = match (true) {
                    $queuedJobs->isNotEmpty() && $successJobs->isNotEmpty() => 'reprint_queued',
                    $queuedJobs->isNotEmpty() => 'queued',
                    $latestJob?->status === 'failed' => 'failed',
                    $successJobs->isNotEmpty() => 'printed',
                    default => 'not_printed',
                };

                return [
                    'outlet_id' => (int) $outletId,
                    'outlet_name' => $outlet?->name ?? 'Unknown',
                    'outlet_code' => $outlet?->code ?? '',
                    'outlet_type' => $outlet?->outlet_type ?? '',
                    'status' => $status,
                    'total_jobs' => $jobs->count(),
                    'success_jobs' => $successJobs->count(),
                    'failed_jobs' => $failedJobs->count(),
                    'queued_jobs' => $queuedJobs->count(),
                    'printed_copies' => (int) $successJobs->sum(fn ($job) => max(1, (int) ($job->copies ?? 1))),
                    'last_printed_at' => ReportTimezone::formatSourceIso8601($successJobs->sortByDesc('processed_at')->first()?->getRawOriginal('processed_at')),
                    'last_failed_at' => ReportTimezone::formatSourceIso8601($failedJobs->sortByDesc('failed_at')->first()?->getRawOriginal('failed_at')),
                    'last_queued_at' => ReportTimezone::formatSourceIso8601($queuedJobs->sortByDesc('queued_at')->first()?->getRawOriginal('queued_at')),
                ];
            })
            ->values()
            ->all();

        $displayStatusKey = $activeItems->isEmpty() && $returnedItems->isNotEmpty()
            ? 'returned'
            : (string) ($ticket->status ?: 'pending');
        $allActiveItemsDelivered = $activeItems->isNotEmpty()
            && $activeItems->every(
                fn (array $item) => $item['status'] === 'completed'
                    && $item['resolved_service_status'] === 'delivered'
            );
        $effectiveTicketStatus = $allActiveItemsDelivered
            ? 'completed'
            : (string) ($ticket->status ?: 'pending');
        $displayStatusKey = $activeItems->isEmpty() && $returnedItems->isNotEmpty()
            ? 'returned'
            : $effectiveTicketStatus;
        $displayItems = $statusFilter === 'returned' ? $returnedItems : $activeItems;

        return [
            'id' => $ticket->id,
            'ticket_number' => $ticket->ticket_number,
            'status' => $effectiveTicketStatus,
            'display_status_key' => $displayStatusKey,
            'has_return_activity' => $returnedItems->isNotEmpty(),
            'is_fully_returned' => $activeItems->isEmpty() && $returnedItems->isNotEmpty(),
            'active_items_count' => $activeItems->count(),
            'returned_items_count' => $returnedItems->count(),
            'active_qty_total' => (int) $activeItems->sum('qty'),
            'returned_qty_total' => (int) $returnedItems->sum('qty'),
            'fired_at' => ReportTimezone::formatSourceIso8601($ticket->getRawOriginal('fired_at')),
            'acknowledged_at' => ReportTimezone::formatSourceIso8601($ticket->getRawOriginal('acknowledged_at')),
            'ready_at' => ReportTimezone::formatSourceIso8601($ticket->getRawOriginal('ready_at')),
            'completed_at' => ReportTimezone::formatSourceIso8601($ticket->getRawOriginal('completed_at')),
            'invoice' => $ticket->transaction?->invoice,
            'customer_name' => $ticket->transaction?->customer?->name,
            'order_reference_name' => $ticket->transaction?->order_reference_name,
            'order_reference_notes' => $ticket->transaction?->order_reference_notes,
            'customer_phone' => $ticket->transaction?->customer?->no_telp,
            'order_type' => $ticket->transaction?->order_type ?? 'take_away',
            'order_type_label' => $this->humanizeOrderType($ticket->transaction?->order_type),
            'table_label' => $this->tableLabel(
                $ticket->transaction?->diningTable?->code,
                $ticket->transaction?->diningTable?->name
            ),
            'table_name' => $ticket->transaction?->diningTable?->name,
            'table_code' => $ticket->transaction?->diningTable?->code,
            'notes' => $ticket->notes,
            'dispatch' => $latestDispatchEvent ? [
                'event' => $latestDispatchEvent->event,
                'status' => match ($latestDispatchEvent->event) {
                    'ticket.dispatch_queued' => 'queued',
                    'ticket.dispatch_failed' => 'failed',
                    default => 'dispatched',
                },
                'dispatched_at' => ReportTimezone::formatSourceIso8601($latestDispatchEvent->getRawOriginal('created_at')),
                'device_id' => data_get($latestDispatchEvent->payload, 'device_id'),
                'device_name' => data_get($latestDispatchEvent->payload, 'device_name'),
                'device_type' => data_get($latestDispatchEvent->payload, 'device_type'),
                'print_job_id' => data_get($latestDispatchEvent->payload, 'print_job_id'),
                'print_job_status' => data_get($latestDispatchEvent->payload, 'print_job_status'),
                'reason' => data_get($latestDispatchEvent->payload, 'reason'),
            ] : null,
            'customer_alert' => $latestCustomerAlertEvent ? [
                'event_id' => (int) $latestCustomerAlertEvent->id,
                'created_at' => ReportTimezone::formatSourceIso8601($latestCustomerAlertEvent->getRawOriginal('created_at')),
                'message' => (string) data_get($latestCustomerAlertEvent->payload, 'message', ''),
                'product_title' => (string) data_get($latestCustomerAlertEvent->payload, 'product_title', 'Produk'),
                'customer_name' => (string) data_get($latestCustomerAlertEvent->payload, 'customer_name', ''),
                'customer_phone' => (string) data_get($latestCustomerAlertEvent->payload, 'customer_phone', ''),
                'order_type' => (string) data_get($latestCustomerAlertEvent->payload, 'order_type', ''),
                'table_code' => (string) data_get($latestCustomerAlertEvent->payload, 'table_code', ''),
                'table_name' => (string) data_get($latestCustomerAlertEvent->payload, 'table_name', ''),
                'transaction_detail_id' => (int) data_get($latestCustomerAlertEvent->payload, 'transaction_detail_id', 0),
                'qty' => (int) data_get($latestCustomerAlertEvent->payload, 'qty', 0),
            ] : null,
            'print' => [
                'status' => $printStatus,
                'paper_width' => $this->resolveKitchenPreviewPaperWidth($ticket),
                'total_jobs' => $printJobs->count(),
                'success_jobs' => $successfulPrintJobs->count(),
                'failed_jobs' => $failedPrintJobs->count(),
                'queued_jobs' => $queuedPrintJobs->count(),
                'printed_copies' => $printedCopies,
                'first_printed_at' => $successfulPrintTimes->first(),
                'last_printed_at' => ReportTimezone::formatSourceIso8601($successfulPrintJobs->sortByDesc('processed_at')->first()?->getRawOriginal('processed_at')),
                'printed_at_list' => $successfulPrintTimes->all(),
                'last_failed_at' => ReportTimezone::formatSourceIso8601($failedPrintJobs->sortByDesc('failed_at')->first()?->getRawOriginal('failed_at')),
                'last_queued_at' => ReportTimezone::formatSourceIso8601($queuedPrintJobs->sortByDesc('queued_at')->first()?->getRawOriginal('queued_at')),
                'preview' => $this->buildKitchenTicketPrintPreview($ticket),
                'jobs_by_tenant' => $printJobsByTenant,
            ],
            'items' => $displayItems->values()->all(),
        ];
    }

    private function resolveKitchenPreviewPaperWidth(KitchenTicket $ticket): string
    {
        $paperWidth = (string) ($ticket->printJobs
            ->sortByDesc('id')
            ->pluck('payload.paper_width')
            ->filter()
            ->first() ?? '80mm');

        return strtolower($paperWidth) === '58mm' ? '58mm' : '80mm';
    }

    private function buildKitchenTicketPrintPreview(KitchenTicket $ticket): array
    {
        $paperWidth = $this->resolveKitchenPreviewPaperWidth($ticket);
        $cols = $paperWidth === '58mm' ? 32 : 48;
        $separator = str_repeat('=', $cols);
        $stationName = $ticket->kitchenStation?->name ?: 'KITCHEN ORDER';
        $lines = [$stationName];

        if ($ticket->ticket_number) {
            $lines[] = '#'.$ticket->ticket_number;
        }

        $lines[] = $separator;

        if ($ticket->transaction?->invoice) {
            $lines = array_merge($lines, $this->wrapKitchenPreviewText('Invoice: '.$ticket->transaction->invoice, $cols));
        }

        $customerName = $ticket->transaction?->customer?->name ?: 'Pelanggan Umum';
        $lines = array_merge($lines, $this->wrapKitchenPreviewText('Customer: '.$customerName, $cols));

        if ($ticket->transaction?->order_reference_name) {
            $lines = array_merge($lines, $this->wrapKitchenPreviewText('Nama / Ket: '.$ticket->transaction->order_reference_name, $cols));
        }

        if ($ticket->transaction?->order_reference_notes) {
            $lines = array_merge($lines, $this->wrapKitchenPreviewText('Nama / Ket: '.$ticket->transaction->order_reference_notes, $cols));
        }

        if ($ticket->transaction?->created_at) {
            $lines = array_merge($lines, $this->wrapKitchenPreviewText(
                'Waktu: '.\Carbon\Carbon::parse($ticket->transaction->created_at)->format('d/m/Y H:i'),
                $cols
            ));
        }

        if ($ticket->transaction?->order_type) {
            $lines = array_merge($lines, $this->wrapKitchenPreviewText(
                'Tipe: '.$this->humanizeOrderType($ticket->transaction->order_type),
                $cols
            ));
        }

        $tableLabel = $this->tableLabel(
            $ticket->transaction?->diningTable?->code,
            $ticket->transaction?->diningTable?->name
        );

        if ($tableLabel) {
            $lines = array_merge($lines, $this->wrapKitchenPreviewText('Meja: '.$tableLabel, $cols));
        }

        if ($ticket->notes) {
            $lines = array_merge($lines, $this->wrapKitchenPreviewText('Catatan: '.$ticket->notes, $cols));
        }

        $lines[] = $separator;

        foreach (($ticket->items ?? collect()) as $item) {
            $lines = array_merge($lines, $this->wrapKitchenPreviewText(
                sprintf('%sx %s', (int) ($item->qty ?? 0), (string) ($item->product_title ?? 'Item')),
                $cols
            ));

            if (! empty($item->notes)) {
                foreach ($this->wrapKitchenPreviewText('>> '.(string) $item->notes, max(1, $cols - 3)) as $line) {
                    $lines[] = '   '.$line;
                }
            }
        }

        return [
            'paper_width' => $paperWidth,
            'cols' => $cols,
            'lines' => $lines,
        ];
    }

    private function wrapKitchenPreviewText(string $text, int $width): array
    {
        $value = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);

        if ($value === '') {
            return [];
        }

        $words = preg_split('/\s+/', $value) ?: [];
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            if ($word === '') {
                continue;
            }

            if (strlen($word) > $width) {
                if ($current !== '') {
                    $lines[] = $current;
                    $current = '';
                }

                foreach (str_split($word, $width) as $segment) {
                    $lines[] = $segment;
                }

                continue;
            }

            $candidate = $current === '' ? $word : $current.' '.$word;

            if (strlen($candidate) <= $width) {
                $current = $candidate;
                continue;
            }

            $lines[] = $current;
            $current = $word;
        }

        if ($current !== '') {
            $lines[] = $current;
        }

        return $lines;
    }

    private function stationTicketStatusCounts(KitchenStation $station): array
    {
        return [
            'pending' => KitchenTicket::query()
                ->where('outlet_id', $station->outlet_id)
                ->where('kitchen_station_id', $station->id)
                ->where('status', 'pending')
                ->whereHas('items')
                ->count(),
            'acknowledged' => KitchenTicket::query()
                ->where('outlet_id', $station->outlet_id)
                ->where('kitchen_station_id', $station->id)
                ->where('status', 'acknowledged')
                ->whereHas('items')
                ->count(),
            'ready' => KitchenTicket::query()
                ->where('outlet_id', $station->outlet_id)
                ->where('kitchen_station_id', $station->id)
                ->where('status', 'ready')
                ->whereHas('items')
                ->count(),
            'completed' => KitchenTicket::query()
                ->where('outlet_id', $station->outlet_id)
                ->where('kitchen_station_id', $station->id)
                ->where('status', 'completed')
                ->whereHas('items')
                ->count(),
            'returned' => KitchenTicket::query()
                ->where('outlet_id', $station->outlet_id)
                ->where('kitchen_station_id', $station->id)
                ->whereHas('events', fn ($builder) => $builder->whereIn('event', ['ticket.returned_partial', 'ticket.returned_full']))
                ->count(),
        ];
    }

    private function humanizeOrderType(?string $orderType): string
    {
        return match ($orderType) {
            'dine_in' => 'Makan di Tempat',
            'take_away', 'takeaway' => 'Bawa Pulang',
            default => 'Bawa Pulang',
        };
    }

    private function tableLabel(?string $code, ?string $name): ?string
    {
        $code = filled($code) ? trim((string) $code) : null;
        $name = filled($name) ? trim((string) $name) : null;

        if ($code && $name && strcasecmp($code, $name) !== 0) {
            return "{$code} • {$name}";
        }

        return $code ?: $name;
    }

    private function autoAcknowledgePendingTickets(?KitchenStation $station, ?int $userId = null): void
    {
        if (! $station || ($station->processing_mode ?: 'auto') !== 'auto') {
            return;
        }

        $pendingTickets = KitchenTicket::query()
            ->with('items')
            ->where('outlet_id', $station->outlet_id)
            ->where('kitchen_station_id', $station->id)
            ->where('status', 'pending')
            ->get();

        foreach ($pendingTickets as $ticket) {
            if ($ticket->items->isEmpty()) {
                continue;
            }

            $ticket->forceFill([
                'status' => 'acknowledged',
                'acknowledged_at' => $ticket->acknowledged_at ?? now(),
            ])->save();

            $ticket->items()->where('status', 'pending')->update([
                'status' => 'acknowledged',
            ]);

            $ticket->events()->create([
                'user_id' => $userId,
                'event' => 'ticket.auto_acknowledged',
                'payload' => [
                    'station_id' => $ticket->kitchen_station_id,
                    'mode' => 'auto',
                ],
                'created_at' => now(),
            ]);
        }
    }

    private function autoCompleteDeliveredTickets(?KitchenStation $station, ?int $userId = null): void
    {
        if (! $station) {
            return;
        }

        KitchenTicket::query()
            ->with('items:id,kitchen_ticket_id,transaction_detail_id,qty,status')
            ->where('outlet_id', $station->outlet_id)
            ->where('kitchen_station_id', $station->id)
            ->whereIn('status', ['pending', 'acknowledged', 'ready'])
            ->get()
            ->each(function (KitchenTicket $ticket) use ($userId) {
                $activeItems = $this->filterReturnedKitchenTicketItems($ticket->items);

                if ($activeItems->isEmpty()) {
                    return;
                }

                $detailIds = $activeItems
                    ->pluck('transaction_detail_id')
                    ->filter()
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values();

                if ($detailIds->isEmpty()) {
                    return;
                }

                $serviceStatusMap = TransactionTenantAllocationItem::query()
                    ->whereIn('transaction_detail_id', $detailIds->all())
                    ->get(['transaction_detail_id', 'service_status'])
                    ->keyBy(fn ($item) => (int) $item->transaction_detail_id);

                $allDelivered = $detailIds->every(
                    fn (int $detailId) => optional($serviceStatusMap->get($detailId))->service_status === 'delivered'
                );

                if (! $allDelivered) {
                    return;
                }

                $timestamp = now();

                $ticket->forceFill([
                    'status' => 'completed',
                    'ready_at' => $ticket->ready_at ?? $timestamp,
                    'completed_at' => $ticket->completed_at ?? $timestamp,
                ])->save();

                $ticket->events()->create([
                    'user_id' => $userId,
                    'event' => 'ticket.auto_completed',
                    'payload' => [
                        'station_id' => $ticket->kitchen_station_id,
                        'reason' => 'all_items_delivered',
                    ],
                    'created_at' => $timestamp,
                ]);
            });
    }

    private function statusFilter(Request $request): string
    {
        return match ((string) $request->query('status', 'active')) {
            'pending' => 'pending',
            'acknowledged' => 'acknowledged',
            'ready' => 'ready',
            'completed' => 'completed',
            'returned' => 'returned',
            default => 'active',
        };
    }

    private function filterReturnedKitchenTicketItems(Collection $items): Collection
    {
        return $items
            ->filter(fn ($item) => max(0, (int) ($item->qty ?? 0)) > 0)
            ->values();
    }

    private function kitchenBoardMaps(Collection $tickets): array
    {
        $ticketIds = $tickets->pluck('id')->map(fn ($id) => (int) $id)->values();
        $detailIds = $tickets
            ->flatMap(fn (KitchenTicket $ticket) => $ticket->items->pluck('transaction_detail_id'))
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $serviceStatusMap = $detailIds->isEmpty()
            ? collect()
            : TransactionTenantAllocationItem::query()
                ->whereIn('transaction_detail_id', $detailIds->all())
                ->get([
                    'transaction_detail_id',
                    'service_status',
                    'ready_at',
                    'picked_up_at',
                    'delivered_at',
                ])
                ->keyBy(fn ($item) => (int) $item->transaction_detail_id);

        $latestDispatchEventMap = $ticketIds->isEmpty()
            ? collect()
            : KitchenTicketEvent::query()
                ->whereIn('kitchen_ticket_id', $ticketIds->all())
                ->whereIn('event', ['ticket.dispatch_queued', 'ticket.dispatched', 'ticket.dispatch_failed'])
                ->orderByDesc('created_at')
                ->get()
                ->unique('kitchen_ticket_id')
                ->keyBy(fn ($event) => (int) $event->kitchen_ticket_id);

        $latestReturnEventMap = $ticketIds->isEmpty()
            ? collect()
            : KitchenTicketEvent::query()
                ->whereIn('kitchen_ticket_id', $ticketIds->all())
                ->whereIn('event', ['ticket.returned_partial', 'ticket.returned_full'])
                ->orderByDesc('created_at')
                ->get()
                ->unique('kitchen_ticket_id')
                ->keyBy(fn ($event) => (int) $event->kitchen_ticket_id);

        $latestCustomerAlertEventMap = $ticketIds->isEmpty()
            ? collect()
            : KitchenTicketEvent::query()
                ->whereIn('kitchen_ticket_id', $ticketIds->all())
                ->where('event', 'ticket.customer_alert')
                ->orderByDesc('created_at')
                ->get()
                ->unique('kitchen_ticket_id')
                ->keyBy(fn ($event) => (int) $event->kitchen_ticket_id);

        return [
            'service_status_map' => $serviceStatusMap,
            'latest_dispatch_event_map' => $latestDispatchEventMap,
            'latest_return_event_map' => $latestReturnEventMap,
            'latest_customer_alert_event_map' => $latestCustomerAlertEventMap,
        ];
    }

    private function filtersPayload(Request $request): array
    {
        $perPage = (int) $request->integer('per_page', 15);
        $perPage = in_array($perPage, [10, 15, 25, 50], true) ? $perPage : 15;
        $sort = (string) $request->query('sort', 'oldest');
        $sort = in_array($sort, ['oldest', 'newest'], true) ? $sort : 'oldest';

        return [
            'status' => $this->statusFilter($request),
            'q' => trim((string) $request->query('q', '')),
            'page' => max(1, (int) $request->integer('page', 1)),
            'per_page' => $perPage,
            'sort' => $sort,
        ];
    }

    private function emptyTicketPayload(): array
    {
        return [
            'data' => [],
            'meta' => [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => 15,
                'total' => 0,
                'from' => null,
                'to' => null,
            ],
        ];
    }

    private function refreshMeta(): array
    {
        return [
            'polled_at' => now()->toIso8601String(),
            'interval_seconds' => 15,
        ];
    }

    private function printClientPayload(Outlet $outlet): array
    {
        $baseUrl = rtrim((string) config('app.url'), '/');

        return [
            'base_url' => $baseUrl,
            'outlet_id' => (int) $outlet->id,
            'token' => (string) config('services.print_bridge.token', '0000'),
            'version' => $this->resolvePrintClientVersion(),
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
            'meta' => $device->meta ?? [],
        ];
    }

    private function recordDispatchEvent(
        Request $request,
        KitchenTicket $kitchenTicket,
        string $eventName,
        string $message,
        array $extraPayload = []
    ): RedirectResponse|JsonResponse {
        $this->ensureKitchenAccess($request, $kitchenTicket);

        [$device] = $this->resolveDispatchDevice($request, $kitchenTicket);
        $printJob = $eventName === 'ticket.dispatched'
            ? $this->printJobService->latestQueuedKitchenTicketJob($kitchenTicket->id, $device->id)
            : null;

        if ($printJob) {
            $printJob = $this->printJobService->markSuccess($printJob);
        }

        $event = $kitchenTicket->events()->create([
            'user_id' => $request->user()?->id,
            'event' => $eventName,
            'payload' => [
                'station_id' => $kitchenTicket->kitchen_station_id,
                'device_id' => $device->id,
                'device_name' => $device->name,
                'device_type' => $device->device_type,
                'connection_driver' => $device->connection_driver,
                'endpoint' => $device->endpoint,
                'print_job_id' => $printJob?->id,
                'print_job_status' => $printJob?->status,
                ...$extraPayload,
            ],
            'created_at' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => $message,
                'event_id' => $event->id,
            ]);
        }

        return back()->with('success', $message);
    }

    private function resolveDispatchDevice(Request $request, KitchenTicket $kitchenTicket, bool $withReason = false): array
    {
        $rules = [
            'device_id' => ['required', 'integer'],
        ];

        if ($withReason) {
            $rules['reason'] = ['nullable', 'string', 'max:255'];
        }

        $validated = $request->validate($rules);

        $device = KitchenStationDevice::query()
            ->where('kitchen_station_id', $kitchenTicket->kitchen_station_id)
            ->where('is_active', true)
            ->findOrFail($validated['device_id']);

        return [$device, $validated];
    }

    private function resolveFallbackDevice(KitchenStationDevice $device): ?KitchenStationDevice
    {
        $fallbackDeviceId = data_get($device->meta, 'fallback_device_id');

        if (! $fallbackDeviceId) {
            return null;
        }

        return KitchenStationDevice::query()
            ->where('kitchen_station_id', $device->kitchen_station_id)
            ->where('is_active', true)
            ->find($fallbackDeviceId);
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
