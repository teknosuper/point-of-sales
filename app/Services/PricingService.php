<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\Customer;
use App\Models\PricingRule;
use App\Models\PricingRuleBuyGetItem;
use App\Models\PricingRuleQtyBreak;
use App\Models\Product;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Collection;

class PricingService
{
    public function __construct(
        private readonly LoyaltyService $loyaltyService,
        private readonly PricingCacheService $pricingCacheService
    ) {}

    public function getActiveRules(?CarbonInterface $at = null, ?int $outletId = null): Collection
    {
        $at = $at ?? now();
        $cacheBucket = (int) floor($at->getTimestamp() / 30);
        $cacheVersion = $this->pricingCacheService->activeRulesVersion();
        $cacheKey = 'pricing-rules:active:v'.$cacheVersion.':'.$cacheBucket.':'.($outletId ?: 'global');

        return Cache::remember(
            $cacheKey,
            now()->addSeconds(30),
            fn () => PricingRule::query()
                ->with([
                    'product:id,title,buy_price,sell_price,category_id',
                    'category:id,name',
                    'outlet:id,name,code,outlet_type',
                    'qtyBreaks',
                    'bundleItems.product:id,title,buy_price,sell_price,category_id',
                    'buyGetItems.product:id,title,buy_price,sell_price,category_id',
                ])
                ->where('is_active', true)
                ->when(
                    $outletId,
                    fn ($query) => $query->where(function ($builder) use ($outletId) {
                        $builder
                            ->whereNull('outlet_id')
                            ->orWhere('outlet_id', $outletId);
                    })
                )
                ->where(function ($query) use ($at) {
                    $query->whereNull('starts_at')->orWhere('starts_at', '<=', $at);
                })
                ->where(function ($query) use ($at) {
                    $query->whereNull('ends_at')->orWhere('ends_at', '>=', $at);
                })
                ->orderByDesc('priority')
                ->orderBy('id')
                ->get()
                ->filter(fn (PricingRule $rule) => $this->matchesRecurringSchedule($rule, $at))
                ->values()
        );
    }

    public function previewCart(iterable $carts, ?Customer $customer = null, ?CarbonInterface $at = null, ?int $outletId = null): array
    {
        $rules = $this->getActiveRules($at, $outletId);
        $cartCollection = $this->normalizeRewardCarts(
            $carts,
            $at,
            $outletId,
            $rules
        );

        return $this->buildPreview($cartCollection, $customer, $rules, $outletId);
    }

    public function previewCartWithRules(iterable $carts, ?Customer $customer, Collection $rules, ?int $outletId = null): array
    {
        $cartCollection = $this->normalizeRewardCarts(
            $carts,
            null,
            $outletId,
            $rules
        );

        return $this->buildPreview($cartCollection, $customer, $rules->values(), $outletId);
    }

    public function normalizeRewardCarts(
        iterable $carts,
        ?CarbonInterface $at = null,
        ?int $outletId = null,
        ?Collection $rules = null
    ): Collection {
        $cartCollection = collect($carts)
            ->filter(fn ($cart) => $cart instanceof Cart && $cart->product)
            ->values();
        $rules = $rules ?? $this->getActiveRules($at, $outletId);

        return $this->applySameProductBuyGetRewardNormalization($cartCollection, $rules);
    }

    public function previewDraftRule(PricingRule $rule, ?Customer $customer = null, ?int $outletId = null): array
    {
        $carts = $this->buildPreviewCartsForRule($rule);
        $preview = $this->buildPreview($carts, $customer, collect([$rule]), $outletId);

        return [
            ...$preview,
            'diagnostics' => $this->buildDraftDiagnostics($rule, $carts, $preview),
        ];
    }

    public function previewProducts(iterable $products, ?Customer $customer = null, ?CarbonInterface $at = null, ?int $outletId = null): Collection
    {
        $rules = $this->getActiveRules($at, $outletId);

        return collect($products)
            ->filter(fn ($product) => $product instanceof Product)
            ->mapWithKeys(function (Product $product) use ($customer, $rules, $outletId) {
                return [$product->id => $this->calculateProductPrice($product, 1, $customer, $rules, $outletId)];
            });
    }

