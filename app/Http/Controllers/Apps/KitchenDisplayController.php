<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\KitchenTicket;
use App\Models\TransactionTenantAllocationItem;
use App\Models\Outlet;
use App\Models\ProductKitchenStationMapping;
use App\Models\TransactionTenantAllocation;
use App\Services\OutletResolver;
use App\Services\PrintJobService;
use App\Services\WaiterFulfillmentService;
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

        $activeStation = $stations->first();
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
        ]);
    }

    public function feed(Request $request, string $stationSlug): JsonResponse
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        abort_if(! $outlet, 404);
        $filters = $this->filtersPayload($request);
        $station = $this->visibleStations($request, $outlet)->firstWhere('slug', $stationSlug);
        abort_if(! $station, 404);

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
            ->whereIn('status', ['pending', 'acknowledged'])
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
        $pendingCount = $station->kitchenTickets()->where('status', 'pending')->count();
        $acknowledgedCount = $station->kitchenTickets()->where('status', 'acknowledged')->count();
        $readyCount = $station->kitchenTickets()->where('status', 'ready')->count();
        $completedCount = $station->kitchenTickets()->where('status', 'completed')->count();

        return [
            'id' => $station->id,
            'name' => $station->name,
            'slug' => $station->slug,
            'code' => $station->code,
            'display_mode' => $station->display_mode,
            'processing_mode' => $station->processing_mode ?: 'auto',
            'station_type' => $station->station_type,
            'pending_count' => $pendingCount,
            'acknowledged_count' => $acknowledgedCount,
            'ready_count' => $readyCount,
            'completed_count' => $completedCount,
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
                'transaction:id,invoice,customer_id,order_type,table_id',
                'transaction.customer:id,name,no_telp',
                'transaction.diningTable:id,name,code',
                'items',
            ])
            ->where('outlet_id', $station->outlet_id)
            ->where('kitchen_station_id', $station->id);

        match ($statusFilter) {
            'pending' => $query->where('status', 'pending'),
            'acknowledged' => $query->where('status', 'acknowledged'),
            'ready' => $query->where('status', 'ready'),
            'completed' => $query->where('status', 'completed'),
            default => $query->whereIn('status', ['pending', 'acknowledged', 'ready']),
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

        $tickets = $query
            ->paginate($perPage)
            ->through(function (KitchenTicket $ticket) {
                $detailIds = $ticket->items
                    ->pluck('transaction_detail_id')
                    ->filter()
                    ->map(fn ($id) => (int) $id)
                    ->values();

                $serviceStatusMap = TransactionTenantAllocationItem::query()
                    ->whereIn('transaction_detail_id', $detailIds->all())
                    ->get([
                        'transaction_detail_id',
                        'service_status',
                        'ready_at',
                        'picked_up_at',
                        'delivered_at',
                    ])
                    ->keyBy(fn ($item) => (int) $item->transaction_detail_id);

                $latestDispatchEvent = $ticket->events()
                    ->whereIn('event', ['ticket.dispatch_queued', 'ticket.dispatched', 'ticket.dispatch_failed'])
                    ->latest('created_at')
                    ->first();

                return [
                    'id' => $ticket->id,
                    'ticket_number' => $ticket->ticket_number,
                    'status' => $ticket->status,
                    'fired_at' => optional($ticket->fired_at)?->toIso8601String(),
                    'acknowledged_at' => optional($ticket->acknowledged_at)?->toIso8601String(),
                    'ready_at' => optional($ticket->ready_at)?->toIso8601String(),
                    'completed_at' => optional($ticket->completed_at)?->toIso8601String(),
                    'invoice' => $ticket->transaction?->invoice,
                    'customer_name' => $ticket->transaction?->customer?->name,
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
                        'dispatched_at' => optional($latestDispatchEvent->created_at)?->toIso8601String(),
                        'device_id' => data_get($latestDispatchEvent->payload, 'device_id'),
                        'device_name' => data_get($latestDispatchEvent->payload, 'device_name'),
                        'device_type' => data_get($latestDispatchEvent->payload, 'device_type'),
                        'print_job_id' => data_get($latestDispatchEvent->payload, 'print_job_id'),
                        'print_job_status' => data_get($latestDispatchEvent->payload, 'print_job_status'),
                        'reason' => data_get($latestDispatchEvent->payload, 'reason'),
                    ] : null,
                    'items' => $ticket->items->map(fn ($item) => [
                        'resolved_service_status' => (($serviceStatusMap->get((int) $item->transaction_detail_id)?->service_status === 'not_required')
                            && $item->status === 'completed')
                            ? 'ready'
                            : (optional($serviceStatusMap->get((int) $item->transaction_detail_id))->service_status
                                ?? ($item->status === 'completed' ? 'ready' : 'pending')),
                        'id' => $item->id,
                        'product_title' => $item->product_title,
                        'qty' => (int) $item->qty,
                        'status' => $item->status,
                        'notes' => $item->notes,
                        'completed_at' => optional($item->completed_at)?->toIso8601String(),
                        'service_status' => (($serviceStatusMap->get((int) $item->transaction_detail_id)?->service_status === 'not_required')
                            && $item->status === 'completed')
                            ? 'ready'
                            : (optional($serviceStatusMap->get((int) $item->transaction_detail_id))->service_status
                                ?? ($item->status === 'completed' ? 'ready' : 'pending')),
                        'ready_at' => optional(optional($serviceStatusMap->get((int) $item->transaction_detail_id))->ready_at)?->toIso8601String(),
                        'picked_up_at' => optional(optional($serviceStatusMap->get((int) $item->transaction_detail_id))->picked_up_at)?->toIso8601String(),
                        'delivered_at' => optional(optional($serviceStatusMap->get((int) $item->transaction_detail_id))->delivered_at)?->toIso8601String(),
                    ])->values(),
                ];
            });

        return [
            'data' => $tickets->items(),
            'meta' => [
                'current_page' => $tickets->currentPage(),
                'last_page' => $tickets->lastPage(),
                'per_page' => $tickets->perPage(),
                'total' => $tickets->total(),
                'from' => $tickets->firstItem(),
                'to' => $tickets->lastItem(),
            ],
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

    private function statusFilter(Request $request): string
    {
        return match ((string) $request->query('status', 'active')) {
            'pending' => 'pending',
            'acknowledged' => 'acknowledged',
            'ready' => 'ready',
            'completed' => 'completed',
            default => 'active',
        };
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
