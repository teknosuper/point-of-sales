<?php

namespace App\Http\Controllers\Apps;

use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Customer;
use App\Models\CustomerVoucher;
use App\Models\DiningTable;
use App\Models\Outlet;
use App\Models\PaymentSetting;
use App\Models\Product;
use App\Models\ProductOutletStock;
use App\Models\Receivable;
use App\Models\TableOrder;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\CartModifier;
use App\Services\AuditLogService;
use App\Services\CashierShiftService;
use App\Services\FoodcourtTenantAllocationService;
use App\Services\KitchenTicketService;
use App\Services\LoyaltyService;
use App\Services\OutletResolver;
use App\Services\Payments\PaymentGatewayManager;
use App\Services\PricingService;
use App\Services\ProductCatalogService;
use App\Services\PrintJobService;
use App\Services\ReceiptLayoutService;
use App\Services\StockMutationService;
use App\Services\TransactionInvoiceService;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Inertia\Inertia;

class TransactionController extends Controller
{
    public function __construct(
        private readonly CashierShiftService $cashierShiftService,
        private readonly AuditLogService $auditLogService,
        private readonly PricingService $pricingService,
        private readonly ProductCatalogService $productCatalogService,
        private readonly LoyaltyService $loyaltyService,
        private readonly OutletResolver $outletResolver,
        private readonly StockMutationService $stockMutationService,
        private readonly KitchenTicketService $kitchenTicketService,
        private readonly FoodcourtTenantAllocationService $foodcourtTenantAllocationService,
        private readonly PrintJobService $printJobService,
        private readonly ReceiptLayoutService $receiptLayoutService,
        private readonly TransactionInvoiceService $transactionInvoiceService
    ) {}