    public function calculateProductPrice(
        Product $product,
        int $qty = 1,
        ?Customer $customer = null,
        ?Collection $rules = null,
        ?int $outletId = null
    ): array {
        $rules = $rules ?? $this->getActiveRules();
        $quantity = max(1, $qty);
        $matchingRules = $rules
            ->filter(fn (PricingRule $rule) => $this->matchesCustomerScope($rule, $customer, $outletId))
            ->filter(fn (PricingRule $rule) => $this->ruleTouchesProduct($rule, $product));

        $directCandidates = $matchingRules
            ->filter(fn (PricingRule $rule) => in_array($rule->kind, [
                PricingRule::KIND_STANDARD_DISCOUNT,
                PricingRule::KIND_QTY_BREAK,
            ], true))
            ->map(function (PricingRule $rule) use ($product, $quantity) {
                $previewQuantity = $rule->kind === PricingRule::KIND_QTY_BREAK
                    ? max($quantity, (int) ($rule->preview_quantity_multiplier ?: $rule->qtyBreaks->max('min_qty') ?: 1))
                    : $quantity;

                return $this->calculateLineCandidate($rule, $product, $previewQuantity);
            })
            ->filter()
            ->sortBy([
                ['rule.priority', 'desc'],
                ['line_discount', 'desc'],
                ['rule.id', 'asc'],
            ])
            ->first();

        if ($directCandidates) {
            $components = $this->productPricingComponents($product, $quantity);
            $baseUnitPrice = (int) $components['customer_base_unit_price'];
            $effectiveUnitPrice = (int) round(
                $directCandidates['line_total'] / max(1, (int) $quantity)
            );
            $rule = $directCandidates['rule'];

            return [
                'base_unit_price' => $baseUnitPrice,
                'customer_base_unit_price' => $baseUnitPrice,
                'tenant_base_unit_price' => (int) $components['tenant_base_unit_price'],
                'owner_markup_unit_price' => (int) $components['owner_markup_unit_price'],
                'effective_unit_price' => $effectiveUnitPrice,
                'quantity' => (int) $quantity,
                'line_base_total' => (int) $components['customer_base_total'],
                'line_total' => (int) $directCandidates['line_total'],
                'line_discount_total' => (int) $directCandidates['line_discount'],
                'tenant_base_total' => (int) $components['tenant_base_total'],
                'owner_base_total' => (int) $components['owner_base_total'],
                'tenant_discount_total' => (int) ($directCandidates['tenant_discount_total'] ?? 0),
                'owner_discount_total' => (int) ($directCandidates['owner_discount_total'] ?? 0),
                'tenant_net_total' => max(0, (int) $components['tenant_base_total'] - (int) ($directCandidates['tenant_discount_total'] ?? 0)),
                'owner_net_total' => max(0, (int) $components['owner_base_total'] - (int) ($directCandidates['owner_discount_total'] ?? 0)),
                'pricing_rule' => $this->serializeRule($rule),
            ];
        }

        $complexRule = $matchingRules
            ->filter(fn (PricingRule $rule) => in_array($rule->kind, [
                PricingRule::KIND_BUNDLE_PRICE,
                PricingRule::KIND_BUY_X_GET_Y,
            ], true))
            ->sortBy([
                ['priority', 'desc'],
                ['id', 'asc'],
            ])
            ->first();

        $components = $this->productPricingComponents($product, $quantity);

        return [
            'base_unit_price' => (int) $components['customer_base_unit_price'],
            'customer_base_unit_price' => (int) $components['customer_base_unit_price'],
            'tenant_base_unit_price' => (int) $components['tenant_base_unit_price'],
            'owner_markup_unit_price' => (int) $components['owner_markup_unit_price'],
            'effective_unit_price' => (int) $components['customer_base_unit_price'],
            'quantity' => $quantity,
            'line_base_total' => (int) $components['customer_base_total'],
            'line_total' => (int) $components['customer_base_total'],
            'line_discount_total' => 0,
            'tenant_base_total' => (int) $components['tenant_base_total'],
            'owner_base_total' => (int) $components['owner_base_total'],
            'tenant_discount_total' => 0,
            'owner_discount_total' => 0,
            'tenant_net_total' => (int) $components['tenant_base_total'],
            'owner_net_total' => (int) $components['owner_base_total'],
            'pricing_rule' => $complexRule ? $this->serializeRule($complexRule, false) : null,
            'is_promo_reward' => false,
        ];
    }

    public function ruleLabel(PricingRule $rule): string
    {
        return match ($rule->kind) {
            PricingRule::KIND_QTY_BREAK => 'Grosir '.$this->standardDiscountLabel($rule),
            PricingRule::KIND_BUNDLE_PRICE => 'Bundle Rp '.number_format((float) $rule->discount_value, 0, ',', '.'),
            PricingRule::KIND_BUY_X_GET_Y => 'Buy X Get Y',
            default => $this->standardDiscountLabel($rule),
        };
    }

    private function applySameProductBuyGetRewardNormalization(
        Collection $carts,
        Collection $rules
    ): Collection {
        $processedKeys = [];

        foreach ($rules as $rule) {
            if (! $rule instanceof PricingRule || $rule->kind !== PricingRule::KIND_BUY_X_GET_Y) {
                continue;
            }

            $buyItems = $rule->buyGetItems
                ->where('role', PricingRuleBuyGetItem::ROLE_BUY)
                ->values();
            $getItems = $rule->buyGetItems
                ->where('role', PricingRuleBuyGetItem::ROLE_GET)
                ->values();

            if ($buyItems->count() !== 1 || $getItems->count() !== 1) {
                continue;
            }

            $buyItem = $buyItems->first();
            $rewardItem = $getItems->first();
            $buyProductId = (int) ($buyItem?->product_id ?? 0);
            $rewardProductId = (int) ($rewardItem?->product_id ?? 0);

            if ($buyProductId <= 0 || $rewardProductId <= 0 || $buyProductId !== $rewardProductId) {
                continue;
            }

            $ruleName = $rule->name ?: $this->ruleLabel($rule);
            $processedKey = $rule->id.':'.$buyProductId;
            if (isset($processedKeys[$processedKey])) {
                continue;
            }

            $processedKeys[$processedKey] = true;

            $matchingCarts = $carts
                ->filter(fn (Cart $cart) => (int) $cart->product_id === $buyProductId)
                ->values();

            if ($matchingCarts->isEmpty()) {
                continue;
            }

            $totalQty = (int) $matchingCarts->sum('qty');
            $buyQty = max(1, (int) ($buyItem?->quantity ?? 1));
            $rewardQty = max(1, (int) ($rewardItem?->quantity ?? 1));
            $cycleSize = $buyQty + $rewardQty;
            $desiredRewardQty = (int) floor($totalQty / $cycleSize) * $rewardQty;
            $remainingRewardQty = $desiredRewardQty;
            $rewardLabel = $rewardItem?->product?->title ?: $rewardItem?->product_title ?: 'Item bonus';

            $orderedRows = $matchingCarts
                ->sort(function (Cart $left, Cart $right) use ($ruleName) {
                    $leftIsReward = (bool) ($left->is_promo_reward ?? false)
                        || (string) ($left->promo_reward_rule_name ?? '') === $ruleName;
                    $rightIsReward = (bool) ($right->is_promo_reward ?? false)
                        || (string) ($right->promo_reward_rule_name ?? '') === $ruleName;

                    if ($leftIsReward !== $rightIsReward) {
                        return $leftIsReward ? -1 : 1;
                    }

                    $qtyCompare = (int) $left->qty <=> (int) $right->qty;
                    if ($qtyCompare !== 0) {
                        return $qtyCompare;
                    }

                    return (int) $left->id <=> (int) $right->id;
                })
                ->values();

            foreach ($orderedRows as $cart) {
                $rowQty = max(1, (int) $cart->qty);

                if ($rowQty <= $remainingRewardQty) {
                    $cart->setAttribute('is_promo_reward', true);
                    $cart->setAttribute('promo_reward_rule_name', $ruleName);
                    $cart->setAttribute('promo_reward_label', $rewardLabel);
                    $remainingRewardQty -= $rowQty;
                    continue;
                }

                $cart->setAttribute('is_promo_reward', false);
                $cart->setAttribute('promo_reward_rule_name', null);
                $cart->setAttribute('promo_reward_label', null);
            }
        }

        return $carts;
    }

