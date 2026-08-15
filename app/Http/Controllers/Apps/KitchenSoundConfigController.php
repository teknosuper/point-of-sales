<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\KitchenSoundConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class KitchenSoundConfigController extends Controller
{
    public function index(): JsonResponse
    {
        $configs = KitchenSoundConfig::orderBy('event_type')->get();

        return response()->json([
            'success' => true,
            'data' => $configs->map(fn ($c) => [
                'id' => $c->id,
                'event_type' => $c->event_type,
                'event_label' => KitchenSoundConfig::getEventLabels()[$c->event_type] ?? $c->event_type,
                'interval_seconds' => $c->interval_seconds,
                'is_enabled' => $c->is_enabled,
            ]),
            'event_labels' => KitchenSoundConfig::getEventLabels(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'configs' => ['required', 'array', 'min:1'],
            'configs.*.event_type' => ['required', Rule::in(array_keys(KitchenSoundConfig::getEventLabels()))],
            'configs.*.interval_seconds' => ['required', 'integer', 'min:0', 'max:3600'],
            'configs.*.is_enabled' => ['required', 'boolean'],
        ]);

        foreach ($validated['configs'] as $item) {
            KitchenSoundConfig::where('event_type', $item['event_type'])->update([
                'interval_seconds' => $item['interval_seconds'],
                'is_enabled' => $item['is_enabled'],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Konfigurasi interval pengingat berhasil disimpan.',
        ]);
    }
}
