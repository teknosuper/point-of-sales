<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Review;
use App\Models\Setting;
use Illuminate\Support\Collection;

class MenuReviewService
{
    public function __construct(private readonly AuditLogService $auditLogService) {}

    public function createReview(array $data): Review
    {
        $review = Review::create([
            'product_id' => (int) $data['product_id'],
            'customer_id' => $data['customer_id'] ? (int) $data['customer_id'] : null,
            'rating' => (int) $data['rating'],
            'comment' => $data['comment'] ?? null,
            'is_verified_purchase' => (bool) ($data['is_verified_purchase'] ?? false),
            'reviewed_at' => now(),
        ]);

        $this->evaluateProductShadowBan($review->product);

        return $review->load(['product', 'customer']);
    }

    public function productReviewSummary(int $productId): array
    {
        $product = Product::query()->findOrFail($productId);

        $stats = Review::query()
            ->where('product_id', $productId)
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('AVG(rating) as average')
            ->selectRaw('SUM(rating = 1) as one_star_count')
            ->first();

        return [
            'product_id' => $productId,
            'review_count' => (int) ($stats->total ?? 0),
            'average_rating' => round((float) ($stats->average ?? 0), 2),
            'one_star_count' => (int) ($stats->one_star_count ?? 0),
            'is_featured' => (bool) $product->is_featured,
            'shadow_banned_at' => optional($product->shadow_banned_at)->toISOString(),
            'shadow_ban_reason' => $product->shadow_ban_reason,
            'penalty_status' => $product->penalty_status,
        ];
    }

    public function evaluateProductShadowBan(Product $product): void
    {
        $enabled = Setting::getBool('menu_shadow_ban_auto_penalty_enabled', false);
        if (! $enabled) {
            return;
        }

        $threshold = (int) Setting::get('menu_shadow_ban_one_star_threshold', 6);
        if ($threshold <= 0) {
            return;
        }

        $product->loadCount(['reviews as one_star_reviews_count' => fn ($query) => $query->where('rating', 1)]);

        if ($product->one_star_reviews_count >= $threshold && ! $product->shadow_banned_at) {
            $product->update([
                'shadow_banned_at' => now(),
                'shadow_ban_reason' => 'Auto-penalty: >= '.$threshold.' one-star reviews',
                'penalty_status' => 'under_review',
            ]);

            $this->auditLogService->log(
                event: 'product.shadow_banned_auto',
                module: 'menu_reviews',
                auditable: $product,
                description: 'Produk otomatis masuk shadow ban karena mencapai threshold review bintang 1.',
                after: [
                    'product_id' => $product->id,
                    'product_title' => $product->title,
                    'one_star_count' => (int) $product->one_star_reviews_count,
                    'threshold' => $threshold,
                ]
            );
        }
    }

    public function toggleFeatured(int $productId, bool $featured): Product
    {
        $product = Product::query()->findOrFail($productId);
        $product->update(['is_featured' => $featured]);

        return $product->fresh();
    }

    public function updatePenaltyStatus(int $productId, ?string $status, ?string $reason = null): Product
    {
        $product = Product::query()->findOrFail($productId);

        $data = [
            'penalty_status' => $status,
            'shadow_ban_reason' => $reason ?? $product->shadow_ban_reason,
        ];

        if ($status === 'accepted') {
            $data['shadow_banned_at'] = null;
        } elseif ($status === 'rejected' && ! $product->shadow_banned_at) {
            $data['shadow_banned_at'] = now();
            $data['shadow_ban_reason'] = $reason ?? 'Manual penalty';
        } elseif ($status === null) {
            $data['shadow_banned_at'] = null;
            $data['shadow_ban_reason'] = null;
        }

        $product->update($data);

        return $product->fresh();
    }
}
