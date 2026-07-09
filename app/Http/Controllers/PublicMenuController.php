<?php

namespace App\Http\Controllers;

use App\Exceptions\PaymentGatewayException;
use App\Models\BankAccount;
use App\Models\Category;
use App\Models\CashierShift;
use App\Models\Customer;
use App\Models\DiningTable;
use App\Models\Outlet;
use App\Models\PaymentSetting;
use App\Models\PricingRule;
use App\Models\Product;
use App\Models\ProductOutletStock;
use App\Models\Setting;
use App\Models\TableOrder;
use App\Models\TransactionDetail;
use App\Services\LoyaltyService;
use App\Services\Payments\PaymentGatewayManager;
use App\Services\ProductCatalogService;
use App\Services\PricingService;
use App\Services\StoreHoursService;
use App\Services\TableOrderService;

/**
 * Aturan baku status ketersediaan produk (berlaku di POS, daftar menu publik, dan self-order):
 *
 * Prioritas (tinggi ke rendah):
 * 1. outlet.is_active = false  → Tutup permanen → produk TIDAK DITAMPILKAN
 * 2. daily_store_open = false  → Tutup manual   → store_closed_reason = "store_closed"  → label "Toko Tutup"
 * 3. Jam di luar open–close    → Luar jam buka  → store_closed_reason = "outside_hours" → label "Belum Buka"
 * 4. stock = 0                 → Stok habis     → store_closed_reason = null, hasStock = false → label "Habis"
 * 5. Semua normal              → Buka           → store_closed_reason = null → tampil normal
 *
 * Sumber kebenaran: ProductCatalogService::resolveOutletClosedReason()
 * Jangan hardcode "outside_hours" di frontend; gunakan nilai dari backend.
 */
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PublicMenuController extends Controller
{
    public function __construct(
        private readonly PricingService $pricingService,
        private readonly ProductCatalogService $productCatalogService,
        private readonly TableOrderService $tableOrderService,
        private readonly StoreHoursService $storeHoursService,
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->resolveOutlet($request);
        $outletId = $outlet?->id;

        $categories = Category::query()
            ->select('id', 'name', 'description', 'image')
            ->orderBy('name')
            ->get()
            ->map(fn (Category $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'description' => $category->description,
                'image' => $category->image,
            ])
            ->values();

        $rules = $this->pricingService->getActiveRules(outletId: $outletId);

        $promoSummary = [
            'active_rules_count' => $rules->count(),
            'rule_kinds' => $rules->pluck('kind')->unique()->values()->all(),
            'counts_by_kind' => $rules->groupBy('kind')->map->count()->all(),
        ];

        $storeName = config('app.name', 'Toko');
        if ($outlet) {
            $storeName = $outlet->name ?? $storeName;
        }

        // Tenant yang punya produk — hanya outlet_type=tenant yang aktif
        $tenants = Outlet::whereIn('id', Product::whereNotNull('tenant_outlet_id')->distinct()->pluck('tenant_outlet_id'))
            ->active()
            ->tenant()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'sort_order', 'is_active'])
            ->map(function (Outlet $tenant) {
                // Pakai ProductCatalogService::resolveOutletClosedReason() sebagai sumber kebenaran.
                // Prioritas: store_closed (flag manual) > outside_hours (time-based) > null (buka).
                $closedReason = $this->productCatalogService->resolveOutletClosedReason($tenant->id);
                return [
                    'id'           => $tenant->id,
                    'name'         => $tenant->name,
                    'sort_order'   => (int) $tenant->sort_order,
                    'is_open'      => $closedReason === null,
                    'closed_reason' => $closedReason, // null | 'store_closed' | 'outside_hours'
                    'has_active_shift' => true, // tidak relevan untuk tenant
                    'open_time'    => (string) Setting::get('daily_store_open_time', '08:00', $tenant->id),
                    'close_time'   => (string) Setting::get('daily_store_close_time', '22:00', $tenant->id),
                ];
            })
            ->values();

        $storeHours = $this->resolveStoreHours($outlet);

        return inertia('Public/MenuCatalog', [
            'categories' => $categories,
            'promoSummary' => $promoSummary,
            'outlet' => $outlet ? [
                'id' => $outlet->id,
                'name' => $outlet->name,
                'code' => $outlet->code,
                'sort_order' => (int) $outlet->sort_order,
            ] : null,
            'store' => [
                'name' => $storeName,
                'logo' => null,
            ],
            'supportContact' => $outlet ? [
                'email' => $outlet->email ?? '',
                'phone' => $outlet->phone ?? '',
                'address' => $outlet->address ?? '',
            ] : [
                'email' => '',
                'phone' => '',
                'address' => '',
            ],
            'tenants' => $tenants,
            'storeHours' => $storeHours,
        ]);
    }

    public function products(Request $request)
    {
        $outlet = $this->resolveOutlet($request);
        $outletId = $outlet?->id;

        $query = Product::query()
            ->with([
                'category:id,name,description,image',
                'tenantOutlet:id,code,slug,name,sort_order',
                'modifierOptions',
            ])
            ->select([
                'id', 'image', 'barcode', 'sku', 'title', 'description',
                'buy_price', 'sell_price', 'stock', 'category_id',
                'tenant_outlet_id', 'supports_modifiers', 'requires_modifier_selection', 'created_at',
            ])
            ->when($request->filled('search'), fn ($b) => $b->where(fn ($q) => $q
                ->where('title', 'like', '%'.trim((string) $request->input('search')).'%')
                ->orWhere('sku', 'like', '%'.trim((string) $request->input('search')).'%')
                ->orWhere('barcode', 'like', '%'.trim((string) $request->input('search')).'%')
            ))
            ->when($request->filled('category_id'), fn ($b) => $b->where('category_id', (int) $request->input('category_id')))
            ->when($request->filled('tenant_outlet_id'), fn ($b) => $b->where('tenant_outlet_id', (int) $request->input('tenant_outlet_id')))
            ->orderBy('title');

        if ($request->has('include_out_of_stock') && ! $request->boolean('include_out_of_stock')) {
            $query->where('stock', '>', 0);
        }

        $products = $query->get()->map(function (Product $p) {
            $p->setAttribute('stock', (int) ($p->stock ?? 0));

            return $p;
        })->values();

        $soldQtyByProduct = TransactionDetail::query()
            ->selectRaw('product_id, SUM(qty) as sold_qty')
            ->whereNotNull('product_id')
            ->when(
                Schema::hasColumn('transaction_details', 'is_promo_reward'),
                fn ($builder) => $builder->where('is_promo_reward', false)
            )
            ->whereHas('transaction', fn ($builder) => $builder
                ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId)))
            ->groupBy('product_id')
            ->pluck('sold_qty', 'product_id');

        $mapped = $this->productCatalogService
            ->mapProductsForPosGrid($products, null, $outletId, [
                'soldQtyByProduct' => $soldQtyByProduct,
            ])
            ->map(fn (array $product) => [
                ...$product,
                'created_at' => optional(
                    $products->firstWhere('id', $product['id'])?->created_at
                )->toISOString(),
            ])
            ->values();

        if ($request->boolean('promo_only')) {
            $mapped = $mapped->filter(fn (array $p) => $p['pricing_badge'] !== null)->values();
        }

        $sort = $request->string('sort')->toString();
        $mapped = match ($sort) {
            'price_low' => $mapped->sortBy('effective_price')->values(),
            'price_high' => $mapped->sortByDesc('effective_price')->values(),
            'latest' => $mapped->sortByDesc('created_at')->values(),
            'promo_first' => $mapped->sortByDesc(fn (array $p) => $p['pricing_badge'] !== null)->values(),
            default => $mapped->sortBy('title')->values(),
        };

        return response()->json([
            'data' => $mapped->values()->all(),
            'meta' => ['total' => $mapped->count(), 'has_promos' => $mapped->contains(fn (array $p) => $p['pricing_badge'] !== null)],
        ]);
    }

    public function promos(Request $request)
    {
        $outlet = $this->resolveOutlet($request);
        $rules = $this->pricingService->getActiveRules(outletId: $outlet?->id);

        $payload = $rules->map(fn (PricingRule $r) => [
            'id' => $r->id,
            'name' => $r->name,
            'kind' => $r->kind,
            'discount_type' => $r->discount_type,
            'discount_value' => $r->discount_value !== null ? (float) $r->discount_value : null,
            'starts_at' => optional($r->starts_at)->toISOString(),
            'ends_at' => optional($r->ends_at)->toISOString(),
            'badge' => match ($r->kind) {
                PricingRule::KIND_BUY_X_GET_Y => ['text' => 'Buy X Get Y', 'tone' => 'success'],
                PricingRule::KIND_BUNDLE_PRICE => ['text' => 'Bundle', 'tone' => 'accent'],
                PricingRule::KIND_QTY_BREAK => ['text' => 'Grosir', 'tone' => 'warning'],
                default => ['text' => 'Promo', 'tone' => 'danger'],
            },
            'hero_image' => $r->product?->image,
            'hero_product' => $r->product ? ['id' => $r->product->id, 'title' => $r->product->title, 'sell_price' => (int) $r->product->sell_price, 'image' => $r->product->image] : null,
        ])->values();

        return response()->json(['data' => $payload, 'meta' => ['total' => $payload->count()]]);
    }

    public function storeStatus(Request $request)
    {
        $outlet = $this->resolveOutlet($request);

        return response()->json(['data' => $this->resolveStoreHours($outlet)]);
    }

    // ── Self-Order ────────────────────────────────────────────────────────────

    public function identify(Request $request)
    {
        $outlet = $this->resolveOutlet($request);
        $outletId = $outlet?->id ?? 0;

        $validated = $request->validate([
            'no_telp' => [
                'required', 'string', 'max:20',
                'regex:/^(?:\\+62|62|0)[0-9]{8,13}$/',
            ],
        ], [
            'no_telp.regex' => 'Format nomor HP tidak valid. Contoh: 0812xxxxxxx',
        ]);

        $customer = Customer::query()->where('no_telp', $validated['no_telp'])->first();

        if ($customer) {
            $request->session()->put($this->customerSessionKey($outletId), $customer->id);
            $request->session()->forget($this->pendingPhoneSessionKey($outletId));

            return response()->json([
                'status' => 'found',
                'customer' => $this->customerPayload($customer),
            ]);
        }

        $request->session()->forget($this->customerSessionKey($outletId));
        $request->session()->put($this->pendingPhoneSessionKey($outletId), $validated['no_telp']);

        return response()->json(['status' => 'not_found', 'no_telp' => $validated['no_telp']]);
    }

    public function registerIdentity(Request $request)
    {
        $outlet = $this->resolveOutlet($request);
        $outletId = $outlet?->id ?? 0;

        $pendingPhone = $request->session()->get($this->pendingPhoneSessionKey($outletId));
        abort_unless(filled($pendingPhone), 422, 'Nomor HP belum diisi. Mulai dari langkah identifikasi.');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('customers', 'email')],
            'address' => ['nullable', 'string', 'max:1000'],
        ]);

        $customer = Customer::create([
            'name' => $validated['name'],
            'no_telp' => (string) $pendingPhone,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? '',
            'is_loyalty_member' => false,
            'loyalty_tier' => LoyaltyService::TIER_REGULAR,
        ]);

        $request->session()->put($this->customerSessionKey($outletId), $customer->id);
        $request->session()->forget($this->pendingPhoneSessionKey($outletId));

        return response()->json([
            'status' => 'registered',
            'customer' => $this->customerPayload($customer),
        ], 201);
    }

    public function placeOrder(Request $request, PaymentGatewayManager $paymentGatewayManager)
    {
        $outlet = $this->resolveOutlet($request);
        $outletId = $outlet?->id ?? 0;

        $customer = $this->resolveSessionCustomer($request, $outletId);
        abort_unless($customer, 422, 'Identitas pembeli belum dipilih. Masukkan nomor HP terlebih dahulu.');

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
            'items.*.modifiers' => ['nullable', 'array'],
            'items.*.modifiers.*.id' => ['required', 'integer'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'payment_method' => ['nullable', 'string'],
        ]);

        $table = $this->resolveTakeawayTable($outlet);
        $order = $this->tableOrderService->createFromPublicMenu($table, $customer, $validated);

        $paymentMethod = strtolower((string) ($validated['payment_method'] ?? 'cash'));
        if (in_array($paymentMethod, [PaymentSetting::GATEWAY_XENDIT, PaymentSetting::GATEWAY_MIDTRANS], true) && $order->transaction) {
            try {
                $paymentSetting = PaymentSetting::resolveForOutlet($outletId);
                if ($paymentSetting && $paymentSetting->isGatewayReady($paymentMethod, $outletId)) {
                    $paymentResponse = $paymentGatewayManager->createPayment($order->transaction, $paymentMethod, $paymentSetting);
                    $order->transaction->update([
                        'payment_reference' => $paymentResponse['reference'] ?? null,
                        'payment_url' => $paymentResponse['payment_url'] ?? null,
                    ]);
                }
            } catch (PaymentGatewayException) {
                // Jangan batalkan order — customer tetap bisa bayar di kasir
            }
        }

        return response()->json([
            'status' => 'success',
            'access_token' => $order->access_token,
            'order_number' => $order->order_number,
            'redirect_url' => route('table-order.status', $order->access_token),
        ], 201);
    }

    public function orderStatus(Request $request, string $accessToken)
    {
        return redirect()->route('table-order.status', $accessToken);
    }

    public function logout(Request $request)
    {
        $outlet = $this->resolveOutlet($request);
        $outletId = $outlet?->id ?? 0;

        $request->session()->forget([
            $this->customerSessionKey($outletId),
            $this->pendingPhoneSessionKey($outletId),
        ]);

        return response()->json(['status' => 'ok']);
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

    /**
     * Cari atau buat DiningTable "Walk-in/Takeaway" untuk outlet ini,
     * agar self-order dari /daftarmenu bisa reuse TableOrderService.
     */
    private function resolveTakeawayTable(?Outlet $outlet): DiningTable
    {
        $outletId = $outlet?->id;

        $table = DiningTable::query()
            ->where('code', 'TAKEAWAY')
            ->where('status', 'active')
            ->where('self_order_enabled', true)
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->first();

        if (! $table) {
            $table = DiningTable::create([
                'outlet_id' => $outletId,
                'name' => 'Walk-in / Takeaway',
                'code' => 'TAKEAWAY',
                'capacity' => 0,
                'status' => 'active',
                'self_order_enabled' => true,
                'qr_token' => Str::uuid()->toString(),
                'sort_order' => 0,
            ]);
        }

        return $table;
    }

    private function resolveStoreHours(?Outlet $outlet): array
    {
        return $this->storeHoursService->resolve($outlet);
    }

    private function resolveSessionCustomer(Request $request, int $outletId): ?Customer
    {
        $customerId = $request->session()->get($this->customerSessionKey($outletId));
        if (! $customerId) {
            return null;
        }

        return Customer::query()->find($customerId);
    }

    private function customerPayload(Customer $customer): array
    {
        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'no_telp' => $customer->no_telp,
            'email' => $customer->email,
            'is_loyalty_member' => (bool) $customer->is_loyalty_member,
            'loyalty_tier' => $customer->loyalty_tier,
            'member_code' => $customer->member_code,
        ];
    }

    private function customerSessionKey(int $outletId): string
    {
        return "public_menu.customer_id.{$outletId}";
    }

    private function pendingPhoneSessionKey(int $outletId): string
    {
        return "public_menu.pending_phone.{$outletId}";
    }

    private function resolveOutlet(Request $request): ?Outlet
    {
        $code = $request->string('outlet_code')->toString();
        if ($code) {
            return Outlet::where('code', $code)->active()->first();
        }

        return Outlet::where('outlet_type', '!=', 'tenant')->active()->orderBy('name')->first();
    }
}