    private function buildPreview(Collection $carts, ?Customer $customer, Collection $rules, ?int $outletId = null): array
    {
        $items = $carts->map(function (Cart $cart) {
            $components = $this->productPricingComponents($cart->product, (int) $cart->qty);
            $modifierTotal = (int) $cart->modifiers->sum('total_price');

            return [
                'cart_id' => $cart->id,
                'product_id' => $cart->product_id,
                'product_title' => $cart->product?->title,
                'qty' => (int) $cart->qty,
                'base_unit_price' => (int) $components['customer_base_unit_price'],
                'customer_base_unit_price' => (int) $components['customer_base_unit_price'],
                'tenant_base_unit_price' => (int) $components['tenant_base_unit_price'],
                'owner_markup_unit_price' => (int) $components['owner_markup_unit_price'],
                'effective_unit_price' => (int) $components['customer_base_unit_price'],
                'line_base_total' => (int) $components['customer_base_total'] + $modifierTotal,
                'line_total' => (int) $components['customer_base_total'],
                'line_discount_total' => 0,
                'modifier_total' => $modifierTotal,
                'base_product_total' => (int) $components['customer_base_total'],
                'tenant_base_total' => (int) $components['tenant_base_total'],
                'owner_base_total' => (int) $components['owner_base_total'],
                'tenant_discount_total' => 0,
                'owner_discount_total' => 0,
                'tenant_net_total' => (int) $components['tenant_base_total'],
                'owner_net_total' => (int) $components['owner_base_total'],
                'pricing_rule' => null,
                'pricing_group_key' => null,
                'pricing_group_label' => null,
                'applied_rules' => [],
                'is_promo_reward' => (bool) ($cart->is_promo_reward ?? false),
            ];
        })->keyBy('cart_id');

        $remainingQuantities = $items
            ->mapWithKeys(fn (array $item, int|string $cartId) => [(int) $cartId => (int) $item['qty']])
            ->all();

        $eligibleRules = $rules
            ->filter(fn (PricingRule $rule) => $this->matchesCustomerScope($rule, $customer, $outletId))
            ->values();

        $appliedGroups = [];

        $bundleRules = $eligibleRules
            ->filter(fn (PricingRule $rule) => $rule->kind === PricingRule::KIND_BUNDLE_PRICE)
            ->values();
        $appliedGroups = array_merge(
            $appliedGroups,
            $this->applyComplexStage($bundleRules, $items, $remainingQuantities, 'bundle')
        );

        $buyGetRules = $eligibleRules
            ->filter(fn (PricingRule $rule) => $rule->kind === PricingRule::KIND_BUY_X_GET_Y)
            ->values();
        $appliedGroups = array_merge(
            $appliedGroups,
            $this->applyComplexStage($buyGetRules, $items, $remainingQuantities, 'buy_get')
        );

        foreach ($items as $cartId => $item) {
            $remainingQty = max(0, (int) ($remainingQuantities[$cartId] ?? 0));
            if ($remainingQty === 0) {
                continue;
            }

            $cartProduct = $carts->firstWhere('id', $cartId)?->product;
            if (! $cartProduct) {
                continue;
            }

            $candidate = $eligibleRules
                ->filter(fn (PricingRule $rule) => in_array($rule->kind, [
                    PricingRule::KIND_QTY_BREAK,
                    PricingRule::KIND_STANDARD_DISCOUNT,
                ], true))
                ->map(fn (PricingRule $rule) => $this->calculateLineCandidate($rule, $cartProduct, $remainingQty))
                ->filter()
                ->sortBy([
                    ['rule.priority', 'desc'],
                    ['line_discount', 'desc'],
                    ['rule.id', 'asc'],
                ])
                ->first();

            if (! $candidate || (int) $candidate['line_discount'] <= 0) {
                continue;
            }

            $currentItem = $items->get($cartId);
            $currentItem['line_total'] -= (int) $candidate['line_discount'];
            $currentItem['line_discount_total'] += (int) $candidate['line_discount'];
            $currentItem['tenant_discount_total'] += (int) $candidate['tenant_discount_total'];
            $currentItem['owner_discount_total'] += (int) $candidate['owner_discount_total'];
            $currentItem['tenant_net_total'] = max(0, (int) $currentItem['tenant_base_total'] - (int) $currentItem['tenant_discount_total']);
            $currentItem['owner_net_total'] = max(0, (int) $currentItem['owner_base_total'] - (int) $currentItem['owner_discount_total']);
            $currentItem['pricing_rule'] = $this->serializeRule($candidate['rule']);
            $currentItem['applied_rules'][] = $this->serializeRule($candidate['rule']);
            $currentItem['pricing_group_key'] ??= 'rule-'.$candidate['rule']->id;
            $currentItem['pricing_group_label'] ??= $candidate['rule']->name;
            $items->put($cartId, $currentItem);
        }

        $items = $items->map(function (array $item) {
            $lineTotal = max(0, (int) $item['line_total']);
            $modifierTotal = max(0, (int) ($item['modifier_total'] ?? 0));
            $lineTotal += $modifierTotal;
            $item['line_total'] = $lineTotal;
            $item['line_discount_total'] = max(0, (int) $item['line_discount_total']);
            $item['owner_base_total'] = max(0, (int) $item['owner_base_total']) + $modifierTotal;
            $item['owner_net_total'] = max(0, (int) $item['owner_net_total']) + $modifierTotal;
            $item['effective_unit_price'] = (int) round($lineTotal / max(1, (int) $item['qty']));

            return $item;
        })->values();

        $baseSubtotal = (int) $items->sum('line_base_total');
        $promoDiscountTotal = (int) $items->sum('line_discount_total');
        $tenantDiscountTotal = (int) $items->sum('tenant_discount_total');
        $ownerDiscountTotal = (int) $items->sum('owner_discount_total');
        $subtotalAfterPromo = max(0, $baseSubtotal - $promoDiscountTotal);

        return [
            'items' => $items->all(),
            'applied_groups' => array_values($appliedGroups),
            'consumed_quantities' => collect($remainingQuantities)
                ->mapWithKeys(function (int $qty, int $cartId) use ($items) {
                    $original = (int) collect($items)->firstWhere('cart_id', $cartId)['qty'];

                    return [$cartId => max(0, $original - $qty)];
                })
                ->all(),
            'unmatched_items' => collect($remainingQuantities)
                ->filter(fn (int $qty) => $qty > 0)
                ->mapWithKeys(fn (int $qty, int $cartId) => [$cartId => $qty])
                ->all(),
            'summary' => [
                'base_subtotal' => $baseSubtotal,
                'promo_discount_total' => $promoDiscountTotal,
                'tenant_discount_total' => $tenantDiscountTotal,
                'owner_discount_total' => $ownerDiscountTotal,
                'subtotal_after_promo' => $subtotalAfterPromo,
            ],
        ];
    }

