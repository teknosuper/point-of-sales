<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\DiningTable;
use App\Models\Product;
use App\Models\ProductOutletStock;
use App\Models\TableOrder;
use App\Services\CustomerOutletMetricService;
use App\Services\LoyaltyService;
use App\Services\PricingService;
use App\Services\TableOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class PublicTableOrderController extends Controller
{
    public function __construct(
        private readonly TableOrderService $tableOrderService,
        private readonly LoyaltyService $loyaltyService,
        private readonly CustomerOutletMetricService $customerOutletMetricService,
        private readonly PricingService $pricingService
    ) {}

    public function show(string $qrToken)
    {
        $table = DiningTable::query()
            ->with('outlet:id,name,city')
            ->where('qr_token', $qrToken)
            ->where('status', 'active')
            ->where('self_order_enabled', true)
            ->firstOrFail();

        $products = Product::query()
            ->with(['category:id,name', 'modifierOptions', 'kitchenStationMappings.kitchenStation:id,name,code'])
            ->select('id', 'title', 'description', 'image', 'sell_price', 'stock', 'category_id', 'supports_modifiers')
            ->orderBy('title')
            ->when(Schema::hasTable('product_outlet_stocks'), function ($query) use ($table) {
                $query->whereHas('outletStocks', fn ($stockQuery) => $stockQuery
                    ->where('outlet_id', $table->outlet_id)
                    ->where('stock', '>', 0));
            }, fn ($query) => $query->where('stock', '>', 0))
            ->get()
            ->map(function (Product $product) use ($table) {
                $stock = Schema::hasTable('product_outlet_stocks')
                    ? ProductOutletStock::query()
                        ->where('outlet_id', $table->outlet_id)
                        ->where('product_id', $product->id)
                        ->value('stock')
                    : $product->stock;

                $product->setAttribute('stock', (int) ($stock ?? 0));

                return $product;
            })
            ->values();
        $pricingBadges = $this->pricingService->previewProducts($products, null, outletId: $table->outlet_id);
        $products = $products->map(function (Product $product) use ($pricingBadges) {
            $pricing = $pricingBadges->get($product->id);

            return [
                'id' => $product->id,
                'title' => $product->title,
                'description' => $product->description,
                'image' => $product->image,
                'sell_price' => (int) $product->sell_price,
                'stock' => (int) $product->stock,
                'supports_modifiers' => (bool) $product->supports_modifiers,
                'modifier_options' => $product->modifierOptions
                    ->where('is_active', true)
                    ->map(fn ($option) => [
                        'id' => $option->id,
                        'name' => $option->name,
                        'price' => (int) $option->price,
                    ])
                    ->values()
                    ->all(),
                'kitchen_stations' => $product->kitchenStationMappings
                    ->where('is_active', true)
                    ->sortBy('priority')
                    ->map(fn ($mapping) => [
                        'id' => $mapping->kitchenStation?->id,
                        'name' => $mapping->kitchenStation?->name,
                        'code' => $mapping->kitchenStation?->code,
                    ])
                    ->filter(fn (array $station) => filled($station['name']))
                    ->values()
                    ->all(),
                'category' => $product->category ? [
                    'id' => $product->category->id,
                    'name' => $product->category->name,
                ] : null,
                'pricing_badge' => $pricing && ! empty($pricing['pricing_rule']) ? [
                    'label' => $pricing['pricing_rule']['label'],
                    'promo_price' => $pricing['pricing_rule']['price_context']
                        ? $pricing['effective_unit_price']
                        : null,
                    'base_price' => $pricing['base_unit_price'],
                    'kind' => $pricing['pricing_rule']['kind'],
                ] : null,
            ];
        })->values();

        $identifiedCustomer = $this->resolvedPublicCustomer(request(), $table->outlet_id);

        return Inertia::render('Public/TableOrder/Menu', [
            'table' => [
                'id' => $table->id,
                'name' => $table->name,
                'code' => $table->code,
                'capacity' => (int) $table->capacity,
                'qr_token' => $table->qr_token,
            ],
            'outlet' => [
                'id' => $table->outlet?->id,
                'name' => $table->outlet?->name,
                'city' => $table->outlet?->city,
            ],
            'products' => $products,
            'identity' => [
                'customer' => $identifiedCustomer ? $this->customerPayload($identifiedCustomer, $table->outlet_id) : null,
                'pending_phone' => session()->get($this->pendingPhoneSessionKey($table->outlet_id)),
            ],
        ]);
    }

    public function identify(Request $request, string $qrToken)
    {
        $table = $this->resolveTable($qrToken);

        $validated = $request->validate([
            'no_telp' => ['required', 'string', 'max:50'],
        ]);

        $customer = Customer::query()
            ->where('no_telp', $validated['no_telp'])
            ->first();

        if ($customer) {
            $this->rememberPublicCustomer($request, $table->outlet_id, $customer);

            return redirect()
                ->route('table-order.show', $qrToken)
                ->with('success', 'Nomor hape ditemukan. Riwayat member/customer sudah terhubung.');
        }

        $request->session()->forget($this->customerSessionKey($table->outlet_id));
        $request->session()->put($this->pendingPhoneSessionKey($table->outlet_id), $validated['no_telp']);

        return redirect()
            ->route('table-order.show', $qrToken)
            ->with('info', 'Nomor hape belum terdaftar. Lengkapi nama, email, dan alamat opsional untuk lanjut.');
    }

    public function registerIdentity(Request $request, string $qrToken)
    {
        $table = $this->resolveTable($qrToken);
        $pendingPhone = $request->session()->get($this->pendingPhoneSessionKey($table->outlet_id));
        abort_unless(filled($pendingPhone), 422, 'Nomor hape belum diisi.');

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

        $this->rememberPublicCustomer($request, $table->outlet_id, $customer);

        return redirect()
            ->route('table-order.show', $qrToken)
            ->with('success', 'Profil pembeli dibuat. Sekarang Anda bisa order dari meja ini.');
    }

    public function logout(Request $request, string $qrToken)
    {
        $table = $this->resolveTable($qrToken);
        $request->session()->forget([
            $this->customerSessionKey($table->outlet_id),
            $this->pendingPhoneSessionKey($table->outlet_id),
        ]);

        return redirect()
            ->route('table-order.show', $qrToken)
            ->with('success', 'Sesi pembeli meja berhasil dihapus.');
    }

    public function store(Request $request, string $qrToken)
    {
        $table = $this->resolveTable($qrToken);
        $customer = $this->resolvedPublicCustomer($request, $table->outlet_id);
        abort_unless($customer, 422, 'Identitas pembeli belum dipilih.');

        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:50'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
            'items.*.modifiers' => ['nullable', 'array'],
            'items.*.modifiers.*.id' => ['required', 'integer', 'exists:product_modifier_options,id'],
        ]);

        $order = $this->tableOrderService->createFromPublicMenu($table, $customer, $validated);

        return redirect()->route('table-order.status', $order->access_token);
    }

    public function status(string $accessToken)
    {
        $order = TableOrder::query()
            ->with([
                'diningTable:id,name,code',
                'items.modifiers',
                'transaction:id,invoice,payment_status,payment_method,created_at',
            ])
            ->where('access_token', $accessToken)
            ->firstOrFail();

        return Inertia::render('Public/TableOrder/Status', [
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'customer_email' => $order->customer_email,
                'notes' => $order->notes,
                'payment_method' => $order->payment_method,
                'status' => $order->status,
                'subtotal' => (int) $order->subtotal,
                'grand_total' => (int) $order->grand_total,
                'approved_at' => optional($order->approved_at)->toISOString(),
                'created_at' => optional($order->created_at)->toISOString(),
                'table' => [
                    'name' => $order->diningTable?->name,
                    'code' => $order->diningTable?->code,
                    'qr_token' => $order->diningTable?->qr_token,
                ],
                'items' => $order->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_title' => $item->product_title,
                    'qty' => (int) $item->qty,
                    'unit_price' => (int) $item->unit_price,
                    'line_total' => (int) $item->line_total,
                    'notes' => $item->notes,
                    'modifiers' => $item->modifiers->map(fn ($modifier) => [
                        'id' => $modifier->id,
                        'name' => $modifier->name,
                        'qty' => (int) $modifier->qty,
                        'unit_price' => (int) $modifier->unit_price,
                        'total_price' => (int) $modifier->total_price,
                    ])->values(),
                ])->values(),
                'transaction' => $order->transaction ? [
                    'invoice' => $order->transaction->invoice,
                    'payment_status' => $order->transaction->payment_status,
                    'payment_method' => $order->transaction->payment_method,
                ] : null,
            ],
        ]);
    }

    private function resolveTable(string $qrToken): DiningTable
    {
        return DiningTable::query()
            ->where('qr_token', $qrToken)
            ->where('status', 'active')
            ->where('self_order_enabled', true)
            ->firstOrFail();
    }

    private function resolvedPublicCustomer(Request $request, int $outletId): ?Customer
    {
        $customerId = $request->session()->get($this->customerSessionKey($outletId));
        if (! $customerId) {
            return null;
        }

        return Customer::query()->find($customerId);
    }

    private function rememberPublicCustomer(Request $request, int $outletId, Customer $customer): void
    {
        $request->session()->put($this->customerSessionKey($outletId), $customer->id);
        $request->session()->forget($this->pendingPhoneSessionKey($outletId));
    }

    private function customerSessionKey(int $outletId): string
    {
        return "public_table_order.customer_id.{$outletId}";
    }

    private function pendingPhoneSessionKey(int $outletId): string
    {
        return "public_table_order.pending_phone.{$outletId}";
    }

    private function customerPayload(Customer $customer, int $outletId): array
    {
        $metrics = $this->customerOutletMetricService->metricsForCustomer($customer, $outletId);
        $recentTransactions = $customer->transactions()
            ->select('id', 'invoice', 'grand_total', 'payment_status', 'created_at', 'outlet_id')
            ->with('outlet:id,name')
            ->where('outlet_id', $outletId)
            ->latest('created_at')
            ->limit(5)
            ->get();

        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'no_telp' => $customer->no_telp,
            'email' => $customer->email,
            'address' => $customer->address,
            'is_loyalty_member' => (bool) $customer->is_loyalty_member,
            'member_code' => $customer->member_code,
            'loyalty_tier' => $this->loyaltyService->resolvedTier($customer, $outletId),
            'loyalty_points' => (int) $customer->loyalty_points,
            'loyalty_total_spent' => (int) ($metrics['total_spent'] ?? 0),
            'loyalty_transaction_count' => (int) ($metrics['transaction_count'] ?? 0),
            'last_purchase_at' => optional($metrics['last_purchase_at'] ?? null)->toIso8601String(),
            'recent_transactions' => $recentTransactions->map(fn ($transaction) => [
                'id' => $transaction->id,
                'invoice' => $transaction->invoice,
                'grand_total' => (int) $transaction->grand_total,
                'payment_status' => $transaction->payment_status,
                'created_at' => optional($transaction->created_at)->toIso8601String(),
                'outlet_name' => $transaction->outlet?->name,
            ])->values(),
        ];
    }
}
