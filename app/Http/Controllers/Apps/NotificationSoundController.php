<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenStation;
use App\Models\NotificationSound;
use App\Models\Outlet;
use App\Services\OutletResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class NotificationSoundController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    private function resolveOutlet(Request $request): ?Outlet
    {
        $user = $request->user();

        if ($user?->isSuperAdmin()) {
            return $this->outletResolver->resolve($request);
        }

        $resolved = $this->outletResolver->resolve($request);

        if ($resolved && (string) ($resolved->outlet_type ?? '') === 'tenant') {
            return $resolved;
        }

        $tenantOutlet = $user->accessibleOutletsQuery()
            ->where('outlets.outlet_type', 'tenant')
            ->where('outlets.is_active', true)
            ->orderBy('outlets.sort_order')
            ->orderBy('outlets.name')
            ->first();

        if ($tenantOutlet) {
            return $tenantOutlet;
        }

        return $resolved;
    }

    /**
     * Render the notification sounds settings page
     */
    public function index(Request $request)
    {
        $activeOutlet = $this->resolveOutlet($request);
        $user = $request->user();

        $outletsQuery = Outlet::query()
            ->active()
            ->ordered();

        if ($user?->isSuperAdmin()) {
            $outlets = $outletsQuery->get(['outlets.id', 'outlets.name', 'outlets.code', 'outlets.outlet_type']);
        } else {
            $outlets = $user?->accessibleOutletsQuery()
                ->active()
                ->ordered()
                ->get(['outlets.id', 'outlets.name', 'outlets.code', 'outlets.outlet_type']);
        }

        $stations = collect();
        if ($activeOutlet) {
            $stations = KitchenStation::query()
                ->where('outlet_id', $activeOutlet->id)
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'code']);
        }

        return Inertia::render('Dashboard/Settings/NotificationSounds', [
            'active_outlet' => $activeOutlet ? [
                'id' => $activeOutlet->id,
                'name' => $activeOutlet->name,
                'code' => $activeOutlet->code,
                'outlet_type' => $activeOutlet->outlet_type,
            ] : null,
            'outlets' => $outlets?->map(fn ($outlet) => [
                'id' => $outlet->id,
                'name' => $outlet->name,
                'code' => $outlet->code,
                'outlet_type' => $outlet->outlet_type,
            ]) ?? collect(),
            'stations' => $stations,
            'is_super_admin' => (bool) ($user?->isSuperAdmin() ?? false),
        ]);
    }

    /**
     * API: Get all sounds (for React component)
     */
    public function data(Request $request): JsonResponse
    {
        $user = $request->user();
        $isSuperAdmin = $user?->isSuperAdmin();
        $requestedOutletId = (int) $request->query('outlet_id', 0);
        $requestedStationId = (int) $request->query('station_id', 0);
        $type = $request->input('type');

        // Resolve outlet
        $activeOutletId = $requestedOutletId;
        if (!$activeOutletId && !$isSuperAdmin) {
            $activeOutletId = $this->resolveOutlet($request)?->id;
        }

        // Build query: station-specific + outlet-level + global, with scope indicator
        $query = NotificationSound::query()
            ->when($type, fn ($q, $t) => $q->where('type', $t))
            ->when($requestedStationId > 0, function ($q) use ($requestedStationId) {
                $q->where(function ($sq) use ($requestedStationId) {
                    $sq->where('station_id', $requestedStationId)
                        ->orWhere(function ($sq2) {
                            $sq2->whereNull('station_id');
                        });
                });
            }, function ($q) use ($activeOutletId) {
                // No station filter: show outlet-level + global
                if ($activeOutletId) {
                    $q->where(function ($sq) use ($activeOutletId) {
                        $sq->whereNull('outlet_id')->orWhere('outlet_id', $activeOutletId);
                    });
                } else {
                    $q->whereNull('outlet_id');
                }
            })
            ->orderByRaw('
                CASE
                    WHEN station_id IS NOT NULL THEN 0
                    WHEN outlet_id IS NOT NULL THEN 1
                    ELSE 2
                END
            ')
            ->orderBy('station_id')
            ->orderBy('outlet_id')
            ->orderBy('type')
            ->orderBy('sort_order')
            ->orderBy('name');

        $sounds = $query->get()->map(function ($sound) {
            // Determine scope
            if ($sound->station_id !== null) {
                $scope = 'station';
            } elseif ($sound->outlet_id !== null) {
                $scope = 'outlet';
            } else {
                $scope = 'global';
            }

            return [
                'id' => $sound->id,
                'name' => $sound->name,
                'type' => $sound->type,
                'type_label' => NotificationSound::getTypes()[$sound->type] ?? $sound->type,
                'url' => $sound->url,
                'file_path' => $sound->file_path,
                'original_name' => $sound->original_name,
                'file_size' => $sound->file_size,
                'file_size_human' => $sound->file_size_human,
                'is_active' => $sound->is_active,
                'sort_order' => $sound->sort_order,
                'created_at' => $sound->created_at->toISOString(),
                'outlet_id' => $sound->outlet_id,
                'outlet_name' => $sound->outlet?->name,
                'outlet_code' => $sound->outlet?->code,
                'station_id' => $sound->station_id,
                'station_name' => $sound->station?->name,
                'station_slug' => $sound->station?->slug,
                'scope' => $scope,
                'is_global' => $sound->outlet_id === null && $sound->station_id === null,
            ];
        });

        // Build effective active per type (fallback chain: station > outlet > global)
        $effectiveActive = [];
        $allTypes = array_keys(NotificationSound::getTypes());
        foreach ($allTypes as $t) {
            $typeSounds = $sounds->where('type', $t)->values();
            $activeSound = $typeSounds->firstWhere('is_active', true);
            $effectiveActive[$t] = $activeSound ? [
                'id' => $activeSound['id'],
                'name' => $activeSound['name'],
                'scope' => $activeSound['scope'],
                'url' => $activeSound['url'],
            ] : null;
        }

        return response()->json([
            'success' => true,
            'data' => $sounds,
            'types' => NotificationSound::getTypes(),
            'effective_active' => $effectiveActive,
        ]);
    }

    private function resolveOutletForAction(Request $request): ?Outlet
    {
        $user = $request->user();

        if ($user?->isSuperAdmin()) {
            return Outlet::query()
                ->active()
                ->ordered()
                ->find($request->integer('outlet_id'))
                ?? $this->outletResolver->resolve($request);
        }

        return $this->resolveOutlet($request);
    }

    public function store(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', Rule::in(array_keys(NotificationSound::getTypes()))],
            'file' => ['required', 'file', 'mimes:mp3,wav,ogg,webm', 'max:5120'],
            'replace_existing' => ['sometimes', 'boolean'],
            'station_id' => ['nullable', 'integer', 'exists:kitchen_stations,id'],
        ]);

        $file = $request->file('file');
        $fileName = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $filePath = 'notification-sounds/' . $fileName;

        Storage::disk('public')->putFileAs('notification-sounds', $file, $fileName);

        $stationId = $validated['station_id'] ?? null;
        $outletId = null;

        // Resolve outlet from station or active outlet
        if ($stationId) {
            $station = KitchenStation::find($stationId);
            $outletId = $station?->outlet_id;
        } else {
            $activeOutlet = $this->resolveOutletForAction($request);
            $outletId = $activeOutlet?->id;
        }

        $replaceExisting = $request->boolean('replace_existing', true);
        if ($replaceExisting) {
            $existingQuery = NotificationSound::where('type', $validated['type'])
                ->where('is_active', true);

            if ($stationId) {
                $existingQuery->where('station_id', $stationId);
            } elseif ($outletId) {
                $existingQuery->whereNull('station_id')->where('outlet_id', $outletId);
            } else {
                $existingQuery->whereNull('station_id')->whereNull('outlet_id');
            }

            $existingSound = $existingQuery->first();
            if ($existingSound) {
                if (Storage::disk('public')->exists($existingSound->file_path)) {
                    Storage::disk('public')->delete($existingSound->file_path);
                }
                $existingSound->delete();
            }
        }

        NotificationSound::create([
            'name' => $validated['name'],
            'type' => $validated['type'],
            'file_path' => $filePath,
            'original_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'is_active' => true,
            'sort_order' => 0,
            'outlet_id' => $outletId,
            'station_id' => $stationId,
        ]);

        return $this->notifySuccess($request, 'Suara notifikasi berhasil diupload.');
    }

    public function update(Request $request, NotificationSound $sound): \Symfony\Component\HttpFoundation\Response
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'type' => ['sometimes', Rule::in(array_keys(NotificationSound::getTypes()))],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $sound->update($validated);

        return $this->notifySuccess($request, 'Suara notifikasi berhasil diperbarui.');
    }

    private function notifySuccess(Request $request, string $message): \Symfony\Component\HttpFoundation\Response
    {
        if ($request->header('X-Inertia') === 'true') {
            return back()->with('success', $message);
        }

        return response()->json([
            'success' => true,
            'message' => $message,
        ]);
    }

    public function setActive(Request $request, NotificationSound $sound): \Symfony\Component\HttpFoundation\Response
    {
        $query = NotificationSound::where('type', $sound->type)
            ->where('id', '!=', $sound->id);

        // Scope deactivation to the same level
        if ($sound->station_id !== null) {
            // Station-specific: only deactivate other station-specific sounds for same station
            $query->where('station_id', $sound->station_id);
        } elseif ($sound->outlet_id !== null) {
            // Outlet-level: deactivate outlet + global (so station-specific aren't affected)
            $query->where(function ($q) use ($sound) {
                $q->where(function ($q2) use ($sound) {
                    $q2->whereNull('station_id')->where('outlet_id', $sound->outlet_id);
                })->orWhere(function ($q2) {
                    $q2->whereNull('station_id')->whereNull('outlet_id');
                });
            });
        } else {
            // Global: only deactivate other global sounds
            $query->whereNull('outlet_id')->whereNull('station_id');
        }

        $query->update(['is_active' => false]);

        $sound->update(['is_active' => true]);

        $scopeLabel = match(true) {
            $sound->station_id !== null => "station {$sound->station?->name}",
            $sound->outlet_id !== null => "outlet",
            default => "global",
        };

        return $this->notifySuccess($request, "Suara '{$sound->name}' sekarang aktif untuk tipe {$sound->type} ({$scopeLabel}).");
    }

    public function destroy(Request $request, NotificationSound $sound): \Symfony\Component\HttpFoundation\Response
    {
        if (Storage::disk('public')->exists($sound->file_path)) {
            Storage::disk('public')->delete($sound->file_path);
        }

        $sound->delete();

        return $this->notifySuccess($request, 'Suara notifikasi berhasil dihapus.');
    }

    public function play(NotificationSound $sound): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'url' => $sound->url,
                'name' => $sound->name,
            ],
        ]);
    }
}