    private function applyComplexStage(
        Collection $rules,
        Collection &$items,
        array &$remainingQuantities,
        string $stage
    ): array {
        $groups = [];

        while (true) {
            $candidates = $rules
                ->map(function (PricingRule $rule) use ($items, $remainingQuantities, $stage) {
                    return $stage === 'bundle'
                        ? $this->buildBundleCandidate($rule, $items, $remainingQuantities)
                        : $this->buildBuyGetCandidate($rule, $items, $remainingQuantities);
                })
                ->filter()
                ->sortBy([
                    ['priority', 'desc'],
                    ['discount_total', 'desc'],
                    ['rule_id', 'asc'],
                ])
                ->values();

            $candidate = $candidates->first();
            if (! $candidate) {
                break;
            }

            foreach ($candidate['participants'] as $participant) {
                $cartId = (int) $participant['cart_id'];
                $consumeQty = (int) $participant['quantity'];
                $remainingQuantities[$cartId] = max(0, (int) ($remainingQuantities[$cartId] ?? 0) - $consumeQty);

                $currentItem = $items->get($cartId);
                $currentItem['line_total'] -= (int) $participant['discount_total'];
                $currentItem['line_discount_total'] += (int) $participant['discount_total'];
                $currentItem['tenant_discount_total'] += (int) ($participant['tenant_discount_total'] ?? 0);
                $currentItem['owner_discount_total'] += (int) ($participant['owner_discount_total'] ?? 0);
                $currentItem['tenant_net_total'] = max(0, (int) $currentItem['tenant_base_total'] - (int) $currentItem['tenant_discount_total']);
                $currentItem['owner_net_total'] = max(0, (int) $currentItem['owner_base_total'] - (int) $currentItem['owner_discount_total']);
                $currentItem['pricing_group_key'] = $candidate['group_key'];
                $currentItem['pricing_group_label'] = $candidate['group_label'];
                $currentItem['pricing_rule'] = $this->serializeRule($candidate['rule']);
                $currentItem['applied_rules'][] = $this->serializeRule($candidate['rule']);
                $items->put($cartId, $currentItem);
            }

            $groups[] = [
                'key' => $candidate['group_key'],
                'label' => $candidate['group_label'],
                'rule' => $this->serializeRule($candidate['rule']),
                'discount_total' => (int) $candidate['discount_total'],
                'participants' => $candidate['participants'],
            ];
        }

        return $groups;
    }

    private function buildBundleCandidate(PricingRule $rule, Collection $items, array $remainingQuantities): ?array
    {
        if ($rule->bundleItems->isEmpty()) {
            return null;
        }

        $participants = [];
        $baseTotal = 0;
        $tempRemaining = $remainingQuantities;

        foreach ($rule->bundleItems as $bundleItem) {
            $matched = $this->consumeMatchingItems(
                $items,
                $tempRemaining,
                fn (array $item) => (int) $item['product_id'] === (int) $bundleItem->product_id,
                (int) $bundleItem->quantity
            );

            if ($matched === null) {
                return null;
            }

            $participants = array_merge(
                $participants,
                array_map(function (array $participant) use ($rule) {
                    $participant['basis_total'] = $this->participantBasisTotal($rule, $participant);

                    return $participant;
                }, $matched)
            );
        }

        foreach ($participants as $participant) {
            $baseTotal += (int) $participant['basis_total'];
        }

        $bundlePrice = (int) round((float) $rule->discount_value);
        if ($bundlePrice >= $baseTotal) {
            return null;
        }

        $allocations = $this->allocateDiscount(
            $participants,
            $baseTotal - $bundlePrice,
            'basis_total'
        );
        $allocations = array_map(
            fn (array $participant) => $this->applyParticipantDiscountSplit($participant, $rule, (int) $participant['discount_total']),
            $allocations
        );

        return [
            'rule' => $rule,
            'rule_id' => (int) $rule->id,
            'priority' => (int) $rule->priority,
            'group_key' => 'bundle-'.$rule->id.'-'.str()->uuid(),
            'group_label' => $rule->name,
            'discount_total' => $baseTotal - $bundlePrice,
            'participants' => $allocations,
        ];
    }

    private function buildBuyGetCandidate(PricingRule $rule, Collection $items, array $remainingQuantities): ?array
    {
        $buyItems = $rule->buyGetItems
            ->where('role', PricingRuleBuyGetItem::ROLE_BUY)
            ->values();
        $getItems = $rule->buyGetItems
            ->where('role', PricingRuleBuyGetItem::ROLE_GET)
            ->values();

        if ($buyItems->isEmpty() || $getItems->isEmpty()) {
            return null;
        }

        $participants = [];
        $tempRemaining = $remainingQuantities;

        foreach ($buyItems as $buyItem) {
            $matched = $this->consumeMatchingItems(
                $items,
                $tempRemaining,
                fn (array $item) => (int) $item['product_id'] === (int) $buyItem->product_id
                    && ! (bool) ($item['is_promo_reward'] ?? false),
                (int) $buyItem->quantity
            );

            if ($matched === null) {
                return null;
            }

            foreach ($matched as $match) {
                $match['basis_total'] = $this->participantBasisTotal($rule, $match);
                $match['discount_total'] = 0;
                $match['tenant_discount_total'] = 0;
                $match['owner_discount_total'] = 0;
                $participants[] = $match;
            }
        }

        $rewardParticipants = [];
        foreach ($getItems as $getItem) {
            $matched = $this->consumeMatchingItems(
                $items,
                $tempRemaining,
                fn (array $item) => (int) $item['product_id'] === (int) $getItem->product_id
                    && (bool) ($item['is_promo_reward'] ?? false),
                (int) $getItem->quantity
            );

            if ($matched === null) {
                return null;
            }

            foreach ($matched as $match) {
                $match['basis_total'] = $this->participantBasisTotal($rule, $match);
                // Reward item must be free for the customer, regardless of internal price basis.
                $basisDiscount = (int) ($match['base_total'] ?? 0);
                $discounted = $this->applyParticipantDiscountSplit(
                    $match,
                    $rule,
                    $basisDiscount,
                    PricingRule::PRICE_BASIS_SELL_PRICE
                );
                $rewardParticipants[] = $discounted;
                $participants[] = $discounted;
            }
        }

        $discountTotal = (int) collect($rewardParticipants)->sum('discount_total');
        if ($discountTotal <= 0) {
            return null;
        }

        return [
            'rule' => $rule,
            'rule_id' => (int) $rule->id,
            'priority' => (int) $rule->priority,
            'group_key' => 'bxgy-'.$rule->id.'-'.str()->uuid(),
            'group_label' => $rule->name,
            'discount_total' => $discountTotal,
            'participants' => $participants,
        ];
    }

