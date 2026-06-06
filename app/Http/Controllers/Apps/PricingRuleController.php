<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Customer;
use App\Models\PricingRule;
use App\Models\PricingRuleBundleItem;
use App\Models\PricingRuleBuyGetItem;
use App\Models\PricingRuleQtyBreak;
use App\Models\Product;
use App\Services\AuditLogService;
use App\Services\LoyaltyService;
use App\Services\OutletResolver;
use App\Services\PricingService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PricingRuleController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly LoyaltyService $loyaltyService,
        private readonly PricingService $pricingService,
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);
        $activeOutletId = $activeOutlet?->id;
        $isTenantWorkspace = (string) ($activeOutlet?->outlet_type ?? '') === 'tenant' || ($user?->isKitchenWorkspace() ?? false);

        $filters = [
            'search' => $request->input('search'),
            'status' => $request->input('status'),
            'target_type' => $request->input('target_type'),
            'kind' => $request->input('kind'),
        ];

        $rules = PricingRule::query()
            ->with(['product:id,title', 'category:id,name', 'creator:id,name', 'qtyBreaks', 'bundleItems', 'buyGetItems', 'outlet:id,name,code,outlet_type'])
            ->when(
                $activeOutletId,
                fn ($query) => $isTenantWorkspace
                    ? $query->where(function ($builder) use ($activeOutletId) {
                        $builder
                            ->where('outlet_id', $activeOutletId)
                            ->orWhere(function ($legacyBuilder) use ($activeOutletId) {
                                $legacyBuilder
                                    ->whereNull('outlet_id')
                                    ->where(function ($scopedBuilder) use ($activeOutletId) {
                                        $scopedBuilder
                                            ->whereHas('product', fn ($productQuery) => $productQuery->where('tenant_outlet_id', $activeOutletId))
                                            ->orWhere(function ($categoryBuilder) use ($activeOutletId) {
                                                $categoryBuilder
                                                    ->where('target_type', PricingRule::TARGET_CATEGORY)
                                                    ->whereHas('category.products', fn ($productQuery) => $productQuery->where('tenant_outlet_id', $activeOutletId));
                                            });
                                    });
                            });
                    })
                    : $query->where(function ($builder) use ($activeOutletId) {
                        $builder
                            ->whereNull('outlet_id')
                            ->orWhere('outlet_id', $activeOutletId);
                    })
            )
            ->when($filters['search'], function ($query, $search) {
                $query->where('name', 'like', '%'.$search.'%');
            })
            ->when($filters['status'] !== null && $filters['status'] !== '', function ($query) use ($filters) {
                match ($filters['status']) {
                    'active' => $query->where('is_active', true)
                        ->where(function ($builder) {
                            $builder->whereNull('starts_at')->orWhere('starts_at', '<=', now());
                        })
                        ->where(function ($builder) {
                            $builder->whereNull('ends_at')->orWhere('ends_at', '>=', now());
                        }),
                    'scheduled' => $query->where('is_active', true)->whereNotNull('starts_at')->where('starts_at', '>', now()),
                    'expired' => $query->whereNotNull('ends_at')->where('ends_at', '<', now()),
                    'inactive' => $query->where('is_active', false),
                    default => null,
                };
            })
            ->when($filters['target_type'], function ($query, $targetType) {
                $query->where('target_type', $targetType);
            })
            ->when($filters['kind'], function ($query, $kind) {
                $query->where('kind', $kind);
            })
            ->orderByDesc('is_active')
            ->orderByDesc('priority')
            ->orderBy('name')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (PricingRule $rule) => [
                'id' => $rule->id,
                'name' => $rule->name,
                'kind' => $rule->kind,
                'is_active' => (bool) $rule->is_active,
                'priority' => (int) $rule->priority,
                'target_type' => $rule->target_type,
                'customer_scope' => $rule->customer_scope,
                'product' => $rule->product,
                'category' => $rule->category,
                'outlet' => $rule->outlet ? [
                    'id' => $rule->outlet->id,
                    'name' => $rule->outlet->name,
                    'code' => $rule->outlet->code,
                    'outlet_type' => $rule->outlet->outlet_type,
                ] : null,
                'scope_label' => $rule->outlet
                    ? ($rule->outlet->outlet_type === 'tenant' ? 'Promo Tenant' : 'Promo Outlet Owner')
                    : 'Promo Global',
                'discount_type' => $rule->discount_type,
                'discount_value' => (float) $rule->discount_value,
                'price_basis' => $rule->price_basis ?: PricingRule::PRICE_BASIS_SELL_PRICE,
                'starts_at' => optional($rule->starts_at)?->toIso8601String(),
                'ends_at' => optional($rule->ends_at)?->toIso8601String(),
                'status_label' => $rule->currentStatusLabel(),
                'qty_breaks_count' => $rule->qtyBreaks->count(),
                'bundle_items_count' => $rule->bundleItems->count(),
                'buy_get_items_count' => $rule->buyGetItems->count(),
            ]);

        $summaryBase = PricingRule::query()
            ->when(
                $activeOutletId,
                fn ($query) => $isTenantWorkspace
                    ? $query->where(function ($builder) use ($activeOutletId) {
                        $builder
                            ->where('outlet_id', $activeOutletId)
                            ->orWhere(function ($legacyBuilder) use ($activeOutletId) {
                                $legacyBuilder
                                    ->whereNull('outlet_id')
                                    ->where(function ($scopedBuilder) use ($activeOutletId) {
                                        $scopedBuilder
                                            ->whereHas('product', fn ($productQuery) => $productQuery->where('tenant_outlet_id', $activeOutletId))
                                            ->orWhere(function ($categoryBuilder) use ($activeOutletId) {
                                                $categoryBuilder
                                                    ->where('target_type', PricingRule::TARGET_CATEGORY)
                                                    ->whereHas('category.products', fn ($productQuery) => $productQuery->where('tenant_outlet_id', $activeOutletId));
                                            });
                                    });
                            });
                    })
                    : $query->where(function ($builder) use ($activeOutletId) {
                        $builder
                            ->whereNull('outlet_id')
                            ->orWhere('outlet_id', $activeOutletId);
                    })
            )
            ->get();

        return Inertia::render('Dashboard/PricingRules/Index', [
            'rules' => $rules,
            'filters' => $filters,
            'workspace' => [
                'is_kitchen' => $user?->isKitchenWorkspace() ?? false,
                'is_tenant_workspace' => $isTenantWorkspace,
                'mode_label' => $isTenantWorkspace ? 'Promo Tenant' : 'Promo Outlet Owner',
                'active_outlet' => $activeOutlet ? [
                    'id' => $activeOutlet->id,
                    'name' => $activeOutlet->name,
                    'code' => $activeOutlet->code,
                    'outlet_type' => $activeOutlet->outlet_type,
                ] : null,
                'default_price_basis' => $isTenantWorkspace
                    ? PricingRule::PRICE_BASIS_BUY_PRICE
                    : PricingRule::PRICE_BASIS_SELL_PRICE,
            ],
            'summary' => [
                'active' => $summaryBase->filter(fn (PricingRule $rule) => $rule->currentStatusLabel() === 'active')->count(),
                'scheduled' => $summaryBase->filter(fn (PricingRule $rule) => $rule->currentStatusLabel() === 'scheduled')->count(),
                'expired' => $summaryBase->filter(fn (PricingRule $rule) => $rule->currentStatusLabel() === 'expired')->count(),
                'inactive' => $summaryBase->filter(fn (PricingRule $rule) => $rule->currentStatusLabel() === 'inactive')->count(),
            ],
            'recentAudits' => AuditLog::query()
                ->where('module', 'pricing_rules')
                ->latest('id')
                ->limit(5)
                ->get(['id', 'event', 'description', 'created_at']),
        ]);
    }

    public function create(Request $request)
    {
        return Inertia::render('Dashboard/PricingRules/Create', $this->formPayload($request));
    }

    public function store(Request $request)
    {
        $validated = $this->validateRule($request);
        $activeOutletId = $this->outletResolver->resolve($request, $request->user())?->id;

        $rule = PricingRule::create([
            ...$validated['rule'],
            'outlet_id' => $activeOutletId,
            'created_by' => $request->user()?->id,
        ]);

        $this->syncRuleRelations($rule, $validated['relations']);

        $this->auditLogService->log(
            event: 'pricing_rule.created',
            module: 'pricing_rules',
            auditable: $rule,
            description: 'Rule promo/harga dibuat.',
            after: $this->auditPayload($rule->fresh(['qtyBreaks', 'bundleItems', 'buyGetItems']))
        );

        return redirect()
            ->route('pricing-rules.index')
            ->with('success', 'Rule promo berhasil dibuat.');
    }

    public function edit(Request $request, PricingRule $pricingRule)
    {
        $pricingRule->load(['qtyBreaks', 'bundleItems', 'buyGetItems']);
        $this->assertRuleVisibleForWorkspace($request, $pricingRule);

        return Inertia::render('Dashboard/PricingRules/Edit', [
            ...$this->formPayload($request),
            'rule' => [
                ...$pricingRule->toArray(),
                'price_basis' => $pricingRule->price_basis ?: PricingRule::PRICE_BASIS_SELL_PRICE,
                'active_days' => $pricingRule->active_days ?? [],
                'daily_start_time' => $pricingRule->daily_start_time
                    ? substr((string) $pricingRule->daily_start_time, 0, 5)
                    : '',
                'daily_end_time' => $pricingRule->daily_end_time
                    ? substr((string) $pricingRule->daily_end_time, 0, 5)
                    : '',
                'qty_breaks' => $pricingRule->qtyBreaks->map(fn (PricingRuleQtyBreak $break) => [
                    'id' => $break->id,
                    'min_qty' => (int) $break->min_qty,
                    'discount_type' => $break->discount_type,
                    'discount_value' => (float) $break->discount_value,
                    'sort_order' => (int) $break->sort_order,
                ])->values()->all(),
                'bundle_items' => $pricingRule->bundleItems->map(fn (PricingRuleBundleItem $item) => [
                    'id' => $item->id,
                    'product_id' => (int) $item->product_id,
                    'quantity' => (int) $item->quantity,
                    'sort_order' => (int) $item->sort_order,
                ])->values()->all(),
                'buy_get_items' => $pricingRule->buyGetItems->map(fn (PricingRuleBuyGetItem $item) => [
                    'id' => $item->id,
                    'product_id' => (int) $item->product_id,
                    'role' => $item->role,
                    'quantity' => (int) $item->quantity,
                    'sort_order' => (int) $item->sort_order,
                ])->values()->all(),
            ],
        ]);
    }

    public function update(Request $request, PricingRule $pricingRule)
    {
        $this->assertRuleVisibleForWorkspace($request, $pricingRule);
        $before = $this->auditPayload($pricingRule->load(['qtyBreaks', 'bundleItems', 'buyGetItems']));
        $validated = $this->validateRule($request);

        $pricingRule->update($validated['rule']);
        $this->syncRuleRelations($pricingRule, $validated['relations']);

        $this->auditLogService->log(
            event: 'pricing_rule.updated',
            module: 'pricing_rules',
            auditable: $pricingRule,
            description: 'Rule promo/harga diperbarui.',
            before: $before,
            after: $this->auditPayload($pricingRule->fresh(['qtyBreaks', 'bundleItems', 'buyGetItems']))
        );

        return redirect()
            ->route('pricing-rules.index')
            ->with('success', 'Rule promo berhasil diperbarui.');
    }

    public function destroy(PricingRule $pricingRule)
    {
        $this->assertRuleVisibleForWorkspace(request(), $pricingRule);
        $before = $this->auditPayload($pricingRule->load(['qtyBreaks', 'bundleItems', 'buyGetItems']));
        $pricingRule->delete();

        $this->auditLogService->log(
            event: 'pricing_rule.deleted',
            module: 'pricing_rules',
            auditable: $pricingRule,
            description: 'Rule promo/harga dihapus.',
            before: $before
        );

        return back()->with('success', 'Rule promo berhasil dihapus.');
    }

    public function preview(Request $request)
    {
        $validated = $this->validateRule($request);
        $rule = new PricingRule($validated['rule']);
        $rule->setRelation('qtyBreaks', collect($validated['relations']['qty_breaks'])->map(fn (array $break) => new PricingRuleQtyBreak($break)));
        $rule->setRelation('bundleItems', collect($validated['relations']['bundle_items'])->map(fn (array $item) => new PricingRuleBundleItem($item)));
        $rule->setRelation('buyGetItems', collect($validated['relations']['buy_get_items'])->map(fn (array $item) => new PricingRuleBuyGetItem($item)));

        $customer = $request->filled('preview_customer_id')
            ? Customer::find($request->integer('preview_customer_id'))
            : null;

        return response()->json([
            'success' => true,
            'data' => $this->pricingService->previewDraftRule(
                $rule,
                $customer,
                $this->outletResolver->resolve($request, $request->user())?->id
            ),
        ]);
    }

    private function formPayload(Request $request): array
    {
        $user = $request->user();
        $activeOutlet = $this->outletResolver->resolve($request, $user);
        $activeOutletId = $activeOutlet?->id;
        $isTenantWorkspace = (string) ($activeOutlet?->outlet_type ?? '') === 'tenant' || ($user?->isKitchenWorkspace() ?? false);

        $productsQuery = Product::query()
            ->when(
                $isTenantWorkspace && $activeOutletId,
                fn ($query) => $query->where('tenant_outlet_id', $activeOutletId)
            )
            ->orderBy('title');

        $products = $productsQuery->get(['id', 'title', 'buy_price', 'sell_price', 'category_id', 'tenant_outlet_id']);
        $visibleCategoryIds = $products->pluck('category_id')->filter()->unique()->values();

        return [
            'products' => $products,
            'categories' => Category::query()
                ->when(
                    $isTenantWorkspace,
                    fn ($query) => $query->whereIn('id', $visibleCategoryIds)
                )
                ->orderBy('name')
                ->get(['id', 'name']),
            'tierOptions' => $this->loyaltyService->tierOptions(),
            'priceBasisOptions' => [
                ['value' => PricingRule::PRICE_BASIS_SELL_PRICE, 'label' => 'Harga Jual'],
                ['value' => PricingRule::PRICE_BASIS_BUY_PRICE, 'label' => 'Harga Beli'],
            ],
            'pricingContext' => [
                'active_outlet' => $activeOutlet ? [
                    'id' => $activeOutlet->id,
                    'name' => $activeOutlet->name,
                    'code' => $activeOutlet->code,
                    'outlet_type' => $activeOutlet->outlet_type,
                ] : null,
                'is_kitchen' => $user?->isKitchenWorkspace() ?? false,
                'is_tenant_workspace' => $isTenantWorkspace,
                'mode_label' => $isTenantWorkspace ? 'Promo Tenant' : 'Promo Outlet Owner',
                'forced_price_basis' => $isTenantWorkspace
                    ? PricingRule::PRICE_BASIS_BUY_PRICE
                    : null,
            ],
            'kindOptions' => [
                ['value' => PricingRule::KIND_STANDARD_DISCOUNT, 'label' => 'Diskon Standar'],
                ['value' => PricingRule::KIND_QTY_BREAK, 'label' => 'Harga Grosir / Qty Break'],
                ['value' => PricingRule::KIND_BUNDLE_PRICE, 'label' => 'Bundle Price'],
                ['value' => PricingRule::KIND_BUY_X_GET_Y, 'label' => 'Buy X Get Y'],
            ],
        ];
    }

    private function validateRule(Request $request): array
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $activeOutletId = $activeOutlet?->id;
        $isTenantWorkspace = (string) ($activeOutlet?->outlet_type ?? '') === 'tenant' || ($request->user()?->isKitchenWorkspace() ?? false);
        $kind = (string) $request->input('kind');
        $discountTypeRules = match ($kind) {
            PricingRule::KIND_BUNDLE_PRICE,
            PricingRule::KIND_BUY_X_GET_Y,
            PricingRule::KIND_QTY_BREAK => ['nullable', Rule::in([
                PricingRule::TYPE_PERCENTAGE,
                PricingRule::TYPE_FIXED_AMOUNT,
                PricingRule::TYPE_FIXED_PRICE,
            ])],
            default => ['required', Rule::in([
                PricingRule::TYPE_PERCENTAGE,
                PricingRule::TYPE_FIXED_AMOUNT,
                PricingRule::TYPE_FIXED_PRICE,
            ])],
        };
        $discountValueRules = match ($kind) {
            PricingRule::KIND_STANDARD_DISCOUNT,
            PricingRule::KIND_BUNDLE_PRICE => ['required', 'numeric', 'min:0.01'],
            PricingRule::KIND_QTY_BREAK,
            PricingRule::KIND_BUY_X_GET_Y => ['nullable', 'numeric', 'min:0'],
            default => ['required', 'numeric', 'min:0.01'],
        };

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'kind' => ['required', Rule::in([
                PricingRule::KIND_STANDARD_DISCOUNT,
                PricingRule::KIND_QTY_BREAK,
                PricingRule::KIND_BUNDLE_PRICE,
                PricingRule::KIND_BUY_X_GET_Y,
            ])],
            'is_active' => ['nullable', 'boolean'],
            'priority' => ['required', 'integer', 'min:0'],
            'target_type' => ['required', Rule::in([
                PricingRule::TARGET_ALL,
                PricingRule::TARGET_PRODUCT,
                PricingRule::TARGET_CATEGORY,
            ])],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'customer_scope' => ['required', Rule::in([
                PricingRule::SCOPE_ALL,
                PricingRule::SCOPE_WALK_IN,
                PricingRule::SCOPE_REGISTERED,
                PricingRule::SCOPE_MEMBER,
            ])],
            'eligible_loyalty_tiers' => ['nullable', 'array'],
            'eligible_loyalty_tiers.*' => ['string', Rule::in(array_keys($this->loyaltyService->tiers()))],
            'discount_type' => $discountTypeRules,
            'discount_value' => $discountValueRules,
            'price_basis' => ['nullable', Rule::in([
                PricingRule::PRICE_BASIS_SELL_PRICE,
                PricingRule::PRICE_BASIS_BUY_PRICE,
            ])],
            'preview_quantity_multiplier' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'active_days' => ['nullable', 'array'],
            'active_days.*' => ['string', Rule::in([
                PricingRule::DAY_SUNDAY,
                PricingRule::DAY_MONDAY,
                PricingRule::DAY_TUESDAY,
                PricingRule::DAY_WEDNESDAY,
                PricingRule::DAY_THURSDAY,
                PricingRule::DAY_FRIDAY,
                PricingRule::DAY_SATURDAY,
            ])],
            'daily_start_time' => ['nullable', 'date_format:H:i'],
            'daily_end_time' => ['nullable', 'date_format:H:i'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'qty_breaks' => ['nullable', 'array'],
            'qty_breaks.*.min_qty' => ['required_with:qty_breaks', 'integer', 'min:1'],
            'qty_breaks.*.discount_type' => ['required_with:qty_breaks', Rule::in([
                PricingRule::TYPE_PERCENTAGE,
                PricingRule::TYPE_FIXED_AMOUNT,
                PricingRule::TYPE_FIXED_PRICE,
            ])],
            'qty_breaks.*.discount_value' => ['required_with:qty_breaks', 'numeric', 'min:0.01'],
            'qty_breaks.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'bundle_items' => ['nullable', 'array'],
            'bundle_items.*.product_id' => ['required_with:bundle_items', 'integer', 'exists:products,id'],
            'bundle_items.*.quantity' => ['required_with:bundle_items', 'integer', 'min:1'],
            'bundle_items.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'buy_get_items' => ['nullable', 'array'],
            'buy_get_items.*.product_id' => ['required_with:buy_get_items', 'integer', 'exists:products,id'],
            'buy_get_items.*.role' => ['required_with:buy_get_items', Rule::in([
                PricingRuleBuyGetItem::ROLE_BUY,
                PricingRuleBuyGetItem::ROLE_GET,
            ])],
            'buy_get_items.*.quantity' => ['required_with:buy_get_items', 'integer', 'min:1'],
            'buy_get_items.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        if ($validated['target_type'] === PricingRule::TARGET_PRODUCT && empty($validated['product_id'])) {
            $request->validate(['product_id' => ['required']]);
        }

        if ($validated['target_type'] === PricingRule::TARGET_CATEGORY && empty($validated['category_id'])) {
            $request->validate(['category_id' => ['required']]);
        }

        if ($validated['kind'] === PricingRule::KIND_QTY_BREAK && empty($validated['qty_breaks'])) {
            $request->validate(['qty_breaks' => ['required', 'array', 'min:1']]);
        }

        if ($validated['kind'] === PricingRule::KIND_BUNDLE_PRICE && count($validated['bundle_items'] ?? []) < 2) {
            $request->validate(['bundle_items' => ['required', 'array', 'min:2']]);
        }

        if ($validated['kind'] === PricingRule::KIND_BUY_X_GET_Y) {
            $buyCount = collect($validated['buy_get_items'] ?? [])->where('role', PricingRuleBuyGetItem::ROLE_BUY)->count();
            $getCount = collect($validated['buy_get_items'] ?? [])->where('role', PricingRuleBuyGetItem::ROLE_GET)->count();

            if ($buyCount === 0 || $getCount === 0) {
                $request->validate(['buy_get_items' => ['required', 'array', 'min:2']]);
            }
        }

        if ($validated['target_type'] !== PricingRule::TARGET_PRODUCT) {
            $validated['product_id'] = null;
        }

        if ($validated['target_type'] !== PricingRule::TARGET_CATEGORY) {
            $validated['category_id'] = null;
        }

        if (
            $validated['discount_type'] === PricingRule::TYPE_PERCENTAGE
            && (float) $validated['discount_value'] > 100
        ) {
            $request->validate(['discount_value' => ['max:100']]);
        }

        $validated['is_active'] = (bool) ($validated['is_active'] ?? false);
        $validated['eligible_loyalty_tiers'] = $validated['customer_scope'] === PricingRule::SCOPE_MEMBER
            ? array_values(array_unique($validated['eligible_loyalty_tiers'] ?? []))
            : null;
        $validated['active_days'] = array_values(array_unique($validated['active_days'] ?? []));
        $validated['preview_quantity_multiplier'] = max(1, (int) ($validated['preview_quantity_multiplier'] ?? 1));

        if (($validated['daily_start_time'] ?? null) && ! ($validated['daily_end_time'] ?? null)) {
            $request->validate(['daily_end_time' => ['required']]);
        }

        if (($validated['daily_end_time'] ?? null) && ! ($validated['daily_start_time'] ?? null)) {
            $request->validate(['daily_start_time' => ['required']]);
        }

        if ($validated['kind'] === PricingRule::KIND_QTY_BREAK) {
            $validated['qty_breaks'] = collect($validated['qty_breaks'] ?? [])
                ->map(fn (array $break, int $index) => [
                    'min_qty' => (int) $break['min_qty'],
                    'discount_type' => $break['discount_type'],
                    'discount_value' => (float) $break['discount_value'],
                    'sort_order' => (int) ($break['sort_order'] ?? $index),
                ])
                ->sortBy('min_qty')
                ->values()
                ->all();

            $firstBreak = collect($validated['qty_breaks'])->first();
            $validated['discount_type'] = $validated['discount_type'] ?? data_get($firstBreak, 'discount_type', PricingRule::TYPE_FIXED_PRICE);
            $validated['discount_value'] = $validated['discount_value'] !== null && $validated['discount_value'] !== ''
                ? (float) $validated['discount_value']
                : (float) data_get($firstBreak, 'discount_value', 0);
        }

        $validated['bundle_items'] = collect($validated['bundle_items'] ?? [])
            ->map(fn (array $item, int $index) => [
                'product_id' => (int) $item['product_id'],
                'quantity' => (int) $item['quantity'],
                'sort_order' => (int) ($item['sort_order'] ?? $index),
            ])
            ->values()
            ->all();
        $validated['buy_get_items'] = collect($validated['buy_get_items'] ?? [])
            ->map(fn (array $item, int $index) => [
                'product_id' => (int) $item['product_id'],
                'role' => $item['role'],
                'quantity' => (int) $item['quantity'],
                'sort_order' => (int) ($item['sort_order'] ?? $index),
            ])
            ->values()
            ->all();

        if ($validated['kind'] === PricingRule::KIND_BUNDLE_PRICE) {
            $validated['discount_type'] = PricingRule::TYPE_FIXED_PRICE;
            $validated['discount_value'] = (float) $validated['discount_value'];
        }

        if ($validated['kind'] === PricingRule::KIND_BUY_X_GET_Y) {
            $validated['discount_type'] = PricingRule::TYPE_FIXED_AMOUNT;
            $validated['discount_value'] = 0;
        }

        $validated['price_basis'] = $isTenantWorkspace
            ? PricingRule::PRICE_BASIS_BUY_PRICE
            : ($validated['price_basis'] ?? PricingRule::PRICE_BASIS_SELL_PRICE);

        if ($isTenantWorkspace && $activeOutletId) {
            $this->assertTenantScopedProductsAndCategory(
                $activeOutletId,
                $validated['product_id'] ?? null,
                $validated['category_id'] ?? null,
                collect($validated['bundle_items'] ?? [])->pluck('product_id'),
                collect($validated['buy_get_items'] ?? [])->pluck('product_id')
            );
        }

        return [
            'rule' => collect($validated)
                ->only([
                    'name',
                    'kind',
                    'is_active',
                    'priority',
                    'target_type',
                    'product_id',
                    'category_id',
                    'customer_scope',
                    'eligible_loyalty_tiers',
                    'discount_type',
                    'discount_value',
                    'price_basis',
                    'preview_quantity_multiplier',
                    'starts_at',
                    'ends_at',
                    'active_days',
                    'daily_start_time',
                    'daily_end_time',
                    'notes',
                ])
                ->all(),
            'relations' => [
                'qty_breaks' => $validated['kind'] === PricingRule::KIND_QTY_BREAK ? ($validated['qty_breaks'] ?? []) : [],
                'bundle_items' => $validated['kind'] === PricingRule::KIND_BUNDLE_PRICE ? $validated['bundle_items'] : [],
                'buy_get_items' => $validated['kind'] === PricingRule::KIND_BUY_X_GET_Y ? $validated['buy_get_items'] : [],
            ],
        ];
    }

    private function syncRuleRelations(PricingRule $rule, array $relations): void
    {
        $rule->qtyBreaks()->delete();
        foreach ($relations['qty_breaks'] as $payload) {
            $rule->qtyBreaks()->create($payload);
        }

        $rule->bundleItems()->delete();
        foreach ($relations['bundle_items'] as $payload) {
            $rule->bundleItems()->create($payload);
        }

        $rule->buyGetItems()->delete();
        foreach ($relations['buy_get_items'] as $payload) {
            $rule->buyGetItems()->create($payload);
        }
    }

    private function auditPayload(PricingRule $rule): array
    {
        return [
            'name' => $rule->name,
            'kind' => $rule->kind,
            'is_active' => (bool) $rule->is_active,
            'priority' => (int) $rule->priority,
            'target_type' => $rule->target_type,
            'product_id' => $rule->product_id,
            'category_id' => $rule->category_id,
            'outlet_id' => $rule->outlet_id,
            'customer_scope' => $rule->customer_scope,
            'eligible_loyalty_tiers' => $rule->eligible_loyalty_tiers,
            'discount_type' => $rule->discount_type,
            'discount_value' => (float) $rule->discount_value,
            'price_basis' => $rule->price_basis ?: PricingRule::PRICE_BASIS_SELL_PRICE,
            'preview_quantity_multiplier' => (int) $rule->preview_quantity_multiplier,
            'starts_at' => optional($rule->starts_at)?->toIso8601String(),
            'ends_at' => optional($rule->ends_at)?->toIso8601String(),
            'active_days' => $rule->active_days,
            'daily_start_time' => $rule->daily_start_time,
            'daily_end_time' => $rule->daily_end_time,
            'notes' => $rule->notes,
            'qty_breaks' => $rule->qtyBreaks->map->only(['min_qty', 'discount_type', 'discount_value', 'sort_order'])->values()->all(),
            'bundle_items' => $rule->bundleItems->map->only(['product_id', 'quantity', 'sort_order'])->values()->all(),
            'buy_get_items' => $rule->buyGetItems->map->only(['product_id', 'role', 'quantity', 'sort_order'])->values()->all(),
        ];
    }

    private function assertRuleVisibleForWorkspace(Request $request, PricingRule $pricingRule): void
    {
        $activeOutlet = $this->outletResolver->resolve($request, $request->user());
        $activeOutletId = $activeOutlet?->id;
        $isTenantWorkspace = (string) ($activeOutlet?->outlet_type ?? '') === 'tenant' || ($request->user()?->isKitchenWorkspace() ?? false);

        if (! $activeOutletId) {
            return;
        }

        if ($isTenantWorkspace && (int) ($pricingRule->outlet_id ?? 0) !== (int) $activeOutletId) {
            $legacyVisible = $pricingRule->outlet_id === null && (
                ((int) ($pricingRule->product?->tenant_outlet_id ?? 0) === (int) $activeOutletId)
                || (
                    $pricingRule->target_type === PricingRule::TARGET_CATEGORY
                    && $pricingRule->category
                    && $pricingRule->category->products()->where('tenant_outlet_id', $activeOutletId)->exists()
                )
            );

            if (! $legacyVisible) {
                abort(404);
            }
        }

        if ($pricingRule->outlet_id !== null && (int) $pricingRule->outlet_id !== (int) $activeOutletId) {
            abort(404);
        }
    }

    private function assertTenantScopedProductsAndCategory(
        int $activeOutletId,
        ?int $productId,
        ?int $categoryId,
        Collection $bundleProductIds,
        Collection $buyGetProductIds
    ): void {
        $requestedProductIds = collect([$productId])
            ->merge($bundleProductIds)
            ->merge($buyGetProductIds)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($requestedProductIds->isNotEmpty()) {
            $visibleProductIds = Product::query()
                ->where('tenant_outlet_id', $activeOutletId)
                ->whereIn('id', $requestedProductIds)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();

            if ($visibleProductIds->count() !== $requestedProductIds->count()) {
                throw ValidationException::withMessages([
                    'product_id' => 'Produk promo harus berasal dari tenant aktif.',
                ]);
            }
        }

        if ($categoryId) {
            $categoryExists = Product::query()
                ->where('tenant_outlet_id', $activeOutletId)
                ->where('category_id', $categoryId)
                ->exists();

            if (! $categoryExists) {
                throw ValidationException::withMessages([
                    'category_id' => 'Kategori promo harus berasal dari produk tenant aktif.',
                ]);
            }
        }
    }
}
