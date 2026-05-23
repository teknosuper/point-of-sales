<?php

namespace App\Http\Controllers;

use App\Models\NotificationRead;
use App\Models\Product;
use App\Models\ProductNotificationRead;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Mark a single low-stock notification as read for the current user.
     */
    public function markLowStockRead(Request $request)
    {
        $request->validate([
            'product_id' => ['required', 'exists:products,id'],
        ]);

        ProductNotificationRead::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'product_id' => $request->product_id,
            ],
            []
        );

        return back()->with('status', 'notification-read');
    }

    /**
     * Mark all low-stock notifications as read for the current user.
     */
    public function markAllLowStockRead(Request $request)
    {
        $productIds = Product::where('stock', '<=', 0)->pluck('id')->all();

        if (count($productIds) === 0) {
            return back();
        }

        $payload = collect($productIds)->map(function ($productId) use ($request) {
            return [
                'user_id' => $request->user()->id,
                'product_id' => $productId,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        });

        ProductNotificationRead::upsert(
            $payload->toArray(),
            ['user_id', 'product_id'],
            ['updated_at']
        );

        return back()->with('status', 'notification-read-all');
    }

    public function markRead(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:receivable,payable'],
            'reference_id' => ['required', 'integer', 'min:1'],
        ]);

        NotificationRead::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'type' => $validated['type'],
                'reference_id' => $validated['reference_id'],
            ],
            []
        );

        return back()->with('status', 'notification-read');
    }

    public function markAllRead(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.type' => ['required', 'in:receivable,payable'],
            'items.*.reference_id' => ['required', 'integer', 'min:1'],
        ]);

        $payload = collect($validated['items'])
            ->unique(fn ($item) => $item['type'].'-'.$item['reference_id'])
            ->map(fn ($item) => [
                'user_id' => $request->user()->id,
                'type' => $item['type'],
                'reference_id' => $item['reference_id'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

        NotificationRead::upsert(
            $payload->toArray(),
            ['user_id', 'type', 'reference_id'],
            ['updated_at']
        );

        return back()->with('status', 'notification-read-all');
    }
}