    private function consumeMatchingItems(
        Collection $items,
        array &$remainingQuantities,
        callable $matcher,
        int $requiredQuantity
    ): ?array {
        $required = max(1, $requiredQuantity);
        $matches = [];

        foreach ($items as $cartId => $item) {
            if ($required <= 0) {
                break;
            }

            if (! $matcher($item)) {
                continue;
            }

            $availableQty = (int) ($remainingQuantities[$cartId] ?? 0);
            if ($availableQty <= 0) {
                continue;
            }

            $take = min($availableQty, $required);
            $matches[] = [
                'cart_id' => (int) $cartId,
                'product_id' => (int) $item['product_id'],
                'product_title' => $item['product_title'],
                'quantity' => $take,
                'base_total' => (int) $item['base_unit_price'] * $take,
                'tenant_base_total' => (int) $item['tenant_base_unit_price'] * $take,
                'owner_base_total' => (int) $item['owner_markup_unit_price'] * $take,
            ];
            $remainingQuantities[$cartId] = max(0, $availableQty - $take);
            $required -= $take;
        }

        return $required === 0 ? $matches : null;
    }

    private function allocateDiscount(array $participants, int $discountTotal, string $weightKey = 'base_total'): array
    {
        $baseTotal = max(1, (int) collect($participants)->sum($weightKey));
        $allocated = [];
        $running = 0;
        $lastIndex = array_key_last($participants);

        foreach ($participants as $index => $participant) {
            $share = $index === $lastIndex
                ? $discountTotal - $running
                : (int) floor($discountTotal * ((int) $participant[$weightKey] / $baseTotal));
            $share = max(0, min((int) $participant[$weightKey], $share));
            $running += $share;
            $participant['discount_total'] = $share;
            $allocated[] = $participant;
        }

        return $allocated;
    }

    private function calculateLineCandidate(PricingRule $rule, Product $product, int $quantity): ?array
    {
        if (! $this->matchesTarget($rule, $product)) {
            return null;
        }

        $components = $this->productPricingComponents($product, $quantity);
        $basisUnitPrice = $this->resolveBaseUnitPrice($product, $rule);
        $lineBaseTotal = (int) $components['customer_base_total'];

        if ($rule->kind === PricingRule::KIND_QTY_BREAK) {
            $break = $rule->qtyBreaks
                ->filter(fn (PricingRuleQtyBreak $break) => $quantity >= (int) $break->min_qty)
                ->sortBy([
                    ['min_qty', 'desc'],
                    ['sort_order', 'asc'],
                    ['id', 'asc'],
                ])
                ->first();

            if (! $break) {
                return null;
            }

            $discount = $this->resolveLineDiscount(
                $break->discount_type,
                (float) $break->discount_value,
                $basisUnitPrice,
                $quantity
            );
            ['tenant_discount_total' => $tenantDiscountTotal, 'owner_discount_total' => $ownerDiscountTotal] = $this->splitDiscountBetweenTenantAndOwner(
                $rule,
                $discount,
                (int) $components['tenant_base_total'],
                (int) $components['owner_base_total']
            );

            return [
                'rule' => $rule,
                'quantity' => $quantity,
                'base_unit_price' => (int) $components['customer_base_unit_price'],
                'line_base_total' => $lineBaseTotal,
                'line_total' => max(0, $lineBaseTotal - $discount),
                'line_discount' => $discount,
                'tenant_discount_total' => $tenantDiscountTotal,
                'owner_discount_total' => $ownerDiscountTotal,
            ];
        }

        $discount = $this->resolveLineDiscount(
            $rule->discount_type,
            (float) $rule->discount_value,
            $basisUnitPrice,
            $quantity
        );
        ['tenant_discount_total' => $tenantDiscountTotal, 'owner_discount_total' => $ownerDiscountTotal] = $this->splitDiscountBetweenTenantAndOwner(
            $rule,
            $discount,
            (int) $components['tenant_base_total'],
            (int) $components['owner_base_total']
        );

        return [
            'rule' => $rule,
            'quantity' => $quantity,
            'base_unit_price' => (int) $components['customer_base_unit_price'],
            'line_base_total' => $lineBaseTotal,
            'line_total' => max(0, $lineBaseTotal - $discount),
            'line_discount' => $discount,
            'tenant_discount_total' => $tenantDiscountTotal,
            'owner_discount_total' => $ownerDiscountTotal,
        ];
    }

    private function productPricingComponents(Product $product, int $quantity): array
    {
        $qty = max(1, $quantity);
        $tenantHppUnitPrice = (int) ($product->tenant_hpp_price ?? $product->buy_price ?? 0);
        $tenantBaseUnitPrice = (int) ($product->buy_price ?? 0);
        $customerBaseUnitPrice = (int) ($product->sell_price ?? 0);
        $ownerMarkupUnitPrice = max(0, $customerBaseUnitPrice - $tenantBaseUnitPrice);
        $tenantMarginUnitPrice = max(0, $tenantBaseUnitPrice - $tenantHppUnitPrice);

        return [
            'tenant_hpp_unit_price' => $tenantHppUnitPrice,
            'customer_base_unit_price' => $customerBaseUnitPrice,
            'tenant_base_unit_price' => $tenantBaseUnitPrice,
            'tenant_margin_unit_price' => $tenantMarginUnitPrice,
            'owner_markup_unit_price' => $ownerMarkupUnitPrice,
            'customer_base_total' => $customerBaseUnitPrice * $qty,
            'tenant_hpp_total' => $tenantHppUnitPrice * $qty,
            'tenant_base_total' => $tenantBaseUnitPrice * $qty,
            'tenant_margin_total' => $tenantMarginUnitPrice * $qty,
            'owner_base_total' => $ownerMarkupUnitPrice * $qty,
        ];
    }

