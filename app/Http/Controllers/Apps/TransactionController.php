<?php

namespace App\Http\Controllers\Apps;

use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Customer;
use App\Models\CustomerVoucher;
use App\Models\Outlet;
use App\Models\PaymentSetting;
use App\Models\Product;
use App\Models\ProductOutletStock;
use App\Models\Receivable;
use App\Models\Transaction;
use App\Services\AuditLogService;
use App\Services\CashierShiftService;
use App\Services\FoodcourtTenantAllocationService;
use App\Services\KitchenTicketService;
use App\Services\LoyaltyService;
use App\Services\OutletResolver;
use App\Services\Payments\PaymentGatewayManager;
use App\Services\PricingService;
use App\Services\StockMutationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;

class TransactionController extends Controller
{
    public function __construct(
        private readonly CashierShiftService $cashierShiftService,
        private readonly AuditLogService $auditLogService,
        private readonly PricingService $pricingService,
        private readonly LoyaltyService $loyaltyService,
        private readonly OutletResolver $outletResolver,
        private readonly StockMutationService $stockMutationService,
        private readonly KitchenTicketService $kitchenTicketService,
        private readonly FoodcourtTenantAllocationService $foodcourtTenantAllocationService
    ) {}

    /**
     * index
     *
     * @return void
     */
    public function index()
    {
        $userId = auth()->user()->id;
        $outlet = $this->resolveActiveOutlet();
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($userId, $outlet?->id);

        // Get active cart items (not held)
        $carts = Cart::with('product', 'tenantOutlet:id,name,code')
            ->where('cashier_id', $userId)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->latest()
            ->get();

        $initialPricingPreview = $this->loyaltyService->previewCheckout(
            $this->pricingService->previewCart($carts, null, outletId: $outlet?->id),
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

        // get all products with categories for product grid
        $productsQuery = Product::with('category:id,name')
            ->select('id', 'barcode', 'title', 'description', 'image', 'buy_price', 'sell_price', 'stock', 'category_id', 'tenant_outlet_id')
            ->orderBy('title')
            ->when($outlet && Schema::hasTable('product_outlet_stocks'), function ($query) use ($outlet) {
                $query->whereHas('outletStocks', fn ($stockQuery) => $stockQuery
                    ->where('outlet_id', $outlet->id)
                    ->where('stock', '>', 0));
            }, fn ($query) => $query->where('stock', '>', 0));

        $products = $productsQuery->get()->map(function (Product $product) use ($outlet) {
            $stock = $outlet && Schema::hasTable('product_outlet_stocks')
                ? $product->outletStocks()->where('outlet_id', $outlet->id)->value('stock')
                : $product->stock;

            $product->setAttribute('stock', (int) ($stock ?? 0));

            return $product;
        });
        $pricingBadges = $this->pricingService->previewProducts($products, null, outletId: $outlet?->id);
        $products = $products->map(function (Product $product) use ($pricingBadges) {
            $pricing = $pricingBadges->get($product->id);

            return [
                ...$product->toArray(),
                'pricing_badge' => $pricing && ! empty($pricing['pricing_rule']) ? [
                    'label' => $pricing['pricing_rule']['label'],
                    'promo_price' => $pricing['pricing_rule']['price_context']
                        ? $pricing['effective_unit_price']
                        : null,
                    'base_price' => $pricing['base_unit_price'],
                    'kind' => $pricing['pricing_rule']['kind'],
                ] : null,
            ];
        });

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

        // Get active bank accounts for bank transfer
        $bankAccounts = \App\Models\BankAccount::active()
            ->ordered()
            ->when($outlet && Schema::hasColumn('bank_accounts', 'outlet_id'), fn ($query) => $query->where('outlet_id', $outlet->id))
            ->get();

        return Inertia::render('Dashboard/Transactions/Index', [
            'carts' => $carts,
            'carts_total' => $carts_total,
            'heldCarts' => $heldCarts,
            'customers' => $customers,
            'products' => $products,
            'categories' => $categories,
            'initialPricingPreview' => $initialPricingPreview,
            'paymentGateways' => $paymentSetting?->enabledGateways($outlet?->id) ?? [],
            'defaultPaymentGateway' => $defaultGateway,
            'bankAccounts' => $bankAccounts,
            'shiftSummary' => $this->cashierShiftService->summarizeForDisplay($activeShift),
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
        $validated = $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'discount' => ['nullable', 'integer', 'min:0'],
            'shipping_cost' => ['nullable', 'integer', 'min:0'],
            'redeem_points' => ['nullable', 'integer', 'min:0'],
            'customer_voucher_id' => ['nullable', 'integer', 'exists:customer_vouchers,id'],
        ]);

        $customer = isset($validated['customer_id'])
            ? Customer::find($validated['customer_id'])
            : null;
        $voucher = isset($validated['customer_voucher_id'])
            ? CustomerVoucher::find($validated['customer_voucher_id'])
            : null;

        $carts = Cart::with('product.category')
            ->where('cashier_id', $request->user()->id)
            ->when($this->resolveActiveOutlet($request), fn ($query, $outlet) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->latest()
            ->get();

        $pricingPreview = $this->pricingService->previewCart($carts, $customer, outletId: $this->resolveActiveOutlet($request)?->id);

        return response()->json([
            'success' => true,
            'data' => $this->loyaltyService->previewCheckout($pricingPreview, $customer, [
                'manual_discount' => (int) ($validated['discount'] ?? 0),
                'shipping_cost' => (int) ($validated['shipping_cost'] ?? 0),
                'redeem_points' => (int) ($validated['redeem_points'] ?? 0),
                'voucher' => $voucher,
            ], outletId: $this->resolveActiveOutlet($request)?->id),
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

        // Cari produk berdasarkan ID yang diberikan
        $product = Product::whereId($request->product_id)->first();

        // Jika produk tidak ditemukan, redirect dengan pesan error
        if (! $product) {
            return redirect()->back()->with('error', 'Product not found.');
        }

        // Cek stok produk
        $availableStock = $outlet
            ? $this->stockMutationService->stockForOutlet($product, $outlet->id)
            : (int) $product->stock;

        if ($availableStock < $request->qty) {
            return redirect()->back()->with('error', 'Out of Stock Product!.');
        }

        // Cek keranjang
        $cart = Cart::with('product')
            ->where('product_id', $request->product_id)
            ->where('cashier_id', auth()->user()->id)
            ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
            ->active()
            ->first();

        if ($cart) {
            // Tingkatkan qty
            $cart->increment('qty', $request->qty);

            // Jumlahkan harga * kuantitas
            $cart->price = $cart->product->sell_price * $cart->qty;

            $cart->save();
        } else {
            // Insert ke keranjang
            Cart::create([
                'cashier_id' => auth()->user()->id,
                'outlet_id' => $outlet?->id,
                'tenant_outlet_id' => $product->tenant_outlet_id ?: $outlet?->id,
                'product_id' => $request->product_id,
                'qty' => $request->qty,
                'price' => $request->sell_price * $request->qty,
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
    public function destroyCart($cart_id)
    {
        $cart = Cart::with('product')
            ->whereId($cart_id)
            ->where('cashier_id', auth()->id())
            ->when($this->resolveActiveOutlet(), fn ($query, $outlet) => $query->where('outlet_id', $outlet->id))
            ->first();

        if ($cart) {
            $cart->delete();

            return back();
        } else {
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

        $cart = Cart::with('product')->whereId($cart_id)
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

        return back()->with('success', 'Quantity updated successfully');
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
        $isPayLater = $request->boolean('pay_later');
        $paymentGateway = $isPayLater ? null : $request->input('payment_gateway');
        if ($paymentGateway) {
            $paymentGateway = strtolower($paymentGateway);
        }
        $paymentSetting = null;
        $outlet = $this->resolveActiveOutlet($request);

        if ($isPayLater && ! $request->filled('due_date')) {
            return redirect()
                ->route('transactions.index')
                ->with('error', 'Tanggal jatuh tempo wajib diisi untuk nota barang.');
        }

        if ($paymentGateway) {
            $paymentSetting = PaymentSetting::resolveForOutlet($outlet?->id);

            if (! $paymentSetting || ! $paymentSetting->isGatewayReady($paymentGateway, $outlet?->id)) {
                return redirect()
                    ->route('transactions.index')
                    ->with('error', 'Gateway pembayaran belum dikonfigurasi.');
            }
        }

        $length = 10;
        $random = '';
        for ($i = 0; $i < $length; $i++) {
            $random .= rand(0, 1) ? rand(0, 9) : chr(rand(ord('a'), ord('z')));
        }

        $invoice = 'TRX-'.Str::upper($random);
        $isCashPayment = empty($paymentGateway) && ! $isPayLater;
        $manualDiscount = max(0, (int) $request->input('discount', 0));
        $shippingCost = max(0, (int) $request->input('shipping_cost', 0));
        $requestedRedeemPoints = max(0, (int) $request->input('redeem_points', 0));
        $cashAmount = $isCashPayment ? max(0, (int) $request->cash) : 0;
        $customer = $request->filled('customer_id')
            ? Customer::find($request->integer('customer_id'))
            : null;
        $voucher = $request->filled('customer_voucher_id')
            ? CustomerVoucher::find($request->integer('customer_voucher_id'))
            : null;

        $transaction = DB::transaction(function () use (
            $request,
            $invoice,
            $cashAmount,
            $paymentGateway,
            $isCashPayment,
            $isPayLater,
            $manualDiscount,
            $shippingCost,
            $requestedRedeemPoints,
            $customer,
            $voucher,
            $outlet
        ) {
            $activeShift = $this->cashierShiftService->requireActiveShiftForUser(
                auth()->user()->id,
                $outlet?->id,
                lockForUpdate: true
            );

            $carts = Cart::with('product')
                ->where('cashier_id', auth()->user()->id)
                ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
                ->active()
                ->get();

            if ($carts->isEmpty()) {
                abort(422, 'Keranjang kosong.');
            }

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
            $changeAmount = $isCashPayment ? max(0, $cashAmount - $grandTotal) : 0;

            $transaction = Transaction::create([
                'cashier_id' => auth()->user()->id,
                'cashier_shift_id' => $activeShift->id,
                'outlet_id' => $outlet?->id,
                'customer_id' => $request->customer_id,
                'invoice' => $invoice,
                'cash' => $cashAmount,
                'change' => $changeAmount,
                'discount' => $appliedManualDiscount,
                'loyalty_points_redeemed' => (int) data_get($checkoutPreview, 'summary.applied_redeem_points', 0),
                'loyalty_discount_total' => $loyaltyDiscount,
                'customer_voucher_discount' => $voucherDiscount,
                'customer_voucher_code' => data_get($checkoutPreview, 'voucher.code'),
                'customer_voucher_name' => data_get($checkoutPreview, 'voucher.name'),
                'shipping_cost' => $shippingCost,
                'grand_total' => $grandTotal,
                'payment_method' => $isPayLater ? 'pay_later' : ($paymentGateway ?: 'cash'),
                'payment_status' => $isCashPayment ? 'paid' : ($isPayLater ? 'unpaid' : 'pending'),
                'bank_account_id' => $paymentGateway === 'bank_transfer' ? $request->bank_account_id : null,
            ]);

            foreach ($carts as $cart) {
                $pricingItem = $pricingItems->firstWhere('cart_id', $cart->id);
                $lineTotal = (int) data_get($pricingItem, 'line_total', $cart->price);
                $linePromoDiscount = (int) data_get($pricingItem, 'line_discount_total', 0);
                $baseUnitPrice = (int) data_get($pricingItem, 'base_unit_price', $cart->product->sell_price);
                $unitPrice = (int) data_get($pricingItem, 'effective_unit_price', $cart->product->sell_price);

                $detail = $transaction->details()->create([
                    'transaction_id' => $transaction->id,
                    'outlet_id' => $outlet?->id,
                    'tenant_outlet_id' => $cart->tenant_outlet_id ?: $outlet?->id,
                    'product_id' => $cart->product_id,
                    'qty' => $cart->qty,
                    'base_unit_price' => $baseUnitPrice,
                    'unit_price' => $unitPrice,
                    'price' => $lineTotal,
                    'discount_total' => $linePromoDiscount,
                    'pricing_rule_id' => data_get($pricingItem, 'pricing_rule.id'),
                    'pricing_rule_name' => data_get($pricingItem, 'pricing_rule.name'),
                    'pricing_rule_kind' => data_get($pricingItem, 'pricing_rule.kind'),
                    'pricing_group_key' => data_get($pricingItem, 'pricing_group_key'),
                    'pricing_group_label' => data_get($pricingItem, 'pricing_group_label'),
                ]);

                $total_buy_price = $cart->product->buy_price * $cart->qty;
                $lineShare = $subtotalAfterPromo > 0 ? $lineTotal / $subtotalAfterPromo : 0;
                $allocatedManualDiscount = (int) round($appliedManualDiscount * $lineShare);
                $netSellPrice = max(0, $lineTotal - $allocatedManualDiscount);
                $profits = $netSellPrice - $total_buy_price;

                $transaction->profits()->create([
                    'transaction_id' => $transaction->id,
                    'total' => $profits,
                ]);

                $product = Product::find($cart->product_id);
                $this->stockMutationService->decrementForTransactionDetail(
                    $product,
                    $transaction,
                    $detail,
                    (int) $cart->qty,
                    auth()->id()
                );
            }

            Cart::where('cashier_id', auth()->user()->id)
                ->when($outlet, fn ($query) => $query->where('outlet_id', $outlet->id))
                ->active()
                ->delete();

            $this->loyaltyService->finalizeTransaction($transaction, $customer, $checkoutPreview);
            $this->foodcourtTenantAllocationService->rebuildForTransaction($transaction->fresh(['details']));
            $this->kitchenTicketService->createForTransaction($transaction->fresh(['details.product.kitchenStationMappings']));

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

            return $transaction->fresh(['customer']);
        });

        if ($paymentGateway) {
            try {
                $paymentResponse = $paymentGatewayManager->createPayment($transaction, $paymentGateway, $paymentSetting);

                $transaction->update([
                    'payment_reference' => $paymentResponse['reference'] ?? null,
                    'payment_url' => $paymentResponse['payment_url'] ?? null,
                ]);
            } catch (PaymentGatewayException $exception) {
                return redirect()
                    ->route('transactions.print', $transaction->invoice)
                    ->with('error', $exception->getMessage());
            }
        }

        return to_route('transactions.print', $transaction->invoice);
    }

    public function print($invoice)
    {
        // get transaction
        $transaction = Transaction::with(
            'details.product',
            'details.pricingRule',
            'cashier',
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
        ]);
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
            ->withSum('profits as total_profit', 'total')
            ->orderByDesc('created_at');

        if ($salesReturnTablesReady) {
            $query->with('details.salesReturnItems.salesReturn:id,status');
        }

        if (! $request->user()->isSuperAdmin()) {
            $query->where('cashier_id', $request->user()->id);
        }

        $query
            ->when($filters['invoice'], function (Builder $builder, $invoice) {
                $builder->where('invoice', 'like', '%'.$invoice.'%');
            })
            ->when($filters['start_date'], function (Builder $builder, $date) {
                $builder->whereDate('created_at', '>=', $date);
            })
            ->when($filters['end_date'], function (Builder $builder, $date) {
                $builder->whereDate('created_at', '<=', $date);
            });

        $transactions = $query->paginate(10)->withQueryString();
        $transactions->through(function (Transaction $transaction) use ($salesReturnTablesReady) {
            $canCreateSalesReturn = false;

            if ($salesReturnTablesReady) {
                $allReturned = true;

                foreach ($transaction->details as $detail) {
                    $returnedQty = (int) $detail->salesReturnItems
                        ->filter(fn ($item) => $item->salesReturn?->status === 'completed')
                        ->sum('qty_return');

                    if ($returnedQty < (int) $detail->qty) {
                        $allReturned = false;
                        break;
                    }
                }

                $canCreateSalesReturn = $transaction->details->isNotEmpty() && ! $allReturned;
            }

            return [
                ...$transaction->toArray(),
                'can_create_sales_return' => $canCreateSalesReturn,
            ];
        });

        return Inertia::render('Dashboard/Transactions/History', [
            'transactions' => $transactions,
            'filters' => $filters,
            'salesReturnFeatureReady' => $salesReturnTablesReady,
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

    private function resolveActiveOutlet(?Request $request = null)
    {
        $request ??= request();

        return $this->outletResolver->resolve($request, $request->user());
    }
}
