<?php

namespace App\Http\Controllers;

use App\Services\OutletResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class OutletContextController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function update(Request $request): RedirectResponse
    {
        if (! Schema::hasTable('outlets')) {
            return back();
        }

        $validated = $request->validate([
            'outlet_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $selectedOutletId = $validated['outlet_id'] ?? null;

        if ($selectedOutletId) {
            $accessibleOutlet = $user?->outlets()
                ->active()
                ->where('outlets.id', $selectedOutletId)
                ->exists();

            abort_unless($accessibleOutlet, 403);

            $request->session()->put('active_outlet_id', (int) $selectedOutletId);

            return back();
        }

        $request->session()->forget('active_outlet_id');

        $fallbackOutletId = $this->outletResolver->resolve($request, $user)?->id;
        if ($fallbackOutletId) {
            $request->session()->put('active_outlet_id', (int) $fallbackOutletId);
        }

        return back();
    }
}