    /**
     * index
     *
     * @return void
     */
    public function index(Request $request)
    {
        $userId = auth()->user()->id;
        $outlet = $this->resolveActiveOutlet();
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($userId, $outlet?->id);
        $outletOpenShift = $activeShift
            ? null
            : $this->cashierShiftService->getOpenShiftForOutlet($outlet?->id);
        $openTableOrderId = (int) $request->integer('open_table_order');

        // Get active cart items (not held)
        $carts = Cart::with('product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers')
            ->where('cashier_id', $userId)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->latest()
            ->get();
        
        // Filter out cart items with insufficient stock
        $cartsToRemove = [];
        foreach ($carts as $cart) {
            if ($cart->product) {
                $availableStock = (int) ($cart->product->stock ?? 0);
                
                if ($availableStock < $cart->qty) {
                    $cartsToRemove[] = $cart->id;
                }
            }
        }
        
        // Remove cart items with insufficient stock
        if (!empty($cartsToRemove)) {
            Cart::whereIn('id', $cartsToRemove)->delete();
            $carts = $carts->filter(fn($cart) => !in_array($cart->id, $cartsToRemove));
        }
        
        $activePricingRules = $this->pricingService->getActiveRules(outletId: $outlet?->id);
        $carts = $this->pricingService->normalizeRewardCarts(
            $carts,
            outletId: $outlet?->id,
            rules: $activePricingRules
        );

        $initialPricingPreview = $this->loyaltyService->previewCheckout(
            $this->pricingService->previewCartWithRules($carts, null, $activePricingRules, outletId: $outlet?->id),
            outletId: $outlet?->id
        );

        // Get held carts grouped by hold_id
        $heldCarts = Cart::with('product:id,title,sell_price,image')
            ->where('cashier_id', $userId)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->held()
            ->get()
            ->groupBy('hold_id')
            ->map(function ($items, $holdId) {
                $first = $items->first();

                return [
                    'hold_id' => $holdId,
                    'label' => $first->hold_label,
                    'held_at' => $first->held_at?->toISOString(),
                    'items_count' => $items->sum('qty'),
                    'total' => $items->sum('price'),
                ];
            })
            ->values();

        // get all customers
        $customers = Customer::latest()->get()->map(fn (Customer $customer) => [
            ...$customer->toArray(),
            'loyalty_tier' => $this->loyaltyService->resolvedTier($customer, $outlet?->id),
        ]);
        $diningTables = DiningTable::query()
            ->where('outlet_id', $outlet?->id)
            ->where('status', 'active')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->with(['transactions' => fn ($q) => $q->latest()->limit(1)])
            ->get(['id', 'name', 'code', 'capacity', 'created_at'])
            ->map(fn (DiningTable $table) => [
                'id' => $table->id,
                'name' => $table->name,
                'code' => $table->code,
                'capacity' => (int) $table->capacity,
                'latest_transaction_at' => $table->transactions->first()?->created_at
                    ? ($table->transactions->first()->created_at instanceof \Carbon\Carbon
                        ? $table->transactions->first()->created_at->toISOString()
                        : \Carbon\Carbon::parse($table->transactions->first()->created_at)->toISOString())
                    : null,
            ])
            ->values();

        // get all products with categories for product grid
        $productsQuery = Product::with(['category:id,name', 'modifierOptions', 'tenantOutlet:id,name,code,slug,sort_order'])
            ->select('id', 'barcode', 'title', 'description', 'image', 'buy_price', 'sell_price', 'stock', 'category_id', 'tenant_outlet_id', 'supports_modifiers', 'requires_modifier_selection')
            ->orderBy('title');

        $soldQtyByProduct = TransactionDetail::query()
            ->selectRaw('product_id, SUM(qty) as sold_qty')
            ->whereNotNull('product_id')
            ->when(
                Schema::hasColumn('transaction_details', 'is_promo_reward'),
                fn ($query) => $query->where('is_promo_reward', false)
            )
            ->whereHas('transaction', function ($query) use ($outlet) {
                $query->when($outlet, fn ($innerQuery) => $innerQuery->where('outlet_id', $outlet->id));
            })
            ->groupBy('product_id')
            ->pluck('sold_qty', 'product_id');

        $products = $productsQuery->get()->map(function (Product $product) {
            $product->setAttribute('stock', (int) ($product->stock ?? 0));

            return $product;
        })->filter(function (Product $product) {
            // Filter out products with stock <= 0 BEFORE mapping
            return $product->stock > 0;
        });
        
        $products = $this->productCatalogService->mapProductsForPosGrid(
            $products,
            null,
            $outlet?->id,
            [
                'soldQtyByProduct' => $soldQtyByProduct,
            ]
        );

        // get all categories
        $categories = \App\Models\Category::select('id', 'name', 'image')
            ->orderBy('name')
            ->get();

        $paymentSetting = PaymentSetting::resolveForOutlet($outlet?->id);

        $carts_total = 0;
        foreach ($carts as $cart) {
            $carts_total += $cart->price;
        }

        $defaultGateway = $paymentSetting?->default_gateway ?? 'cash';
        if (
            $defaultGateway !== 'cash'
            && (! $paymentSetting || ! $paymentSetting->isGatewayReady($defaultGateway, $outlet?->id))
        ) {
            $defaultGateway = 'cash';
        }

        $qrisImageUrl = null;
        if ($paymentSetting?->qris_static_image) {
            $qrisImageUrl = $this->resolveImageUrl($paymentSetting->qris_static_image);
        }

        // Get active bank accounts for bank transfer
        $bankAccounts = \App\Models\BankAccount::active()
            ->ordered()
            ->when($outlet && Schema::hasColumn('bank_accounts', 'outlet_id'), fn ($query) => $query->where('outlet_id', $outlet->id))
            ->get();

        $pendingTableOrders = TableOrder::query()
            ->with(['diningTable:id,name,code', 'items.modifiers'])
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->where('status', 'pending_cashier_payment')
            ->latest('created_at')
            ->limit(6)
            ->get()
            ->map(function (TableOrder $order) {
                $resolvedGrandTotal = $order->resolvedGrandTotal();

                return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'notes' => $order->notes,
                'grand_total' => $resolvedGrandTotal,
                'created_at' => optional($order->created_at)->toISOString(),
                'created_at_label' => optional($order->created_at)->format('d M Y H:i'),
                'table' => [
                    'name' => $order->diningTable?->name,
                    'code' => $order->diningTable?->code,
                ],
                'items' => $order->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_title' => $item->product_title,
                    'qty' => (int) $item->qty,
                    'base_unit_price' => (int) ($item->base_unit_price ?? $item->unit_price),
                    'unit_price' => (int) $item->unit_price,
                    'line_total' => (int) $item->line_total,
                    'discount_total' => (int) ($item->discount_total ?? 0),
                    'pricing_rule_name' => $item->pricing_rule_name,
                    'pricing_rule_kind' => $item->pricing_rule_kind,
                    'notes' => $item->notes,
                    'modifiers' => $item->modifiers->map(fn ($modifier) => [
                        'id' => $modifier->id,
                        'name' => $modifier->name,
                        'qty' => (int) $modifier->qty,
                        'unit_price' => (int) $modifier->unit_price,
                        'total_price' => (int) $modifier->total_price,
                    ])->values(),
                ])->values(),
                ];
            })
            ->values();

        return Inertia::render('Dashboard/Transactions/Index', [
            'carts' => $carts
                ->map(fn (Cart $cart) => $this->serializeCart($cart))
                ->filter()
                ->values(),
            'carts_total' => $carts_total,
            'heldCarts' => $heldCarts,
            'customers' => $customers,
            'diningTables' => $diningTables,
            'products' => $products,
            'categories' => $categories,
            'initialPricingPreview' => $initialPricingPreview,
            'paymentGateways' => $paymentSetting?->enabledGateways($outlet?->id) ?? [],
            'defaultPaymentGateway' => $defaultGateway,
            'paymentGatewayMeta' => [
                'qrisImageUrl' => $qrisImageUrl,
            ],
            'bankAccounts' => $bankAccounts,
            'pendingTableOrders' => $pendingTableOrders,
            'openTableOrderId' => $openTableOrderId > 0 ? $openTableOrderId : null,
            'shiftSummary' => $this->cashierShiftService->summarizeForDisplay($activeShift),
            'outletOpenShift' => $this->cashierShiftService->summarizeForDisplay($outletOpenShift),
            'loyaltyTierOptions' => $this->loyaltyService->tierOptions(),
            'tenantOutlets' => Outlet::query()
                ->active()
                ->ordered()
                ->get(['id', 'name', 'code'])
                ->map(fn (Outlet $tenantOutlet) => [
                    'id' => $tenantOutlet->id,
                    'name' => $tenantOutlet->name,
                    'code' => $tenantOutlet->code,
                ])
                ->values(),
        ]);
    }

    /**
     * searchProduct
     *
     * @param  mixed  $request
     * @return void
     */
    public function searchProduct(Request $request)
    {
        $outlet = $this->resolveActiveOutlet($request);

        // find product by barcode
        $product = Product::where('barcode', $request->barcode)->first();

        if ($product) {
            if ($outlet && Schema::hasTable('product_outlet_stocks')) {
                $product->setAttribute(
                    'stock',
                    $this->stockMutationService->stockForOutlet($product, $outlet->id)
                );
            }

            return response()->json([
                'success' => true,
                'data' => $product,
            ]);
        }

        return response()->json([
            'success' => false,
            'data' => null,
        ]);
    }

    public function previewPricing(Request $request): JsonResponse
    {
        $outlet = $this->resolveActiveOutlet($request);
        $validated = $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'discount' => ['nullable', 'integer', 'min:0'],
            'shipping_cost' => ['nullable', 'integer', 'min:0'],
            'redeem_points' => ['nullable', 'integer', 'min:0'],
            'customer_voucher_id' => ['nullable', 'integer', 'exists:customer_vouchers,id'],
            'reward_cart_meta' => ['nullable', 'array'],
            'reward_cart_meta.*.cart_id' => ['required_with:reward_cart_meta', 'string', 'max:64'],
            'reward_cart_meta.*.rule_name' => ['nullable', 'string', 'max:255'],
            'reward_cart_meta.*.reward_label' => ['nullable', 'string', 'max:255'],
        ]);

        $customer = isset($validated['customer_id'])
            ? Customer::find($validated['customer_id'])
            : null;
        $voucher = isset($validated['customer_voucher_id'])
            ? CustomerVoucher::find($validated['customer_voucher_id'])
            : null;

        $carts = Cart::with('product', 'modifiers')
            ->where('cashier_id', $request->user()->id)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->latest()
            ->get();
        $this->applyRewardCartMeta($carts, $validated['reward_cart_meta'] ?? []);

        $pricingPreview = $this->pricingService->previewCart($carts, $customer, outletId: $outlet?->id);

        return response()->json([
            'success' => true,
            'data' => $this->loyaltyService->previewCheckout($pricingPreview, $customer, [
                'manual_discount' => (int) ($validated['discount'] ?? 0),
                'shipping_cost' => (int) ($validated['shipping_cost'] ?? 0),
                'redeem_points' => (int) ($validated['redeem_points'] ?? 0),
                'voucher' => $voucher,
            ], outletId: $outlet?->id),
        ]);
    }

    /**
     * addToCart
     *
     * @param  mixed  $request
     * @return void
     */
    public function addToCart(Request $request)
    {
        $outlet = $this->resolveActiveOutlet($request);
        $forceNew = $request->boolean('force_new');
        $supportsPromoRewardMeta = Schema::hasColumn('carts', 'is_promo_reward');
        $isPromoReward = $request->boolean('is_promo_reward');
        $promoRewardRuleName = filled($request->promo_reward_rule_name)
            ? trim((string) $request->promo_reward_rule_name)
            : null;
        $promoRewardLabel = filled($request->promo_reward_label)
            ? trim((string) $request->promo_reward_label)
            : null;

        // Cari produk berdasarkan ID yang diberikan
        $product = Product::whereId($request->product_id)->first();

        // Jika produk tidak ditemukan, redirect dengan pesan error
        if (! $product) {
            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Product not found.',
                ], 404);
            }

            return redirect()->back()->with('error', 'Product not found.');
        }

        $cart = null;
        if (! $forceNew) {
            $cart = Cart::with('product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers')
                ->where('product_id', $request->product_id)
                ->where('cashier_id', auth()->user()->id)
                ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
                ->whereNull('notes')
                ->when(
                    $supportsPromoRewardMeta,
                    fn ($query) => $query->where('is_promo_reward', false)
                )
                ->whereDoesntHave('modifiers')
                ->active()
                ->first();
        }

        // Cek stok produk dengan memperhitungkan item aktif yang akan digabung.
        $availableStock = $outlet
            ? $this->stockMutationService->stockForOutlet($product, $outlet->id)
            : (int) $product->stock;
        $requestedQty = (int) $request->qty + ($cart ? (int) $cart->qty : 0);

        if ($availableStock < $requestedQty) {
            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Out of Stock Product!.',
                ], 422);
            }

            return redirect()->back()->with('error', 'Out of Stock Product!.');
        }

        if ($cart) {
            // Tingkatkan qty
            $cart->increment('qty', $request->qty);

            // Jumlahkan harga * kuantitas
            $cart->price = $cart->product->sell_price * $cart->qty;

            $cart->save();
        } else {
            // Insert ke keranjang
            $cartAttributes = [
                'cashier_id' => auth()->user()->id,
                'outlet_id' => $outlet?->id,
                'tenant_outlet_id' => $product->tenant_outlet_id ?: $outlet?->id,
                'product_id' => $request->product_id,
                'qty' => $request->qty,
                'price' => $request->sell_price * $request->qty,
                'notes' => null,
            ];

            if ($supportsPromoRewardMeta) {
                $cartAttributes['is_promo_reward'] = $isPromoReward;
                $cartAttributes['promo_reward_rule_name'] = $promoRewardRuleName;
                $cartAttributes['promo_reward_label'] = $promoRewardLabel;
            }

            $cart = Cart::create($cartAttributes);

            $cart = Cart::query()
                ->with('product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers')
                ->whereKey($cart->id)
                ->first();
        }

        $cart = $cart?->fresh(['product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers']);

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Product Added Successfully!.',
                'data' => [
                    'cart' => $this->serializeCart($cart),
                ],
            ]);
        }

        return redirect()->route('transactions.index')->with('success', 'Product Added Successfully!.');
    }

    /**
     * destroyCart
     *
     * @param  mixed  $request
     * @return void
     */
    public function destroyCart(Request $request, $cart_id)
    {
        $cart = Cart::with('product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers')
            ->whereId($cart_id)
            ->where('cashier_id', auth()->id())
            ->when($this->resolveActiveOutlet(), fn ($query, $outlet) => $query->where('outlet_id', $outlet->id))
            ->first();

        if ($cart) {
            $deletedCartId = $cart->id;
            $cart->delete();

            if ($request->expectsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Item dihapus dari keranjang.',
                    'data' => [
                        'cart_id' => $deletedCartId,
                    ],
                ]);
            }

            return back();
        } else {
            if ($request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cart not found',
                ], 404);
            }

            // Handle case where no cart is found (e.g., redirect with error message)
            return back()->withErrors(['message' => 'Cart not found']);
        }

    }

    /**
     * updateCart - Update cart item quantity
     *
     * @param  mixed  $request
     * @param  int  $cart_id
     * @return void
     */
    public function updateCart(Request $request, $cart_id)
    {
        $request->validate([
            'qty' => 'required|integer|min:1',
        ]);

        $cart = Cart::with('product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers')->whereId($cart_id)
            ->where('cashier_id', auth()->user()->id)
            ->when($this->resolveActiveOutlet($request), fn ($query, $outlet) => $query->where('outlet_id', $outlet->id))
            ->first();

        if (! $cart) {
            return response()->json([
                'success' => false,
                'message' => 'Cart item not found',
            ], 404);
        }

        // Check stock availability
        $availableStock = $this->resolveActiveOutlet($request)
            ? $this->stockMutationService->stockForOutlet($cart->product, $this->resolveActiveOutlet($request)->id)
            : (int) $cart->product->stock;

        if ($availableStock < $request->qty) {
            return response()->json([
                'success' => false,
                'message' => 'Stok tidak mencukupi. Tersedia: '.$availableStock,
            ], 422);
        }

        // Update quantity and price
        $cart->qty = $request->qty;
        $cart->price = $cart->product->sell_price * $request->qty;
        $cart->save();

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Quantity updated successfully',
                'data' => [
                    'cart' => $this->serializeCart($cart->fresh(['product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers'])),
                ],
            ]);
        }

        return back()->with('success', 'Quantity updated successfully');
    }

    public function updateCartNotes(Request $request, $cart_id): JsonResponse
    {
        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $cart = Cart::with('product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers')
            ->whereId($cart_id)
            ->where('cashier_id', auth()->id())
            ->when($this->resolveActiveOutlet($request), fn ($query, $outlet) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->first();

        if (! $cart) {
            return response()->json([
                'success' => false,
                'message' => 'Cart item not found',
            ], 404);
        }

        $cart->forceFill([
            'notes' => filled($validated['notes'] ?? null) ? trim((string) $validated['notes']) : null,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Catatan item diperbarui',
            'data' => [
                'cart' => $this->serializeCart($cart->fresh(['product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers'])),
            ],
        ]);
    }

    public function storeCartModifier(Request $request, $cart_id): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'qty' => ['nullable', 'integer', 'min:1', 'max:99'],
            'unit_price' => ['nullable', 'integer', 'min:0', 'max:100000000'],
        ]);

        $cart = $this->findEditableCart($request, $cart_id);
        if (! $cart) {
            return response()->json([
                'success' => false,
                'message' => 'Cart item not found',
            ], 404);
        }

        $qty = max(1, (int) ($validated['qty'] ?? 1));
        $unitPrice = max(0, (int) ($validated['unit_price'] ?? 0));

        $cart->modifiers()->create([
            'name' => trim((string) $validated['name']),
            'qty' => $qty,
            'unit_price' => $unitPrice,
            'total_price' => $qty * $unitPrice,
        ]);

        $this->ensureRequiredModifiersSatisfied($cart->fresh(['product.modifierOptions', 'modifiers']));

        return response()->json([
            'success' => true,
            'message' => 'Tambahan item berhasil ditambahkan',
            'data' => [
                'cart' => $this->serializeCart($cart->fresh(['product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers'])),
            ],
        ]);
    }

    public function updateCartModifier(Request $request, $cart_id, CartModifier $modifier): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'qty' => ['nullable', 'integer', 'min:1', 'max:99'],
            'unit_price' => ['nullable', 'integer', 'min:0', 'max:100000000'],
        ]);

        $cart = $this->findEditableCart($request, $cart_id);
        if (! $cart || (int) $modifier->cart_id !== (int) $cart->id) {
            return response()->json([
                'success' => false,
                'message' => 'Modifier item not found',
            ], 404);
        }

        $qty = max(1, (int) ($validated['qty'] ?? 1));
        $unitPrice = max(0, (int) ($validated['unit_price'] ?? 0));

        $modifier->forceFill([
            'name' => trim((string) $validated['name']),
            'qty' => $qty,
            'unit_price' => $unitPrice,
            'total_price' => $qty * $unitPrice,
        ])->save();

        $this->ensureRequiredModifiersSatisfied($cart->fresh(['product.modifierOptions', 'modifiers']));

        return response()->json([
            'success' => true,
            'message' => 'Tambahan item diperbarui',
            'data' => [
                'cart' => $this->serializeCart($cart->fresh(['product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers'])),
            ],
        ]);
    }

    public function destroyCartModifier(Request $request, $cart_id, CartModifier $modifier): JsonResponse
    {
        $cart = $this->findEditableCart($request, $cart_id);
        if (! $cart || (int) $modifier->cart_id !== (int) $cart->id) {
            return response()->json([
                'success' => false,
                'message' => 'Modifier item not found',
            ], 404);
        }

        $modifier->delete();

        $this->ensureRequiredModifiersSatisfied($cart->fresh(['product.modifierOptions', 'modifiers']));

        return response()->json([
            'success' => true,
            'message' => 'Tambahan item dihapus',
            'data' => [
                'cart' => $this->serializeCart($cart->fresh(['product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers'])),
            ],
        ]);
    }

    public function updateCartTenant(Request $request, $cart_id): JsonResponse
    {
        $validated = $request->validate([
            'tenant_outlet_id' => ['required', 'integer', 'exists:outlets,id'],
        ]);

        $cart = Cart::query()
            ->whereKey($cart_id)
            ->where('cashier_id', auth()->id())
            ->when($this->resolveActiveOutlet($request), fn ($query, $outlet) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->first();

        if (! $cart) {
            return response()->json([
                'success' => false,
                'message' => 'Cart item not found',
            ], 404);
        }

        $tenantOutlet = Outlet::query()
            ->active()
            ->whereKey($validated['tenant_outlet_id'])
            ->first();

        if (! $tenantOutlet) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant outlet tidak tersedia',
            ], 422);
        }

        $cart->forceFill([
            'tenant_outlet_id' => $tenantOutlet->id,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Tenant item berhasil diubah',
            'data' => [
                'cart_id' => $cart->id,
                'tenant_outlet_id' => $tenantOutlet->id,
                'tenant_outlet_name' => $tenantOutlet->name,
            ],
        ]);
    }

    private function serializeCart(?Cart $cart): ?array
    {
        if (! $cart) {
            return null;
        }

        $supportsPromoRewardMeta = Schema::hasColumn('carts', 'is_promo_reward');

        $productStock = $cart->product
            ? ($cart->outlet_id
                ? $this->stockMutationService->stockForOutlet($cart->product, (int) $cart->outlet_id)
                : (int) $cart->product->stock)
            : 0;

        return [
            'id' => $cart->id,
            'cashier_id' => $cart->cashier_id,
            'outlet_id' => $cart->outlet_id,
            'tenant_outlet_id' => $cart->tenant_outlet_id,
            'product_id' => $cart->product_id,
            'qty' => (int) $cart->qty,
            'price' => (int) $cart->price,
            'notes' => $cart->notes,
            'is_promo_reward' => $supportsPromoRewardMeta ? (bool) $cart->is_promo_reward : false,
            'promo_reward_rule_name' => $supportsPromoRewardMeta ? $cart->promo_reward_rule_name : null,
            'promo_reward_label' => $supportsPromoRewardMeta ? $cart->promo_reward_label : null,
            'promo_reward_meta' => $supportsPromoRewardMeta && $cart->is_promo_reward ? [
                'rule_name' => $cart->promo_reward_rule_name,
                'reward_label' => $cart->promo_reward_label,
            ] : null,
            'product' => $cart->product ? [
                'id' => $cart->product->id,
                'barcode' => $cart->product->barcode,
                'title' => $cart->product->title,
                'description' => $cart->product->description,
                'image' => $cart->product->image,
                'buy_price' => (int) $cart->product->buy_price,
                'sell_price' => (int) $cart->product->sell_price,
                'stock' => $productStock,
                'category_id' => $cart->product->category_id,
                'tenant_outlet_id' => $cart->product->tenant_outlet_id,
                'supports_modifiers' => (bool) $cart->product->supports_modifiers,
                'requires_modifier_selection' => (bool) $cart->product->requires_modifier_selection,
                'modifier_options' => $cart->product->modifierOptions
                    ->where('is_active', true)
                    ->map(fn ($option) => [
                        'id' => $option->id,
                        'name' => $option->name,
                        'price' => (int) $option->price,
                        'is_required' => (bool) $option->is_required,
                    ])
                    ->values()
                    ->all(),
            ] : null,
            'tenant_outlet' => $cart->tenantOutlet ? [
                'id' => $cart->tenantOutlet->id,
                'name' => $cart->tenantOutlet->name,
                'code' => $cart->tenantOutlet->code,
            ] : null,
            'modifiers' => $cart->modifiers
                ->map(fn ($modifier) => [
                    'id' => $modifier->id,
                    'name' => $modifier->name,
                    'qty' => (int) $modifier->qty,
                    'unit_price' => (int) $modifier->unit_price,
                    'total_price' => (int) $modifier->total_price,
                ])
                ->values()
                ->all(),
        ];
    }

    private function ensureRequiredModifiersSatisfied(?Cart $cart): void
    {
        if (! $cart || ! $cart->product) {
            return;
        }

        $requiredOptions = $cart->product->modifierOptions
            ->where('is_active', true)
            ->where('is_required', true)
            ->pluck('name')
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->values();

        $selectedModifierNames = $cart->modifiers
            ->pluck('name')
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->values();

        $hasRequiredSelection = $requiredOptions->isNotEmpty()
            ? $selectedModifierNames->intersect($requiredOptions)->isNotEmpty()
            : $selectedModifierNames->isNotEmpty();

        if ($requiredOptions->isNotEmpty() && ! $hasRequiredSelection) {
            throw ValidationException::withMessages([
                'modifier' => "Produk {$cart->product->title} wajib memilih salah satu topping yang ditandai wajib.",
            ]);
        }

        if ($requiredOptions->isEmpty()
            && (bool) $cart->product->requires_modifier_selection
            && $selectedModifierNames->isEmpty()) {
            throw ValidationException::withMessages([
                'modifier' => "Produk {$cart->product->title} wajib memilih minimal satu topping.",
            ]);
        }
    }

    /**
     * holdCart - Hold current cart items for later
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function holdCart(Request $request)
    {
        $request->validate([
            'label' => 'nullable|string|max:50',
        ]);

        $userId = auth()->user()->id;
        $outlet = $this->resolveActiveOutlet($request);

        // Get active cart items
        $activeCarts = Cart::where('cashier_id', $userId)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->get();

        if ($activeCarts->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Keranjang kosong, tidak ada yang bisa ditahan',
            ], 422);
        }

        // Generate unique hold ID
        $holdId = 'HOLD-'.strtoupper(uniqid());
        $label = $request->label ?: 'Transaksi '.now()->format('H:i');

        // Mark all active cart items as held
        Cart::where('cashier_id', $userId)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->update([
                'hold_id' => $holdId,
                'hold_label' => $label,
                'held_at' => now(),
            ]);

        return back()->with('success', 'Transaksi ditahan: '.$label);
    }

    /**
     * resumeCart - Resume a held cart
     *
     * @param  string  $holdId
     * @return \Illuminate\Http\JsonResponse
     */
    public function resumeCart($holdId)
    {
        $userId = auth()->user()->id;
        $outlet = $this->resolveActiveOutlet();

        // Check if there are any active carts (not held)
        $activeCarts = Cart::where('cashier_id', $userId)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->count();

        if ($activeCarts > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Selesaikan atau tahan transaksi aktif terlebih dahulu',
            ], 422);
        }

        // Get held carts
        $heldCarts = Cart::where('cashier_id', $userId)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->forHold($holdId)
            ->get();

        if ($heldCarts->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Transaksi ditahan tidak ditemukan',
            ], 404);
        }

        // Resume by clearing hold info
        Cart::where('cashier_id', $userId)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->forHold($holdId)
            ->update([
                'hold_id' => null,
                'hold_label' => null,
                'held_at' => null,
            ]);

        return back()->with('success', 'Transaksi dilanjutkan');
    }

    /**
     * clearHold - Delete a held cart
     *
     * @param  string  $holdId
     * @return \Illuminate\Http\JsonResponse
     */
    public function clearHold($holdId)
    {
        $userId = auth()->user()->id;
        $outlet = $this->resolveActiveOutlet();

        $deleted = Cart::where('cashier_id', $userId)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->forHold($holdId)
            ->delete();

        if ($deleted === 0) {
            return request()->wantsJson()
                ? response()->json([
                    'success' => false,
                    'message' => 'Transaksi ditahan tidak ditemukan',
                ], 404)
                : back()->with('error', 'Transaksi ditahan tidak ditemukan');
        }

        if (request()->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Transaksi ditahan berhasil dihapus',
            ]);
        }

        return back()->with('success', 'Transaksi ditahan berhasil dihapus');
    }

    /**
     * getHeldCarts - Get all held carts for current user
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getHeldCarts()
    {
        $userId = auth()->user()->id;
        $outlet = $this->resolveActiveOutlet();

        $heldCarts = Cart::with('product:id,title,sell_price,image')
            ->where('cashier_id', $userId)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->held()
            ->get()
            ->groupBy('hold_id')
            ->map(function ($items, $holdId) {
                $first = $items->first();

                return [
                    'hold_id' => $holdId,
                    'label' => $first->hold_label,
                    'held_at' => $first->held_at,
                    'items_count' => $items->sum('qty'),
                    'total' => $items->sum('price'),
                    'items' => $items->map(fn ($item) => [
                        'id' => $item->id,
                        'product' => $item->product,
                        'qty' => $item->qty,
                        'price' => $item->price,
                    ]),
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'held_carts' => $heldCarts,
        ]);
    }

    /**
     * store
     *
     * @param  mixed  $request
     * @return void
     */
    public function store(Request $request, PaymentGatewayManager $paymentGatewayManager)
    {
        $supportsDetailRewardMeta = Schema::hasColumn('transaction_details', 'is_promo_reward');
        $perfStartNs = hrtime(true);
        $perfMarks = [];
        $markPerf = static function (string $label) use (&$perfMarks) {
            $perfMarks[] = [$label, hrtime(true)];
        };
        $shouldPerfLog = $request->boolean('perf') || $request->headers->get('x-debug-perf') === '1';

        $validatedMeta = $request->validate([
            'order_type' => ['nullable', 'in:dine_in,take_away'],
            'table_id' => ['nullable', 'exists:dining_tables,id'],
            'reward_cart_meta' => ['nullable', 'array'],
            'reward_cart_meta.*.cart_id' => ['required_with:reward_cart_meta', 'string', 'max:64'],
            'reward_cart_meta.*.rule_name' => ['nullable', 'string', 'max:255'],
            'reward_cart_meta.*.reward_label' => ['nullable', 'string', 'max:255'],
        ]);
        $isPayLater = $request->boolean('pay_later');
        $paymentGateway = $isPayLater ? null : $request->input('payment_gateway');
        if ($paymentGateway) {
            $paymentGateway = strtolower($paymentGateway);
        }
        $paymentSetting = null;
        $outlet = $this->resolveActiveOutlet($request);

        if ($isPayLater && ! $request->filled('due_date')) {
            return $this->transactionStoreErrorResponse(
                $request,
                'Tanggal jatuh tempo wajib diisi untuk nota barang.'
            );
        }

        if ($paymentGateway) {
            $paymentSetting = PaymentSetting::resolveForOutlet($outlet?->id);

            if (! $paymentSetting || ! $paymentSetting->isGatewayReady($paymentGateway, $outlet?->id)) {
                return $this->transactionStoreErrorResponse(
                    $request,
                    'Gateway pembayaran belum dikonfigurasi.'
                );
            }
        }

        $invoice = $this->transactionInvoiceService->generate();
        $isCashPayment = empty($paymentGateway) && ! $isPayLater;
        $isManualQrisPayment = $paymentGateway === PaymentSetting::GATEWAY_QRIS;
        $manualDiscount = max(0, (int) $request->input('discount', 0));
        $shippingCost = max(0, (int) $request->input('shipping_cost', 0));
        $orderType = $validatedMeta['order_type'] ?? 'take_away';
        $tableId = $orderType === 'dine_in' ? ($validatedMeta['table_id'] ?? null) : null;
        $requestedRedeemPoints = max(0, (int) $request->input('redeem_points', 0));
        $cashAmount = $isCashPayment ? max(0, (int) $request->cash) : 0;
        $customer = $request->filled('customer_id')
            ? Customer::find($request->integer('customer_id'))
            : null;
        $voucher = $request->filled('customer_voucher_id')
            ? CustomerVoucher::find($request->integer('customer_voucher_id'))
            : null;

        /** @var Lock|null $storeLock */
        $storeLock = null;
        try {
            $lockKey = sprintf(
                'pos:transactions:store:%s:%s',
                (string) auth()->id(),
                (string) ($outlet?->id ?? 'global')
            );
            $storeLock = Cache::lock($lockKey, 30);
            if (! $storeLock->get()) {
                $message = 'Proses simpan sebelumnya masih berjalan. Tunggu beberapa detik lalu coba lagi.';

                return $request->expectsJson()
                    ? response()->json(['message' => $message], Response::HTTP_TOO_MANY_REQUESTS)
                    : redirect()->route('transactions.index')->with('error', $message);
            }
        } catch (\Throwable) {
            // If cache locks are not supported, continue without a lock.
        }

        try {
            $transaction = null;
            $postCommitWarnings = [];

            $cartScope = Cart::with('product', 'modifiers')
                ->where('cashier_id', auth()->id())
                ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
                ->active();

            $checkoutCarts = $cartScope->get();
            $this->applyRewardCartMeta($checkoutCarts, $validatedMeta['reward_cart_meta'] ?? []);
            $checkoutCarts = $this->pricingService->normalizeRewardCarts(
                $checkoutCarts,
                outletId: $outlet?->id
            );
            $markPerf('carts_loaded');

            if ($checkoutCarts->isEmpty()) {
                return $this->transactionStoreErrorResponse($request, 'Keranjang kosong.');
            }

        $cartSignature = $checkoutCarts
            ->map(fn (Cart $cart) => $cart->id.':'.$cart->product_id.':'.$cart->qty.':'.$cart->price)
            ->sort()
            ->values()
            ->implode('|');

        $pricingPreview = $this->pricingService->previewCart($checkoutCarts, $customer, outletId: $outlet?->id);
        $checkoutPreview = $this->loyaltyService->previewCheckout($pricingPreview, $customer, [
            'manual_discount' => $manualDiscount,
            'shipping_cost' => $shippingCost,
            'redeem_points' => $requestedRedeemPoints,
            'voucher' => $voucher,
        ], outletId: $outlet?->id);
        $pricingItems = collect($pricingPreview['items']);
        $subtotalAfterPromo = (int) data_get($pricingPreview, 'summary.subtotal_after_promo', 0);
        $voucherDiscount = (int) data_get($checkoutPreview, 'summary.voucher_discount_total', 0);
        $loyaltyDiscount = (int) data_get($checkoutPreview, 'summary.loyalty_discount_total', 0);
        $appliedManualDiscount = (int) data_get($checkoutPreview, 'summary.manual_discount_total', 0);
        $grandTotal = (int) data_get($checkoutPreview, 'summary.grand_total', 0);
        $redeemedPoints = (int) data_get($checkoutPreview, 'summary.applied_redeem_points', 0);
        $changeAmount = $isCashPayment ? max(0, $cashAmount - $grandTotal) : 0;

            $stockAuditPayloads = [];
            $transaction = DB::transaction(function () use (
                $request,
            $invoice,
            $cashAmount,
            $paymentGateway,
            $isCashPayment,
            $isManualQrisPayment,
            $isPayLater,
            $manualDiscount,
            $shippingCost,
            $requestedRedeemPoints,
            $customer,
            $voucher,
            $outlet,
            $orderType,
            $tableId,
            $cartSignature,
            $checkoutPreview,
            $pricingItems,
            $subtotalAfterPromo,
                $voucherDiscount,
                $loyaltyDiscount,
                $appliedManualDiscount,
                $supportsDetailRewardMeta,
                $grandTotal,
                $redeemedPoints,
                $changeAmount,
                &$perfMarks,
                $markPerf,
                $shouldPerfLog,
                &$stockAuditPayloads
            ) {
                $shiftStart = hrtime(true);
                $activeShift = $this->cashierShiftService->requireActiveShiftForUser(
                    auth()->user()->id,
                    $outlet?->id
                );
                $shiftMs = (hrtime(true) - $shiftStart) / 1e6;
                $perfMarks[] = ['shift_locked_ms', $shiftMs];
                $markPerf('shift_locked');

                $carts = Cart::with('product', 'modifiers')
                    ->where('cashier_id', auth()->user()->id)
                    ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
                    ->active()
                    ->get();
                $carts = $this->pricingService->normalizeRewardCarts(
                    $carts,
                    outletId: $outlet?->id
                );
                $markPerf('carts_reloaded');

                if ($carts->isEmpty()) {
                    abort(422, 'Keranjang kosong.');
                }

            $currentSignature = $carts
                ->map(fn (Cart $cart) => $cart->id.':'.$cart->product_id.':'.$cart->qty.':'.$cart->price)
                ->sort()
                ->values()
                ->implode('|');

            // If carts changed between pre-checkout preview and the transactional save,
            // recompute pricing inside the transaction to avoid mismatched totals.
                if ($currentSignature !== $cartSignature) {
                    $this->applyRewardCartMeta($carts, $validatedMeta['reward_cart_meta'] ?? []);
                    $carts = $this->pricingService->normalizeRewardCarts(
                        $carts,
                        outletId: $outlet?->id
                    );
                    $pricingPreview = $this->pricingService->previewCart($carts, $customer, outletId: $outlet?->id);
                    $checkoutPreview = $this->loyaltyService->previewCheckout($pricingPreview, $customer, [
                        'manual_discount' => $manualDiscount,
                        'shipping_cost' => $shippingCost,
                        'redeem_points' => $requestedRedeemPoints,
                        'voucher' => $voucher,
                    ], outletId: $outlet?->id);

                    $pricingItems = collect($pricingPreview['items']);
                    $subtotalAfterPromo = (int) data_get($pricingPreview, 'summary.subtotal_after_promo', 0);
                    $voucherDiscount = (int) data_get($checkoutPreview, 'summary.voucher_discount_total', 0);
                    $loyaltyDiscount = (int) data_get($checkoutPreview, 'summary.loyalty_discount_total', 0);
                    $appliedManualDiscount = (int) data_get($checkoutPreview, 'summary.manual_discount_total', 0);
                    $grandTotal = (int) data_get($checkoutPreview, 'summary.grand_total', 0);
                    $redeemedPoints = (int) data_get($checkoutPreview, 'summary.applied_redeem_points', 0);
                    $changeAmount = $isCashPayment ? max(0, $cashAmount - $grandTotal) : 0;

                    $markPerf('pricing_recomputed');
                }

            if ($orderType === 'dine_in') {
                if (! $tableId) {
                    abort(422, 'Meja wajib dipilih untuk transaksi dine in.');
                }

                $table = DiningTable::query()
                    ->where('outlet_id', $outlet?->id)
                    ->where('status', 'active')
                    ->find($tableId);

                if (! $table) {
                    abort(422, 'Meja tidak ditemukan atau tidak aktif.');
                }
            }

                $transaction = Transaction::create([
                'cashier_id' => auth()->user()->id,
                'cashier_shift_id' => $activeShift->id,
                'outlet_id' => $outlet?->id,
                'customer_id' => $request->customer_id,
                'order_type' => $orderType,
                'table_id' => $tableId,
                'invoice' => $invoice,
                'cash' => $cashAmount,
                'change' => $changeAmount,
                'discount' => $appliedManualDiscount,
                'loyalty_points_redeemed' => $redeemedPoints,
                'loyalty_discount_total' => $loyaltyDiscount,
                'customer_voucher_discount' => $voucherDiscount,
                'customer_voucher_code' => data_get($checkoutPreview, 'voucher.code'),
                'customer_voucher_name' => data_get($checkoutPreview, 'voucher.name'),
                'shipping_cost' => $shippingCost,
                'grand_total' => $grandTotal,
                'payment_method' => $isPayLater ? 'pay_later' : ($paymentGateway ?: 'cash'),
                'payment_status' => ($isCashPayment || $isManualQrisPayment) ? 'paid' : ($isPayLater ? 'unpaid' : 'pending'),
                'bank_account_id' => $paymentGateway === 'bank_transfer' ? $request->bank_account_id : null,
                ]);
                $markPerf('transaction_created');

                foreach ($carts as $cart) {
                $pricingItem = $pricingItems->firstWhere('cart_id', $cart->id);
                $lineTotal = (int) data_get($pricingItem, 'line_total', $cart->price);
                $linePromoDiscount = (int) data_get($pricingItem, 'line_discount_total', 0);
                $baseUnitPrice = (int) data_get($pricingItem, 'base_unit_price', $cart->product->sell_price);
                $unitPrice = (int) data_get($pricingItem, 'effective_unit_price', $cart->product->sell_price);

                $detailAttributes = [
                    'transaction_id' => $transaction->id,
                    'outlet_id' => $outlet?->id,
                    'tenant_outlet_id' => $cart->tenant_outlet_id ?: $outlet?->id,
                    'product_id' => $cart->product_id,
                    'qty' => $cart->qty,
                    'base_unit_price' => $baseUnitPrice,
                    'customer_base_unit_price' => (int) data_get($pricingItem, 'customer_base_unit_price', $cart->product->sell_price),
                    'tenant_base_unit_price' => (int) data_get($pricingItem, 'tenant_base_unit_price', $cart->product->buy_price),
                    'owner_markup_unit_price' => (int) data_get($pricingItem, 'owner_markup_unit_price', max(0, (int) $cart->product->sell_price - (int) $cart->product->buy_price)),
                    'unit_price' => $unitPrice,
                    'price' => $lineTotal,
                    'notes' => $cart->notes,
                    'discount_total' => $linePromoDiscount,
                    'tenant_discount_total' => (int) data_get($pricingItem, 'tenant_discount_total', 0),
                    'owner_discount_total' => (int) data_get($pricingItem, 'owner_discount_total', 0),
                    'tenant_net_total' => (int) data_get($pricingItem, 'tenant_net_total', ((int) $cart->product->buy_price * (int) $cart->qty)),
                    'owner_net_total' => (int) data_get($pricingItem, 'owner_net_total', max(0, ((int) $cart->product->sell_price - (int) $cart->product->buy_price) * (int) $cart->qty)),
                    'pricing_rule_id' => data_get($pricingItem, 'pricing_rule.id'),
                    'pricing_rule_name' => data_get($pricingItem, 'pricing_rule.name'),
                    'pricing_rule_kind' => data_get($pricingItem, 'pricing_rule.kind'),
                    'pricing_rule_price_basis' => data_get($pricingItem, 'pricing_rule.price_basis'),
                    'pricing_group_key' => data_get($pricingItem, 'pricing_group_key'),
                    'pricing_group_label' => data_get($pricingItem, 'pricing_group_label'),
                ];

                if ($supportsDetailRewardMeta) {
                    $detailAttributes['is_promo_reward'] = (bool) ($cart->is_promo_reward ?? false);
                    $detailAttributes['promo_reward_rule_name'] = $cart->promo_reward_rule_name ?? null;
                    $detailAttributes['promo_reward_label'] = $cart->promo_reward_label ?? null;
                }

                $detail = $transaction->details()->create($detailAttributes);

                foreach ($cart->modifiers as $modifier) {
                    $detail->modifiers()->create([
                        'name' => $modifier->name,
                        'qty' => (int) $modifier->qty,
                        'unit_price' => (int) $modifier->unit_price,
                        'total_price' => (int) $modifier->total_price,
                    ]);
                }

                $total_buy_price = $cart->product->buy_price * $cart->qty;
                $lineShare = $subtotalAfterPromo > 0 ? $lineTotal / $subtotalAfterPromo : 0;
                $allocatedManualDiscount = (int) round($appliedManualDiscount * $lineShare);
                $netSellPrice = max(0, $lineTotal - $allocatedManualDiscount);
                $profits = $netSellPrice - $total_buy_price;

                $transaction->profits()->create([
                    'transaction_id' => $transaction->id,
                    'total' => $profits,
                ]);

                $product = $cart->product;
                if (! isset($stockMutationItems)) {
                    $stockMutationItems = [];
                }
                    $stockMutationItems[] = [
                        'product' => $product,
                        'detail' => $detail,
                        'qty' => (int) $cart->qty,
                    ];
                }
                
                // Batch decrement stock - returns audit payloads to log AFTER transaction
                $stockAuditPayloads = $this->stockMutationService->decrementBatchForTransaction(
                    $stockMutationItems,
                    $transaction,
                    auth()->id()
                );
                $markPerf('details_saved');

                Cart::where('cashier_id', auth()->user()->id)
                    ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
                    ->active()
                    ->delete();
                $markPerf('carts_deleted');

                $this->loyaltyService->finalizeTransaction($transaction, $customer, $checkoutPreview);
                $markPerf('loyalty_finalized');

                if ($isPayLater) {
                    Receivable::create([
                    'outlet_id' => $outlet?->id,
                    'customer_id' => $request->customer_id,
                    'transaction_id' => $transaction->id,
                    'invoice' => $invoice,
                    'total' => $grandTotal,
                    'paid' => 0,
                    'due_date' => $request->due_date,
                    'status' => 'unpaid',
                ]);
            }

                return $transaction->fresh(['customer', 'waiter', 'diningTable']);
            });
            $markPerf('db_transaction_committed');

            // Batch audit log AFTER DB::transaction commits — single INSERT, no lock contention
            if (! empty($stockAuditPayloads)) {
                try {
                    $this->auditLogService->logBatch($stockAuditPayloads);
                    $markPerf('audit_logs_batched');
                } catch (\Throwable $exception) {
                    $postCommitWarnings[] = 'Audit stok belum seluruhnya tersimpan, tetapi transaksi sudah berhasil.';
                    $this->logPosException('pos.store.audit_log_batch_failed', $exception, [
                        'invoice' => $invoice,
                        'user_id' => auth()->id(),
                        'outlet_id' => $outlet?->id,
                    ]);
                }
            }

            $sideEffectTransaction = null;

            try {
                $sideEffectTransaction = $transaction->fresh(['details.product.kitchenStationMappings', 'details.modifiers']);
            } catch (\Throwable $exception) {
                $postCommitWarnings[] = 'Beberapa data turunan transaksi belum sempat dimuat ulang, tetapi transaksi sudah berhasil.';
                $this->logPosException('pos.store.transaction_fresh_failed', $exception, [
                    'invoice' => $invoice,
                    'user_id' => auth()->id(),
                    'outlet_id' => $outlet?->id,
                ]);
            }

            if ($sideEffectTransaction) {
                try {
                    $this->foodcourtTenantAllocationService->rebuildForTransaction($sideEffectTransaction);
                    $markPerf('tenant_allocation');
                } catch (\Throwable $exception) {
                    $postCommitWarnings[] = 'Alokasi tenant belum sempat diperbarui, tetapi transaksi sudah berhasil.';
                    $this->logPosException('pos.store.tenant_allocation_failed', $exception, [
                        'invoice' => $invoice,
                        'transaction_id' => $transaction?->id,
                        'user_id' => auth()->id(),
                        'outlet_id' => $outlet?->id,
                    ]);
                }

                try {
                    $this->kitchenTicketService->createForTransaction($sideEffectTransaction);
                    $markPerf('kitchen_tickets');
                } catch (\Throwable $exception) {
                    $postCommitWarnings[] = 'Ticket dapur belum sempat dibuat, tetapi transaksi sudah berhasil.';
                    $this->logPosException('pos.store.kitchen_ticket_failed', $exception, [
                        'invoice' => $invoice,
                        'transaction_id' => $transaction?->id,
                        'user_id' => auth()->id(),
                        'outlet_id' => $outlet?->id,
                    ]);
                }

                if (($sideEffectTransaction->payment_status ?? null) === 'paid') {
                    try {
                        $this->printJobService->queueReceipt($sideEffectTransaction, userId: auth()->id());
                        $markPerf('receipt_queued');
                    } catch (\Throwable $exception) {
                        $postCommitWarnings[] = 'Antrean cetak struk belum sempat dibuat, tetapi transaksi sudah berhasil.';
                        $this->logPosException('pos.store.receipt_queue_failed', $exception, [
                            'invoice' => $invoice,
                            'transaction_id' => $transaction?->id,
                            'user_id' => auth()->id(),
                            'outlet_id' => $outlet?->id,
                        ]);
                    }
                }
            }

        $paymentWarning = null;

        if ($paymentGateway && ! $isManualQrisPayment) {
            try {
                $paymentResponse = $paymentGatewayManager->createPayment($transaction, $paymentGateway, $paymentSetting);

                $transaction->update([
                    'payment_reference' => $paymentResponse['reference'] ?? null,
                    'payment_url' => $paymentResponse['payment_url'] ?? null,
                ]);
            } catch (PaymentGatewayException $exception) {
                $paymentWarning = $exception->getMessage();
            }
        }

            $combinedWarning = collect(array_filter([
                $paymentWarning,
                ...$postCommitWarnings,
            ]))->implode(' ');

            $transaction->load([
            'details.product',
            'details.modifiers',
            'details.pricingRule',
            'cashier',
            'waiter',
            'diningTable',
            'customer',
            'receivable',
            'bankAccount',
            'kitchenTickets.kitchenStation',
            'tenantAllocations.tenantOutlet:id,name,code',
            'tenantAllocations.items.product:id,title',
            ]);
            $markPerf('response_loaded');

            $totalMs = (hrtime(true) - $perfStartNs) / 1e6;
            if ($shouldPerfLog || $totalMs >= 5000) {
                Log::warning('pos.store.perf', [
                    'invoice' => $invoice,
                    'user_id' => auth()->id(),
                    'outlet_id' => $outlet?->id,
                    'total_ms' => (int) round($totalMs),
                    'marks' => $perfMarks,
                ]);
            }

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Transaksi berhasil disimpan.',
                    'warning' => $combinedWarning !== '' ? $combinedWarning : null,
                    'data' => [
                        'transaction' => $transaction,
                        'print_url' => route('transactions.print', [
                            'invoice' => $transaction->invoice,
                            'embedded' => 1,
                        ], false),
                        'receipt_print_url' => route('transactions.print', [
                            'invoice' => $transaction->invoice,
                            'embedded' => 1,
                            'autoprint' => 1,
                            'mode' => 'thermal58',
                        ], false),
                        'receipt_pdf_url' => route('pdf.transactions.receipt', [
                            'invoice' => $transaction->invoice,
                            'size' => '58',
                        ], false),
                    ],
                ], Response::HTTP_CREATED);
            }

            if ($combinedWarning !== '') {
                return redirect()
                    ->route('transactions.print', $transaction->invoice)
                    ->with('error', $combinedWarning);
            }

            return to_route('transactions.print', $transaction->invoice);
        } catch (\Throwable $exception) {
            $this->logPosException('pos.store.failed', $exception, [
                'invoice' => $invoice,
                'user_id' => auth()->id(),
                'outlet_id' => $outlet?->id,
                'customer_id' => $customer?->id,
                'order_type' => $orderType,
                'cart_items_count' => isset($checkoutCarts) ? $checkoutCarts->count() : null,
                'payment_gateway' => $paymentGateway,
                'pay_later' => $isPayLater,
                'total_ms' => (int) round((hrtime(true) - $perfStartNs) / 1e6),
                'marks' => $perfMarks,
            ]);

            return $this->transactionStoreExceptionResponse($request, $exception);
        } finally {
            if ($storeLock) {
                try {
                    $storeLock->release();
                } catch (\Throwable) {
                }
            }
        }
    }

    public function health(Request $request): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'server_time' => now()->toIso8601String(),
            'outlet_id' => $this->resolveActiveOutlet($request)?->id,
        ]);
    }

    private function resolveImageUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (Str::startsWith($path, ['http://', 'https://', '/storage/']) || Str::startsWith($path, 'data:')) {
            return $path;
        }

        return '/storage/'.ltrim($path, '/');
    }

    public function syncOffline(Request $request): JsonResponse
    {
        $supportsDetailRewardMeta = Schema::hasColumn('transaction_details', 'is_promo_reward');
        $validated = $request->validate([
            'offline_reference' => ['required', 'string', 'max:80'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'order_type' => ['nullable', 'in:dine_in,take_away'],
            'table_id' => ['nullable', 'integer', 'exists:dining_tables,id'],
            'cash' => ['required', 'integer', 'min:0'],
            'change' => ['nullable', 'integer', 'min:0'],
            'shipping_cost' => ['nullable', 'integer', 'min:0'],
            'grand_total' => ['required', 'integer', 'min:0'],
            'details' => ['required', 'array', 'min:1'],
            'details.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'details.*.tenant_outlet_id' => ['nullable', 'integer'],
            'details.*.qty' => ['required', 'integer', 'min:1'],
            'details.*.base_unit_price' => ['required', 'integer', 'min:0'],
            'details.*.unit_price' => ['required', 'integer', 'min:0'],
            'details.*.price' => ['required', 'integer', 'min:0'],
            'details.*.notes' => ['nullable', 'string'],
            'details.*.discount_total' => ['nullable', 'integer', 'min:0'],
            'details.*.pricing_rule_name' => ['nullable', 'string', 'max:255'],
            'details.*.pricing_rule_kind' => ['nullable', 'string', 'max:255'],
            'details.*.pricing_group_key' => ['nullable', 'string', 'max:255'],
            'details.*.pricing_group_label' => ['nullable', 'string', 'max:255'],
            'details.*.is_promo_reward' => ['nullable', 'boolean'],
            'details.*.promo_reward_rule_name' => ['nullable', 'string', 'max:255'],
            'details.*.promo_reward_label' => ['nullable', 'string', 'max:255'],
            'details.*.modifiers' => ['nullable', 'array'],
            'details.*.modifiers.*.name' => ['required_with:details.*.modifiers', 'string', 'max:255'],
            'details.*.modifiers.*.qty' => ['nullable', 'integer', 'min:1'],
            'details.*.modifiers.*.unit_price' => ['nullable', 'integer', 'min:0'],
            'details.*.modifiers.*.total_price' => ['nullable', 'integer', 'min:0'],
        ]);

        $outlet = $this->resolveActiveOutlet($request);
        $orderType = $validated['order_type'] ?? 'take_away';
        $tableId = $orderType === 'dine_in' ? ($validated['table_id'] ?? null) : null;

        if ($orderType === 'dine_in' && ! $tableId) {
            return response()->json([
                'message' => 'Meja wajib dipilih untuk sinkronisasi transaksi dine in.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $customer = ! empty($validated['customer_id'])
            ? Customer::find($validated['customer_id'])
            : null;

        /** @var Lock|null $syncLock */
        $syncLock = null;
        try {
            $lockKey = sprintf(
                'pos:transactions:sync-offline:%s:%s',
                (string) auth()->id(),
                (string) ($outlet?->id ?? 'global')
            );
            $syncLock = Cache::lock($lockKey, 30);
            if (! $syncLock->get()) {
                return response()->json([
                    'message' => 'Sinkronisasi offline sedang berjalan. Coba lagi sebentar.',
                ], Response::HTTP_TOO_MANY_REQUESTS);
            }
        } catch (\Throwable) {
        }

        $syncStartNs = hrtime(true);
        $supportsDetailRewardMeta = Schema::hasColumn('transaction_details', 'is_promo_reward');

        try {
            $transaction = DB::transaction(function () use ($validated, $outlet, $orderType, $tableId, $customer, $supportsDetailRewardMeta) {
                $activeShift = $this->cashierShiftService->requireActiveShiftForUser(
                    auth()->id(),
                    $outlet?->id
                );

            $invoice = $validated['offline_reference'];
            if (Transaction::query()->where('invoice', $invoice)->exists()) {
                $invoice = $invoice.'-'.Str::upper(Str::random(4));
            }

            $transaction = Transaction::create([
                'cashier_id' => auth()->id(),
                'cashier_shift_id' => $activeShift->id,
                'outlet_id' => $outlet?->id,
                'customer_id' => $customer?->id,
                'order_type' => $orderType,
                'table_id' => $tableId,
                'invoice' => $invoice,
                'cash' => (int) $validated['cash'],
                'change' => (int) ($validated['change'] ?? 0),
                'discount' => 0,
                'loyalty_points_redeemed' => 0,
                'loyalty_discount_total' => 0,
                'customer_voucher_discount' => 0,
                'shipping_cost' => (int) ($validated['shipping_cost'] ?? 0),
                'grand_total' => (int) $validated['grand_total'],
                'payment_method' => 'cash',
                'payment_status' => 'paid',
            ]);

            foreach ($validated['details'] as $row) {
                $product = Product::query()->findOrFail($row['product_id']);

                $detailAttributes = [
                    'transaction_id' => $transaction->id,
                    'outlet_id' => $outlet?->id,
                    'tenant_outlet_id' => $row['tenant_outlet_id'] ?? ($outlet?->id),
                    'product_id' => $product->id,
                    'qty' => (int) $row['qty'],
                    'base_unit_price' => (int) $row['base_unit_price'],
                    'unit_price' => (int) $row['unit_price'],
                    'price' => (int) $row['price'],
                    'notes' => $row['notes'] ?? null,
                    'discount_total' => (int) ($row['discount_total'] ?? 0),
                    'pricing_rule_name' => $row['pricing_rule_name'] ?? null,
                    'pricing_rule_kind' => $row['pricing_rule_kind'] ?? null,
                    'pricing_group_key' => $row['pricing_group_key'] ?? null,
                    'pricing_group_label' => $row['pricing_group_label'] ?? null,
                ];

                if ($supportsDetailRewardMeta) {
                    $detailAttributes['is_promo_reward'] = (bool) ($row['is_promo_reward'] ?? false);
                    $detailAttributes['promo_reward_rule_name'] = $row['promo_reward_rule_name'] ?? null;
                    $detailAttributes['promo_reward_label'] = $row['promo_reward_label'] ?? null;
                }

                $detail = $transaction->details()->create($detailAttributes);

                foreach (($row['modifiers'] ?? []) as $modifier) {
                    $detail->modifiers()->create([
                        'name' => $modifier['name'],
                        'qty' => (int) ($modifier['qty'] ?? 1),
                        'unit_price' => (int) ($modifier['unit_price'] ?? 0),
                        'total_price' => (int) ($modifier['total_price'] ?? 0),
                    ]);
                }

                $totalBuyPrice = (int) $product->buy_price * (int) $row['qty'];
                $profitTotal = (int) $row['price'] - $totalBuyPrice;

                $transaction->profits()->create([
                    'transaction_id' => $transaction->id,
                    'total' => $profitTotal,
                ]);

                $this->stockMutationService->decrementForTransactionDetail(
                    $product,
                    $transaction,
                    $detail,
                    (int) $row['qty'],
                    auth()->id()
                );
            }

                $this->foodcourtTenantAllocationService->rebuildForTransaction($transaction->fresh(['details']));
                $this->kitchenTicketService->createForTransaction($transaction->fresh(['details.product.kitchenStationMappings']));

                return $transaction->fresh([
                'details.product',
                'details.modifiers',
                'cashier',
                'diningTable',
                'customer',
                'bankAccount',
                'tenantAllocations.tenantOutlet:id,name,code',
                'tenantAllocations.items.product:id,title',
                ]);
            });

            $this->printJobService->queueReceipt($transaction, userId: auth()->id());

            return response()->json([
                'message' => 'Transaksi offline berhasil disinkronkan.',
                'data' => [
                    'transaction' => $transaction,
                    'print_url' => route('transactions.print', [
                        'invoice' => $transaction->invoice,
                        'embedded' => 1,
                    ], false),
                    'receipt_print_url' => route('transactions.print', [
                        'invoice' => $transaction->invoice,
                        'embedded' => 1,
                        'autoprint' => 1,
                        'mode' => 'thermal58',
                    ], false),
                    'receipt_pdf_url' => route('pdf.transactions.receipt', [
                        'invoice' => $transaction->invoice,
                        'size' => '58',
                    ], false),
                ],
            ], Response::HTTP_CREATED);
        } catch (\Throwable $exception) {
            $this->logPosException('pos.sync_offline.failed', $exception, [
                'offline_reference' => $validated['offline_reference'] ?? null,
                'user_id' => auth()->id(),
                'outlet_id' => $outlet?->id,
                'customer_id' => $customer?->id,
                'order_type' => $orderType,
                'details_count' => count($validated['details'] ?? []),
                'grand_total' => $validated['grand_total'] ?? null,
                'total_ms' => (int) round((hrtime(true) - $syncStartNs) / 1e6),
            ]);

            return $this->transactionExceptionJsonResponse($request, $exception, 'Sinkronisasi transaksi offline gagal.');
        } finally {
            if ($syncLock) {
                try {
                    $syncLock->release();
                } catch (\Throwable) {
                }
            }
        }
    }

    public function print(Request $request, $invoice)
    {
        // get transaction
        $transaction = Transaction::with(
            'details.product',
            'details.modifiers',
            'details.pricingRule',
            'cashier',
            'waiter',
            'diningTable',
            'customer',
            'receivable',
            'bankAccount',
            'kitchenTickets.kitchenStation',
            'tenantAllocations.tenantOutlet:id,name,code',
            'tenantAllocations.items.product:id,title'
        )
            ->where('invoice', $invoice)
            ->when($this->resolveActiveOutlet(), fn ($query, $outlet) => $query->where('outlet_id', $outlet->id))
            ->firstOrFail();

        return Inertia::render('Dashboard/Transactions/Print', [
            'transaction' => $transaction,
            'receiptLayout' => $this->receiptLayoutService->build(
                $transaction,
                $transaction->outlet?->profilePayload() ?? [],
                $request->query('mode') === 'thermal80' ? '80mm' : '58mm'
            ),
            'embedded' => $request->boolean('embedded'),
            'autoPrint' => $request->boolean('autoprint'),
            'initialMode' => in_array($request->query('mode'), ['invoice', 'thermal80', 'thermal58', 'shipping'], true)
                ? $request->query('mode')
                : 'thermal58',
        ]);
    }

    private function transactionStoreErrorResponse(Request $request, string $message)
    {
        if ($request->expectsJson()) {
            return response()->json([
                'message' => $message,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return redirect()
            ->route('transactions.index')
            ->with('error', $message);
    }

    private function transactionStoreExceptionResponse(Request $request, \Throwable $exception)
    {
        if ($request->expectsJson()) {
            return $this->transactionExceptionJsonResponse(
                $request,
                $exception,
                'Transaksi gagal disimpan.'
            );
        }

        $message = sprintf(
            'Transaksi gagal disimpan. [%s] %s (%s:%d)',
            $exception::class,
            $exception->getMessage(),
            $exception->getFile(),
            $exception->getLine()
        );

        return redirect()
            ->route('transactions.index')
            ->with('error', $message);
    }

    private function transactionExceptionJsonResponse(Request $request, \Throwable $exception, string $message): JsonResponse
    {
        $payload = [
            'message' => $message,
            'error' => [
                'type' => $exception::class,
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ],
            'details' => sprintf(
                '[%s] %s (%s:%d)',
                $exception::class,
                $exception->getMessage(),
                $exception->getFile(),
                $exception->getLine()
            ),
        ];

        return response()->json($payload, Response::HTTP_INTERNAL_SERVER_ERROR);
    }

    private function logPosException(string $event, \Throwable $exception, array $context = []): void
    {
        Log::error($event, array_merge($context, [
            'exception' => $exception::class,
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
        ]));
    }

    /**
     * Display transaction history.
     */
    public function history(Request $request)
    {
        $salesReturnTablesReady = Schema::hasTable('sales_returns') && Schema::hasTable('sales_return_items');

        $filters = [
            'invoice' => $request->input('invoice'),
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'customer_scope' => $request->input('customer_scope'),
        ];

        $query = Transaction::query()
            ->with([
                'cashier:id,name',
                'cashierShift:id,opened_at,status',
                'customer:id,name',
                'receivable',
                'tenantAllocations.tenantOutlet:id,name,code',
            ])
            ->when($this->resolveActiveOutlet($request), fn ($builder, $outlet) => $builder->where('outlet_id', $outlet->id))
            ->withSum('details as total_items', 'qty')
            ->withSum('details as total_promo_discount', 'discount_total')
            ->withSum('profits as total_profit', 'total')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($salesReturnTablesReady) {
            $query->with('details.salesReturnItems.salesReturn:id,status');
        }

        $query = $this->constrainHistoryTransactionsVisibleToUser($query, $request);

        $query
            ->when($filters['invoice'], function (Builder $builder, $invoice) {
                $builder->where('invoice', 'like', '%'.$invoice.'%');
            })
            ->when($filters['start_date'], function (Builder $builder, $date) {
                $builder->whereDate('created_at', '>=', $date);
            })
            ->when($filters['end_date'], function (Builder $builder, $date) {
                $builder->whereDate('created_at', '<=', $date);
            })
            ->when($filters['customer_scope'] === 'walk_in', function (Builder $builder) {
                $builder->whereNull('customer_id');
            })
            ->when($filters['customer_scope'] === 'registered', function (Builder $builder) {
                $builder->whereNotNull('customer_id');
            });

        $transactions = $query->paginate(10)->withQueryString();
        $transactions->through(function (Transaction $transaction) use ($salesReturnTablesReady) {
            $canCreateSalesReturn = false;
            $salesReturnSummary = [
                'completed_returns_count' => 0,
                'returned_items_qty' => 0,
                'returned_amount_total' => 0,
                'status' => 'none',
            ];

            if ($salesReturnTablesReady) {
                $allReturned = true;
                $completedReturnIds = collect();
                $returnedItemsQty = 0;
                $returnedAmountTotal = 0;

                foreach ($transaction->details as $detail) {
                    $completedReturnItems = $detail->salesReturnItems
                        ->filter(fn ($item) => $item->salesReturn?->status === 'completed');

                    $returnedQty = (int) $completedReturnItems->sum('qty_return');
                    $returnedItemsQty += $returnedQty;
                    $returnedAmountTotal += (int) $completedReturnItems->sum('subtotal_return');
                    $completedReturnIds = $completedReturnIds->merge(
                        $completedReturnItems
                            ->pluck('sales_return_id')
                            ->filter()
                    );

                    if ($returnedQty < (int) $detail->qty) {
                        $allReturned = false;
                    }
                }

                $canCreateSalesReturn = $transaction->details->isNotEmpty() && ! $allReturned;
                $salesReturnSummary = [
                    'completed_returns_count' => $completedReturnIds->unique()->count(),
                    'returned_items_qty' => $returnedItemsQty,
                    'returned_amount_total' => $returnedAmountTotal,
                    'status' => $returnedItemsQty <= 0
                        ? 'none'
                        : ($allReturned ? 'full' : 'partial'),
                ];
            }

            return [
                ...$transaction->toArray(),
                'total_discount' => (int) ($transaction->total_promo_discount ?? 0)
                    + (int) ($transaction->discount ?? 0)
                    + (int) ($transaction->loyalty_discount_total ?? 0)
                    + (int) ($transaction->customer_voucher_discount ?? 0),
                'can_create_sales_return' => $canCreateSalesReturn,
                'sales_return_summary' => $salesReturnSummary,
                'can_create_share_campaign' => (bool) $transaction->customer_id,
            ];
        });

        return Inertia::render('Dashboard/Transactions/History', [
            'transactions' => $transactions,
            'filters' => $filters,
            'salesReturnFeatureReady' => $salesReturnTablesReady,
        ]);
    }

    public function historyFeed(Request $request): JsonResponse
    {
        $filters = [
            'q' => trim((string) $request->input('q')),
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'customer_scope' => $request->input('customer_scope'),
            'payment_status' => $request->input('payment_status'),
            'payment_method' => $request->input('payment_method'),
            'per_page' => max(5, min(50, (int) $request->integer('per_page', 10))),
        ];

        $query = $this->buildTransactionHistoryModalQuery($request, includeDetails: true)
            ->when($filters['q'], function (Builder $builder, string $keyword) {
                $builder->where(function (Builder $nested) use ($keyword) {
                    $nested->where('invoice', 'like', '%'.$keyword.'%')
                        ->orWhereHas('customer', fn (Builder $customerQuery) => $customerQuery
                            ->where('name', 'like', '%'.$keyword.'%')
                            ->orWhere('no_telp', 'like', '%'.$keyword.'%'))
                        ->orWhereHas('cashier', fn (Builder $cashierQuery) => $cashierQuery
                            ->where('name', 'like', '%'.$keyword.'%'));
                });
            })
            ->when($filters['start_date'], fn (Builder $builder, $date) => $builder->whereDate('created_at', '>=', $date))
            ->when($filters['end_date'], fn (Builder $builder, $date) => $builder->whereDate('created_at', '<=', $date))
            ->when($filters['customer_scope'] === 'walk_in', fn (Builder $builder) => $builder->whereNull('customer_id'))
            ->when($filters['customer_scope'] === 'registered', fn (Builder $builder) => $builder->whereNotNull('customer_id'))
            ->when($filters['payment_status'], fn (Builder $builder, $status) => $builder->where('payment_status', $status))
            ->when($filters['payment_method'], fn (Builder $builder, $method) => $builder->where('payment_method', $method))
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        $transactions = $query->paginate($filters['per_page'])->withQueryString();

        return response()->json([
            'data' => $transactions->getCollection()->map(
                fn (Transaction $transaction) => $this->transformTransactionHistoryModalItem($transaction)
            )->values(),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
                'from' => $transactions->firstItem(),
                'to' => $transactions->lastItem(),
            ],
            'filters' => $filters,
        ]);
    }

    /**
     * Confirm payment for bank transfer transactions
     */
    public function confirmPayment(Transaction $transaction)
    {
        $outlet = $this->resolveActiveOutlet(request());
        if ($outlet && (int) $transaction->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        if ($transaction->payment_status === 'paid') {
            return redirect()
                ->back()
                ->with('error', 'Transaksi sudah dibayar.');
        }

        $beforeStatus = $transaction->payment_status;
        $transaction->update([
            'payment_status' => 'paid',
        ]);

        $this->auditLogService->log(
            event: 'transaction.payment_confirmed',
            module: 'transactions',
            auditable: $transaction,
            description: "Pembayaran untuk invoice {$transaction->invoice} dikonfirmasi.",
            before: [
                'invoice' => $transaction->invoice,
                'payment_method' => $transaction->payment_method,
                'payment_status' => $beforeStatus,
                'bank_account_id' => $transaction->bank_account_id,
            ],
            after: [
                'invoice' => $transaction->invoice,
                'payment_method' => $transaction->payment_method,
                'payment_status' => 'paid',
                'bank_account_id' => $transaction->bank_account_id,
            ],
            meta: [
                'invoice' => $transaction->invoice,
                'bank_account_id' => $transaction->bank_account_id,
            ],
        );

        return redirect()
            ->back()
            ->with('success', "Pembayaran untuk invoice {$transaction->invoice} berhasil dikonfirmasi.");
    }

    public function requeueReceipt(Request $request, Transaction $transaction): JsonResponse
    {
        $outlet = $this->resolveActiveOutlet($request);
        if ($outlet && (int) $transaction->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        if (! $request->user()->isSuperAdmin() && (int) $transaction->cashier_id !== (int) $request->user()->id) {
            abort(404);
        }

        if ($transaction->payment_status !== 'paid') {
            return response()->json([
                'message' => 'Hanya transaksi lunas yang bisa diminta cetak ulang ke queue.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $job = $this->printJobService->queueReceipt(
            $transaction,
            userId: $request->user()->id,
            forceRequeue: true
        );

        $this->auditLogService->log(
            event: 'transaction.receipt_requeued',
            module: 'transactions',
            auditable: $transaction,
            description: "Print ulang struk untuk invoice {$transaction->invoice} dimasukkan ke queue.",
            after: [
                'invoice' => $transaction->invoice,
                'print_job_id' => $job->id,
                'job_status' => $job->status,
            ],
        );

        return response()->json([
            'message' => "Struk {$transaction->invoice} berhasil dimasukkan ke antrean print.",
            'data' => [
                'print_job_id' => $job->id,
                'status' => $job->status,
            ],
        ]);
    }

    private function resolveActiveOutlet(?Request $request = null)
    {
        $request ??= request();

        return $this->outletResolver->resolve($request, $request->user());
    }

    private function buildTransactionHistoryModalQuery(Request $request, bool $includeDetails = false): Builder
    {
        $detailColumns = [
            'id',
            'transaction_id',
            'product_id',
            'qty',
            'price',
        ];

        foreach (['discount_total', 'base_unit_price', 'unit_price', 'pricing_rule_name', 'pricing_rule_kind', 'pricing_group_label', 'is_promo_reward', 'promo_reward_rule_name', 'promo_reward_label'] as $optionalColumn) {
            if (Schema::hasColumn('transaction_details', $optionalColumn)) {
                $detailColumns[] = $optionalColumn;
            }
        }

        $query = Transaction::query()
            ->with([
                'cashier:id,name',
                'waiter:id,name',
                'customer:id,name,no_telp',
                'diningTable:id,name,code',
                'bankAccount:id,bank_name,account_number',
                'tenantAllocations.tenantOutlet:id,name,code',
            ])
            ->when($includeDetails, fn (Builder $builder) => $builder->with([
                'details' => fn ($detailQuery) => $detailQuery
                    ->select($detailColumns)
                    ->with('product:id,title', 'modifiers', 'salesReturnItems.salesReturn:id,status'),
            ]))
            ->when($this->resolveActiveOutlet($request), fn (Builder $builder, $outlet) => $builder->where('outlet_id', $outlet->id))
            ->withSum('details as total_items', 'qty');

        $query = $this->constrainHistoryTransactionsVisibleToUser($query, $request);

        if (Schema::hasColumn('transaction_details', 'discount_total')) {
            $query->withSum('details as total_promo_discount', 'discount_total');
        }

        return $query;
    }

    private function transformTransactionHistoryModalItem(Transaction $transaction): array
    {
        $storePayload = $this->resolveActiveOutlet()?->profilePayload() ?? [];
        $salesReturnSummary = $this->buildTransactionSalesReturnSummary($transaction);

        return [
            'id' => $transaction->id,
            'invoice' => $transaction->invoice,
            'created_at' => optional($transaction->created_at)->toISOString(),
            'created_at_label' => optional($transaction->created_at)->format('d M Y H:i'),
            'order_type' => $transaction->order_type,
            'payment_method' => $transaction->payment_method,
            'payment_status' => $transaction->payment_status,
            'grand_total' => (int) $transaction->grand_total,
            'cash' => (int) ($transaction->cash ?? 0),
            'change' => (int) ($transaction->change ?? 0),
            'total_items' => (int) ($transaction->total_items ?? 0),
            'total_discount' => (int) ($transaction->total_promo_discount ?? 0)
                + (int) ($transaction->discount ?? 0)
                + (int) ($transaction->loyalty_discount_total ?? 0)
                + (int) ($transaction->customer_voucher_discount ?? 0),
            'sales_return_summary' => $salesReturnSummary,
            'can_create_sales_return' => ($transaction->relationLoaded('details')
                ? $transaction->details->isNotEmpty() && $salesReturnSummary['status'] !== 'full'
                : false),
            'cashier' => $transaction->cashier ? [
                'id' => $transaction->cashier->id,
                'name' => $transaction->cashier->name,
            ] : null,
            'customer' => $transaction->customer ? [
                'id' => $transaction->customer->id,
                'name' => $transaction->customer->name,
                'phone' => $transaction->customer->no_telp,
            ] : null,
            'table' => $transaction->diningTable ? [
                'id' => $transaction->diningTable->id,
                'name' => $transaction->diningTable->name,
                'code' => $transaction->diningTable->code,
            ] : null,
            'tenant_allocations' => $transaction->tenantAllocations->map(fn ($allocation) => [
                'id' => $allocation->id,
                'tenant_outlet_id' => $allocation->tenant_outlet_id,
                'tenant_outlet' => $allocation->tenantOutlet ? [
                    'id' => $allocation->tenantOutlet->id,
                    'name' => $allocation->tenantOutlet->name,
                    'code' => $allocation->tenantOutlet->code,
                ] : null,
            ])->values(),
            'details' => $transaction->relationLoaded('details')
                ? $transaction->details->map(fn ($detail) => [
                    'id' => $detail->id,
                    'product_name' => $detail->product?->title ?? "Produk #{$detail->product_id}",
                    'qty' => (int) $detail->qty,
                    'price' => (int) ($detail->unit_price ?? $detail->price),
                    'total' => (int) $detail->price,
                    'discount_total' => (int) ($detail->discount_total ?? 0),
                    'pricing_rule_name' => $detail->pricing_rule_name,
                    'pricing_rule_kind' => $detail->pricing_rule_kind,
                    'pricing_group_label' => $detail->pricing_group_label,
                    'is_promo_reward' => (bool) ($detail->is_promo_reward ?? false),
                    'promo_reward_rule_name' => $detail->promo_reward_rule_name,
                    'promo_reward_label' => $detail->promo_reward_label,
                ])->values()
                : [],
            'receiptLayout' => $this->receiptLayoutService->build($transaction, $storePayload, '58mm'),
        ];
    }

    private function buildTransactionSalesReturnSummary(Transaction $transaction): array
    {
        if (! $transaction->relationLoaded('details')) {
            return [
                'completed_returns_count' => 0,
                'returned_items_qty' => 0,
                'returned_amount_total' => 0,
                'status' => 'none',
            ];
        }

        $allReturned = true;
        $completedReturnIds = collect();
        $returnedItemsQty = 0;
        $returnedAmountTotal = 0;

        foreach ($transaction->details as $detail) {
            $completedReturnItems = $detail->salesReturnItems
                ? $detail->salesReturnItems->filter(fn ($item) => $item->salesReturn?->status === 'completed')
                : collect();

            $returnedQty = (int) $completedReturnItems->sum('qty_return');
            $returnedItemsQty += $returnedQty;
            $returnedAmountTotal += (int) $completedReturnItems->sum('subtotal_return');
            $completedReturnIds = $completedReturnIds->merge(
                $completedReturnItems->pluck('sales_return_id')->filter()
            );

            if ($returnedQty < (int) $detail->qty) {
                $allReturned = false;
            }
        }

        return [
            'completed_returns_count' => $completedReturnIds->unique()->count(),
            'returned_items_qty' => $returnedItemsQty,
            'returned_amount_total' => $returnedAmountTotal,
            'status' => $returnedItemsQty <= 0
                ? 'none'
                : ($allReturned ? 'full' : 'partial'),
        ];
    }

    private function constrainHistoryTransactionsVisibleToUser(Builder $query, Request $request): Builder
    {
        if ($request->user()->isSuperAdmin()) {
            return $query;
        }

        return $query->where(function (Builder $builder) use ($request) {
            $builder
                ->where('cashier_id', $request->user()->id)
                ->orWhereHas('cashierShift.operators', fn (Builder $operatorQuery) => $operatorQuery->where('users.id', $request->user()->id));
        });
    }

    private function findEditableCart(Request $request, int|string $cartId): ?Cart
    {
        return Cart::query()
            ->with('product.modifierOptions', 'tenantOutlet:id,name,code', 'modifiers')
            ->whereKey($cartId)
            ->where('cashier_id', auth()->id())
            ->when($this->resolveActiveOutlet($request), fn ($query, $outlet) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->first();
    }

    private function applyRewardCartMeta($carts, array $rewardCartMeta = []): void
    {
        $rewardMetaByCartId = collect($rewardCartMeta)
            ->mapWithKeys(fn (array $item) => [
                (string) ($item['cart_id'] ?? '') => [
                    'rule_name' => $item['rule_name'] ?? null,
                    'reward_label' => $item['reward_label'] ?? null,
                ],
            ]);

        foreach ($carts as $cart) {
            $meta = $rewardMetaByCartId->get((string) $cart->id);

            if (! $meta) {
                continue;
            }

            $cart->setAttribute('is_promo_reward', true);
            $cart->setAttribute('promo_reward_rule_name', $meta['rule_name']);
            $cart->setAttribute('promo_reward_label', $meta['reward_label']);
        }
    }

}