    private function rulePriceBasis(PricingRule $rule): string
    {
        return $rule->price_basis ?: PricingRule::PRICE_BASIS_SELL_PRICE;
    }

    private function participantBasisTotal(PricingRule $rule, array $participant): int
    {
        return $this->rulePriceBasis($rule) === PricingRule::PRICE_BASIS_BUY_PRICE
            ? (int) ($participant['tenant_base_total'] ?? 0)
            : (int) ($participant['base_total'] ?? 0);
    }

    private function applyParticipantDiscountSplit(
        array $participant,
        PricingRule $rule,
        int $discountTotal,
        ?string $priceBasisOverride = null
    ): array
    {
        ['tenant_discount_total' => $tenantDiscountTotal, 'owner_discount_total' => $ownerDiscountTotal] = $this->splitDiscountBetweenTenantAndOwner(
            $rule,
            $discountTotal,
            (int) ($participant['tenant_base_total'] ?? 0),
            (int) ($participant['owner_base_total'] ?? 0),
            $priceBasisOverride
        );

        $participant['discount_total'] = $discountTotal;
        $participant['tenant_discount_total'] = $tenantDiscountTotal;
        $participant['owner_discount_total'] = $ownerDiscountTotal;

        return $participant;
    }

    private function splitDiscountBetweenTenantAndOwner(
        PricingRule $rule,
        int $discountTotal,
        int $tenantBaseTotal,
        int $ownerBaseTotal,
        ?string $priceBasisOverride = null
    ): array {
        $discount = max(0, $discountTotal);
        $tenantBase = max(0, $tenantBaseTotal);
        $ownerBase = max(0, $ownerBaseTotal);

        if ($discount <= 0) {
            return [
                'tenant_discount_total' => 0,
                'owner_discount_total' => 0,
            ];
        }

        $priceBasis = $priceBasisOverride ?: $this->rulePriceBasis($rule);

        if ($priceBasis === PricingRule::PRICE_BASIS_BUY_PRICE) {
            return [
                'tenant_discount_total' => min($tenantBase, $discount),
                'owner_discount_total' => 0,
            ];
        }

        $combinedBase = max(1, $tenantBase + $ownerBase);
        $tenantShare = $ownerBase <= 0
            ? $discount
            : (int) floor($discount * ($tenantBase / $combinedBase));
        $tenantShare = max(0, min($tenantBase, $tenantShare));
        $ownerShare = max(0, min($ownerBase, $discount - $tenantShare));

        if (($tenantShare + $ownerShare) < $discount) {
            $remaining = $discount - ($tenantShare + $ownerShare);
            if ($ownerBase - $ownerShare >= $remaining) {
                $ownerShare += $remaining;
            } else {
                $tenantShare = min($tenantBase, $tenantShare + $remaining);
            }
        }

        return [
            'tenant_discount_total' => $tenantShare,
            'owner_discount_total' => $ownerShare,
        ];
    }

    private function matchesCustomerScope(PricingRule $rule, ?Customer $customer, ?int $outletId = null): bool
    {
        return match ($rule->customer_scope) {
            PricingRule::SCOPE_ALL => true,
            PricingRule::SCOPE_WALK_IN => $customer === null,
            PricingRule::SCOPE_REGISTERED => $customer !== null,
            PricingRule::SCOPE_MEMBER => $this->matchesMemberRule($rule, $customer, $outletId),
            default => false,
        };
    }

    private function matchesMemberRule(PricingRule $rule, ?Customer $customer, ?int $outletId = null): bool
    {
        if (! $customer || ! $customer->is_loyalty_member) {
            return false;
        }

        $eligibleTiers = collect($rule->eligible_loyalty_tiers ?? [])
            ->filter()
            ->values();

        if ($eligibleTiers->isEmpty()) {
            return true;
        }

        return $eligibleTiers->contains($this->loyaltyService->resolvedTier($customer, $outletId));
    }

    private function matchesTarget(PricingRule $rule, Product $product): bool
    {
        return match ($rule->target_type) {
            PricingRule::TARGET_ALL => true,
            PricingRule::TARGET_PRODUCT => (int) $rule->product_id === (int) $product->id,
            PricingRule::TARGET_CATEGORY => (int) $rule->category_id === (int) $product->category_id,
            default => false,
        };
    }

    private function resolveLineDiscount(
        string $discountType,
        float $discountValue,
        int $baseUnitPrice,
        int $quantity
    ): int {
        $lineBaseTotal = $baseUnitPrice * $quantity;

        $discount = match ($discountType) {
            PricingRule::TYPE_PERCENTAGE => (int) round($lineBaseTotal * ($discountValue / 100)),
            PricingRule::TYPE_FIXED_AMOUNT => (int) round($discountValue) * $quantity,
            PricingRule::TYPE_FIXED_PRICE => max(0, $lineBaseTotal - ((int) round($discountValue) * $quantity)),
            default => 0,
        };

        return min($lineBaseTotal, max(0, $discount));
    }

    private function serializeRule(PricingRule $rule, bool $includePriceContext = true): array
    {
        $buyItems = $rule->relationLoaded('buyGetItems')
            ? $rule->buyGetItems
            : collect();

        $buyQty = $buyItems
            ->where('role', PricingRuleBuyGetItem::ROLE_BUY)
            ->sum('quantity');
        $getQty = $buyItems
            ->where('role', PricingRuleBuyGetItem::ROLE_GET)
            ->sum('quantity');
        $buyRows = $buyItems
            ->where('role', PricingRuleBuyGetItem::ROLE_BUY)
            ->map(fn (PricingRuleBuyGetItem $item) => [
                'product_id' => (int) $item->product_id,
                'product_title' => $item->product?->title ?? 'item',
                'quantity' => (int) $item->quantity,
            ])
            ->values()
            ->all();
        $getRows = $buyItems
            ->where('role', PricingRuleBuyGetItem::ROLE_GET)
            ->map(fn (PricingRuleBuyGetItem $item) => [
                'product_id' => (int) $item->product_id,
                'product_title' => $item->product?->title ?? 'item',
                'quantity' => (int) $item->quantity,
            ])
            ->values()
            ->all();

        return [
            'id' => $rule->id,
            'name' => $rule->name,
            'kind' => $rule->kind,
            'label' => $this->ruleLabel($rule),
            'detail' => $this->ruleDetail($rule),
            'minimum_quantity' => $rule->kind === PricingRule::KIND_QTY_BREAK
                ? (int) max(1, $rule->qtyBreaks->min('min_qty') ?: 1)
                : 1,
            'preview_quantity' => max(1, (int) ($rule->preview_quantity_multiplier ?: 1)),
            'priority' => (int) $rule->priority,
            'target_type' => $rule->target_type,
            'customer_scope' => $rule->customer_scope,
            'eligible_loyalty_tiers' => $rule->eligible_loyalty_tiers,
            'price_basis' => $rule->price_basis ?: PricingRule::PRICE_BASIS_SELL_PRICE,
            'price_context' => $includePriceContext,
            'buy_qty' => (int) max(1, $buyQty),
            'free_qty' => (int) max(1, $getQty),
            'buy_items' => $buyRows,
            'get_items' => $getRows,
        ];
    }

    private function standardDiscountLabel(PricingRule $rule): string
    {
        return match ($rule->discount_type) {
            PricingRule::TYPE_PERCENTAGE => rtrim(rtrim(number_format((float) $rule->discount_value, 2, '.', ''), '0'), '.').'% OFF',
            PricingRule::TYPE_FIXED_AMOUNT => 'Hemat Rp '.number_format((float) $rule->discount_value, 0, ',', '.'),
            PricingRule::TYPE_FIXED_PRICE => 'Harga Rp '.number_format((float) $rule->discount_value, 0, ',', '.'),
            default => $rule->name,
        };
    }

    private function ruleDetail(PricingRule $rule): string
    {
        return match ($rule->kind) {
            PricingRule::KIND_QTY_BREAK => $this->qtyBreakRuleDetail($rule),
            PricingRule::KIND_BUNDLE_PRICE => $this->bundleRuleDetail($rule),
            PricingRule::KIND_BUY_X_GET_Y => $this->buyGetRuleDetail($rule),
            default => $this->standardRuleDetail($rule),
        };
    }

    private function standardRuleDetail(PricingRule $rule): string
    {
        return match ($rule->discount_type) {
            PricingRule::TYPE_PERCENTAGE => 'Diskon '.rtrim(rtrim(number_format((float) $rule->discount_value, 2, '.', ''), '0'), '.').'% untuk item ini.',
            PricingRule::TYPE_FIXED_AMOUNT => 'Potongan Rp '.number_format((float) $rule->discount_value, 0, ',', '.').' per item.',
            PricingRule::TYPE_FIXED_PRICE => 'Harga promo jadi Rp '.number_format((float) $rule->discount_value, 0, ',', '.').'.',
            default => $rule->name,
        };
    }

    private function qtyBreakRuleDetail(PricingRule $rule): string
    {
        $parts = $rule->qtyBreaks
            ->map(function (PricingRuleQtyBreak $break) {
                $label = match ($break->discount_type) {
                    PricingRule::TYPE_PERCENTAGE => 'diskon '.rtrim(rtrim(number_format((float) $break->discount_value, 2, '.', ''), '0'), '.').'%',
                    PricingRule::TYPE_FIXED_AMOUNT => 'hemat Rp '.number_format((float) $break->discount_value, 0, ',', '.'),
                    PricingRule::TYPE_FIXED_PRICE => 'harga jadi Rp '.number_format((float) $break->discount_value, 0, ',', '.'),
                    default => null,
                };

                if (! $label) {
                    return null;
                }

                return 'beli '.$break->min_qty.' '.$label;
            })
            ->filter()
            ->values();

        if ($parts->isEmpty()) {
            return 'Promo grosir berdasarkan jumlah pembelian.';
        }

        return ucfirst($parts->implode(', ')).'.';
    }

    private function bundleRuleDetail(PricingRule $rule): string
    {
        $items = $rule->bundleItems
            ->map(fn ($item) => ($item->quantity > 1 ? $item->quantity.'x ' : '').($item->product?->title ?? 'item'))
            ->filter()
            ->values();

        if ($items->isEmpty()) {
            return 'Promo paket harga khusus.';
        }

        return 'Paket '.implode(' + ', $items->all()).' jadi Rp '.number_format((float) $rule->discount_value, 0, ',', '.').'.';
    }

    private function buyGetRuleDetail(PricingRule $rule): string
    {
        $buyItems = $rule->buyGetItems
            ->where('role', PricingRuleBuyGetItem::ROLE_BUY)
            ->map(fn ($item) => ($item->quantity > 1 ? $item->quantity.'x ' : '').($item->product?->title ?? 'item'))
            ->filter()
            ->values();
        $getItems = $rule->buyGetItems
            ->where('role', PricingRuleBuyGetItem::ROLE_GET)
            ->map(fn ($item) => ($item->quantity > 1 ? $item->quantity.'x ' : '').($item->product?->title ?? 'item'))
            ->filter()
            ->values();

        if ($buyItems->isEmpty() || $getItems->isEmpty()) {
            return 'Buy one get one / buy x get y.';
        }

        return 'Beli '.implode(' + ', $buyItems->all()).', gratis '.implode(' + ', $getItems->all()).'.';
    }

    private function matchesRecurringSchedule(PricingRule $rule, CarbonInterface $at): bool
    {
        $activeDays = collect($rule->active_days ?? [])
            ->filter()
            ->values();

        if ($activeDays->isNotEmpty()) {
            $dayMap = [
                Carbon::SUNDAY => PricingRule::DAY_SUNDAY,
                Carbon::MONDAY => PricingRule::DAY_MONDAY,
                Carbon::TUESDAY => PricingRule::DAY_TUESDAY,
                Carbon::WEDNESDAY => PricingRule::DAY_WEDNESDAY,
                Carbon::THURSDAY => PricingRule::DAY_THURSDAY,
                Carbon::FRIDAY => PricingRule::DAY_FRIDAY,
                Carbon::SATURDAY => PricingRule::DAY_SATURDAY,
            ];

            $currentDay = $dayMap[$at->dayOfWeek] ?? null;

            if (! $currentDay || ! $activeDays->contains($currentDay)) {
                return false;
            }
        }

        $startTime = $rule->daily_start_time;
        $endTime = $rule->daily_end_time;

        if (! $startTime && ! $endTime) {
            return true;
        }

        $currentTime = $at->format('H:i:s');
        $normalizedStart = $startTime ? substr((string) $startTime, 0, 8) : null;
        $normalizedEnd = $endTime ? substr((string) $endTime, 0, 8) : null;

        if ($normalizedStart && $normalizedEnd) {
            if ($normalizedStart <= $normalizedEnd) {
                return $currentTime >= $normalizedStart && $currentTime <= $normalizedEnd;
            }

            return $currentTime >= $normalizedStart || $currentTime <= $normalizedEnd;
        }

        if ($normalizedStart) {
            return $currentTime >= $normalizedStart;
        }

        return $normalizedEnd ? $currentTime <= $normalizedEnd : true;
    }

    private function ruleTouchesProduct(PricingRule $rule, Product $product): bool
    {
        if ($this->matchesTarget($rule, $product)) {
            return true;
        }

        if ($rule->kind === PricingRule::KIND_BUNDLE_PRICE) {
            return $rule->bundleItems->contains(fn ($item) => (int) $item->product_id === (int) $product->id);
        }

        if ($rule->kind === PricingRule::KIND_BUY_X_GET_Y) {
            return $rule->buyGetItems->contains(fn ($item) => (int) $item->product_id === (int) $product->id);
        }

        return false;
    }

    private function resolveBaseUnitPrice(Product $product, ?PricingRule $rule): int
    {
        $priceBasis = $rule?->price_basis ?: PricingRule::PRICE_BASIS_SELL_PRICE;

        return match ($priceBasis) {
            PricingRule::PRICE_BASIS_BUY_PRICE => (int) ($product->buy_price ?? 0),
            default => (int) ($product->sell_price ?? 0),
        };
    }

    private function buildPreviewCartsForRule(PricingRule $rule): Collection
    {
        return match ($rule->kind) {
            PricingRule::KIND_BUNDLE_PRICE => $this->buildRelationPreviewCarts(
                $rule->bundleItems,
                'product_id',
                'quantity'
            ),
            PricingRule::KIND_BUY_X_GET_Y => $this->buildRelationPreviewCarts(
                $rule->buyGetItems,
                'product_id',
                'quantity'
            ),
            default => $this->buildTargetPreviewCarts($rule),
        };
    }

    private function buildRelationPreviewCarts(
        Collection $rows,
        string $productKey = 'product_id',
        string $quantityKey = 'quantity'
    ): Collection {
        $products = Product::query()
            ->whereIn('id', $rows->pluck($productKey)->filter()->map(fn ($id) => (int) $id)->all())
            ->get()
            ->keyBy('id');

        return $rows
            ->values()
            ->map(function ($row, int $index) use ($products, $productKey, $quantityKey) {
                $productId = (int) data_get($row, $productKey);
                $product = data_get($row, 'product') ?: $products->get($productId);

                if (! $product) {
                    return null;
                }

                return $this->makePreviewCart(
                    $product,
                    max(1, (int) data_get($row, $quantityKey, 1)),
                    $index,
                    data_get($row, 'role') === PricingRuleBuyGetItem::ROLE_GET
                );
            })
            ->filter()
            ->values();
    }

    private function buildTargetPreviewCarts(PricingRule $rule): Collection
    {
        $products = match ($rule->target_type) {
            PricingRule::TARGET_PRODUCT => Product::query()
                ->whereKey($rule->product_id)
                ->get(),
            PricingRule::TARGET_CATEGORY => Product::query()
                ->where('category_id', $rule->category_id)
                ->orderBy('title')
                ->limit(3)
                ->get(),
            default => Product::query()
                ->orderBy('title')
                ->limit(3)
                ->get(),
        };

        return $products
            ->values()
            ->map(fn (Product $product, int $index) => $this->makePreviewCart(
                $product,
                $this->previewQuantityForRule($rule, $product),
                $index
            ));
    }

    private function makePreviewCart(
        Product $product,
        int $qty,
        int $index,
        bool $isPromoReward = false
    ): Cart
    {
        $quantity = max(1, $qty);
        $cart = new Cart([
            'product_id' => $product->id,
            'qty' => $quantity,
            'price' => (int) ($product->sell_price ?? 0) * $quantity,
            'is_promo_reward' => $isPromoReward,
        ]);
        $cart->id = -($index + 1);
        $cart->setRelation('product', $product);
        $cart->setRelation('modifiers', collect());

        return $cart;
    }

    private function previewQuantityForRule(PricingRule $rule, Product $product): int
    {
        if ($rule->kind === PricingRule::KIND_QTY_BREAK) {
            return max(1, (int) ($rule->preview_quantity_multiplier ?: $rule->qtyBreaks->max('min_qty') ?: 1));
        }

        return max(1, (int) ($rule->preview_quantity_multiplier ?: 1));
    }

    private function buildDraftDiagnostics(PricingRule $rule, Collection $carts, array $preview): array
    {
        return [
            'kind' => $rule->kind,
            'price_basis' => $rule->price_basis ?: PricingRule::PRICE_BASIS_SELL_PRICE,
            'draft_discount_value' => (float) ($rule->discount_value ?? 0),
            'cart_count' => $carts->count(),
            'cart_items' => $carts->map(fn (Cart $cart) => [
                'product_id' => (int) $cart->product_id,
                'product_title' => $cart->product?->title,
                'qty' => (int) $cart->qty,
                'sell_price' => (int) ($cart->product?->sell_price ?? 0),
                'buy_price' => (int) ($cart->product?->buy_price ?? 0),
            ])->values()->all(),
            'base_subtotal' => (int) data_get($preview, 'summary.base_subtotal', 0),
        ];
    }
}
