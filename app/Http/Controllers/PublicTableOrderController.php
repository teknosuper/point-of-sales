<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\DiningTable;
use App\Models\BankAccount;
use App\Models\PaymentSetting;
use App\Models\Product;
use App\Models\ProductOutletStock;
use App\Models\TableOrder;
use App\Models\TableOrderItem;
use App\Models\Transaction;
use App\Models\User;
use App\Models\TransactionDetail;
use App\Services\CustomerOutletMetricService;
use App\Exceptions\PaymentGatewayException;
use App\Services\LoyaltyService;
use App\Services\Payments\PaymentGatewayManager;
use App\Services\ProductCatalogService;
use App\Services\StoreHoursService;
use App\Services\TableOrderService;
use App\Support\ReportTimezone;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class PublicTableOrderController extends Controller
{
    public function __construct(
        private readonly TableOrderService $tableOrderService,
        private readonly LoyaltyService $loyaltyService,
        private readonly CustomerOutletMetricService $customerOutletMetricService,
        private readonly ProductCatalogService $productCatalogService,
        private readonly StoreHoursService $storeHoursService,
    ) {}

    public function show(Request $request, string $qrToken)
    {
        $table = DiningTable::query()
            ->with('outlet:id,name,city,is_active,outlet_type,parent_outlet_id')
            ->where('qr_token', $qrToken)
            ->where('status', 'active')
            ->where('self_order_enabled', true)
            ->firstOrFail();

        $identifiedCustomer = $this->resolvedPublicCustomer($request, $table->outlet_id);
        $editableOrder = $this->resolveEditableOrder($request, $table, $identifiedCustomer);

        $products = Product::query()
            ->with([
                'category:id,name',
                'modifierOptions',
                'tenantOutlet:id,name,code,slug,sort_order',
                'kitchenStationMappings.kitchenStation:id,name,code',
            ])
            ->select(
                'id',
                'title',
                'description',
                'image',
                'barcode',
                'sku',
                'buy_price',
                'sell_price',
                'stock',
                'category_id',
                'tenant_outlet_id',
                'supports_modifiers',
                'requires_modifier_selection'
            )
            ->orderBy('title')
            ->get()
            ->map(function (Product $product) {
                $product->setAttribute('stock', (int) ($product->stock ?? 0));

                return $product;
            })
            ->values();
        $soldQtyByProduct = TransactionDetail::query()
            ->selectRaw('product_id, SUM(qty) as sold_qty')
            ->whereNotNull('product_id')
            ->when(
                Schema::hasColumn('transaction_details', 'is_promo_reward'),
                fn ($query) => $query->where('is_promo_reward', false)
            )
            ->whereHas('transaction', fn ($query) => $query->where('outlet_id', $table->outlet_id))
            ->groupBy('product_id')
            ->pluck('sold_qty', 'product_id');

        $products = $this->productCatalogService->mapProductsForPosGrid(
            $products,
            null,
            $table->outlet_id,
            [
                'soldQtyByProduct' => $soldQtyByProduct,
                'includeKitchenStations' => true,
            ]
        );

        $recommendations = $this->recommendationPayload(
            $products,
            $table->outlet_id,
            $identifiedCustomer
        );
        $paymentSetting = PaymentSetting::resolveForOutlet($table->outlet_id);
        $paymentMethods = collect($paymentSetting?->enabledGateways($table->outlet_id) ?? [])
            ->reject(fn (array $gateway) => ($gateway['value'] ?? null) === PaymentSetting::GATEWAY_QRIS)
            ->values();
        $selfOrderPaymentMethods = collect([
            [
                'value' => 'cash',
                'label' => 'Bayar di Kasir',
                'description' => 'Pesanan dikirim dulu ke kasir, lalu pembayaran di-approve kasir seperti alur sekarang.',
                'kind' => 'cashier',
            ],
        ])->concat(
            $paymentMethods->map(fn (array $gateway) => [
                'value' => (string) $gateway['value'],
                'label' => (string) $gateway['label'],
                'description' => (string) $gateway['description'],
                'kind' => in_array($gateway['value'], [PaymentSetting::GATEWAY_XENDIT, PaymentSetting::GATEWAY_MIDTRANS, PaymentSetting::GATEWAY_PAKASIR], true)
                    ? 'online'
                    : 'manual',
            ])
        )->values();
        $bankAccounts = BankAccount::query()
            ->active()
            ->where('outlet_id', $table->outlet_id)
            ->ordered()
            ->get(['id', 'bank_name', 'account_number', 'account_name', 'logo', 'outlet_id', 'is_active', 'sort_order']);

        $outletId = $table->outlet_id;
        $outletRecord = $table->outlet;

        // is_permanently_closed harus mengecek outlet MAIN, bukan tenant.
        $mainOutletRecord = ($outletRecord && $outletRecord->outlet_type === 'tenant' && $outletRecord->parent_outlet_id)
            ? \App\Models\Outlet::find($outletRecord->parent_outlet_id)
            : $outletRecord;

        // Daftar tenant aktif untuk filter dapur — pakai aturan baku:
        // closed_reason = null (buka) | 'store_closed' | 'outside_hours'
        $tenantOutlets = \App\Models\Outlet::activeTenantOutletsWithProducts()
            ->map(fn ($t) => [
                'id'            => $t->id,
                'name'          => $t->name,
                'sort_order'    => $t->sort_order,
                'closed_reason' => $this->productCatalogService->resolveOutletClosedReason($t->id),
                'open_time'     => (string) \App\Models\Setting::get('daily_store_open_time', '08:00', $t->id),
                'close_time'    => (string) \App\Models\Setting::get('daily_store_close_time', '22:00', $t->id),
            ])
            ->values();

        // storeHours via service terpusat — konsisten dengan daftar menu dan POS
        $storeHours = $this->storeHoursService->resolve($mainOutletRecord);
        // Override outlet_id agar setting dibaca dari outlet yang benar (bukan main jika meja milik tenant)
        if ($mainOutletRecord && $mainOutletRecord->id !== $outletId) {
            $storeHours = array_merge($storeHours, $this->storeHoursService->resolve($outletRecord));
            $storeHours['is_permanently_closed'] = $mainOutletRecord ? ! (bool) $mainOutletRecord->is_active : false;
        }

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
            'storeHours' => $storeHours,
            'products' => $products,
            'recommendations' => $recommendations,
            'identity' => [
                'customer' => $identifiedCustomer ? $this->customerPayload($identifiedCustomer, $table->outlet_id) : null,
                'pending_phone' => session()->get($this->pendingPhoneSessionKey($table->outlet_id)),
            ],
            'editableOrder' => $editableOrder ? [
                'id' => $editableOrder->id,
                'access_token' => $editableOrder->access_token,
                'order_number' => $editableOrder->order_number,
                'notes' => $editableOrder->notes,
                'items' => $editableOrder->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => (int) ($item->product_id ?? 0),
                    'qty' => (int) ($item->qty ?? 0),
                    'notes' => $item->notes,
                    'modifiers' => $item->modifiers->map(fn ($modifier) => [
                        'id' => (int) ($modifier->product_modifier_option_id ?? 0),
                        'name' => $modifier->name,
                        'group_name' => $modifier->group_name,
                        'unit_price' => (int) ($modifier->unit_price ?? 0),
                    ])->values(),
                ])->values(),
            ] : null,
            'tenantOutlets' => $tenantOutlets,
            'paymentMethods' => $selfOrderPaymentMethods,
            'bankAccounts' => $bankAccounts->map(fn (BankAccount $bankAccount) => [
                'id' => (int) $bankAccount->id,
                'bank_name' => $bankAccount->bank_name,
                'account_number' => $bankAccount->account_number,
                'account_name' => $bankAccount->account_name,
                'logo_url' => $bankAccount->logo_url,
            ])->values(),
        ]);
    }

    public function identify(Request $request, string $qrToken)
    {
        $table = $this->resolveTable($qrToken);

        $validated = $request->validate([
            'no_telp' => [
                'required',
                'string',
                'max:20',
                'regex:/^(?:\\+62|62|0)[0-9]{8,13}$/',
            ],
        ], [
            'no_telp.regex' => 'Format nomor hape tidak valid. Gunakan angka saja, misalnya 0812xxxxxxx atau 62812xxxxxxx.',
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

    public function store(Request $request, string $qrToken, PaymentGatewayManager $paymentGatewayManager)
    {
        $table = $this->resolveTable($qrToken);
        $customer = $this->resolvedPublicCustomer($request, $table->outlet_id);
        abort_unless($customer, 422, 'Identitas pembeli belum dipilih.');

        $validated = $this->validatePublicOrderPayload($request, $table->outlet_id);
        $order = $this->tableOrderService->createFromPublicMenu($table, $customer, $validated);

        $paymentMethod = strtolower((string) ($validated['payment_method'] ?? 'cash'));

        if (in_array($paymentMethod, [PaymentSetting::GATEWAY_XENDIT, PaymentSetting::GATEWAY_MIDTRANS, PaymentSetting::GATEWAY_PAKASIR], true) && $order->transaction) {
            try {
                $this->refreshPaymentLink($order, $paymentGatewayManager);
            } catch (PaymentGatewayException $exception) {
                return redirect()
                    ->route('table-order.status', $order->access_token)
                    ->with('error', $exception->getMessage());
            }
        }

        return redirect()->route('table-order.status', $order->access_token);
    }

    public function preview(Request $request, string $qrToken)
    {
        $table = $this->resolveTable($qrToken);
        $customer = $this->resolvedPublicCustomer($request, $table->outlet_id);
        abort_unless($customer, 422, 'Identitas pembeli belum dipilih.');

        $validated = $this->validatePublicOrderPayload($request, $table->outlet_id);
        $preview = $this->tableOrderService->previewPublicMenu($table, $customer, $validated);

        return response()->json($preview['pricing_preview'] ?? [
            'items' => [],
            'summary' => [
                'grand_total' => (int) ($preview['grand_total'] ?? 0),
            ],
        ]);
    }

    public function status(Request $request, string $accessToken, PaymentGatewayManager $paymentGatewayManager)
    {
        $order = TableOrder::query()
            ->with([
                'diningTable:id,name,code,qr_token',
                'items.product:id,title,stock',
                'items.modifiers',
                'transaction:id,invoice,payment_status,payment_method,payment_reference,payment_url,payment_payload,payment_expires_at,bank_account_id,created_at',
                'transaction.bankAccount:id,bank_name,account_number,account_name,logo',
                'transaction.kitchenTickets:id,transaction_id,kitchen_station_id,ticket_number,status,notes,fired_at,acknowledged_at,ready_at,completed_at,created_at',
                'transaction.kitchenTickets.kitchenStation:id,name,code',
                'transaction.kitchenTickets.items:id,kitchen_ticket_id,product_title,qty,status,notes,completed_at',
                'customer:id,name,no_telp,email,address,is_loyalty_member,member_code,loyalty_tier,loyalty_points',
            ])
            ->where('access_token', $accessToken)
            ->firstOrFail();

        $this->ensurePakasirPaymentPayload($order, $paymentGatewayManager);
        $order = $this->syncPendingOnlineOrderStatus($order, $paymentGatewayManager);

        $stockAlerts = $order->items
            ->map(function (TableOrderItem $item) {
                $currentStock = (int) ($item->product?->stock ?? 0) + (int) ($item->qty ?? 0);
                $requestedQty = (int) ($item->qty ?? 0);

                if ($currentStock >= $requestedQty) {
                    return null;
                }

                return [
                    'item_id' => $item->id,
                    'product_id' => (int) ($item->product_id ?? 0),
                    'product_title' => $item->product_title,
                    'requested_qty' => $requestedQty,
                    'current_stock' => $currentStock,
                    'issue_type' => $currentStock <= 0 ? 'out_of_stock' : 'insufficient_stock',
                ];
            })
            ->filter()
            ->values();

        return Inertia::render('Public/TableOrder/Status', [
            'order' => [
                'id' => $order->id,
                'access_token' => $order->access_token,
                'order_number' => $order->order_number,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'customer_email' => $order->customer_email,
                'notes' => $order->notes,
                'payment_method' => $order->payment_method,
                'status' => $order->status,
                'can_cancel' => $order->status === 'pending_cashier_payment' && $order->transaction_id === null,
                'can_adjust_items' => $order->status === 'pending_cashier_payment' && $order->transaction_id === null,
                'subtotal' => $order->resolvedSubtotal(),
                'base_subtotal' => (int) $order->items->sum(fn ($item) => ((int) ($item->base_unit_price ?? $item->unit_price) * (int) $item->qty) + (int) $item->modifiers->sum('total_price')),
                'discount_total' => (int) $order->items->sum('discount_total'),
                'payment_fee_total' => max(0, $order->resolvedGrandTotal() - $order->resolvedSubtotal()),
                'grand_total' => $order->resolvedGrandTotal(),
                'approved_at' => ReportTimezone::formatSourceIso8601($order->getRawOriginal('approved_at')),
                'created_at' => ReportTimezone::formatSourceIso8601($order->getRawOriginal('created_at')),
                'created_at_label' => ReportTimezone::formatSourceDateTime($order->getRawOriginal('created_at'), 'd M Y H:i'),
                'approved_at_label' => ReportTimezone::formatSourceDateTime($order->getRawOriginal('approved_at'), 'd M Y H:i'),
                'table' => [
                    'name' => $order->diningTable?->name,
                    'code' => $order->diningTable?->code,
                    'qr_token' => $order->diningTable?->qr_token,
                ],
                'items' => $order->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => (int) ($item->product_id ?? 0),
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
                        'product_modifier_option_id' => (int) ($modifier->product_modifier_option_id ?? 0),
                        'group_name' => $modifier->group_name,
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
                    'payment_reference' => $order->transaction->payment_reference,
                    'payment_url' => $order->transaction->payment_url,
                    'payment_payload' => $order->transaction->payment_payload,
                    'payment_expires_at' => $order->transaction->payment_expires_at?->toIso8601String(),
                    'created_at' => ReportTimezone::formatSourceIso8601($order->transaction->getRawOriginal('created_at')),
                    'created_at_label' => ReportTimezone::formatSourceDateTime($order->transaction->getRawOriginal('created_at'), 'd M Y H:i'),
                    'bank_account' => $order->transaction->bankAccount ? [
                        'id' => (int) $order->transaction->bankAccount->id,
                        'bank_name' => $order->transaction->bankAccount->bank_name,
                        'account_number' => $order->transaction->bankAccount->account_number,
                        'account_name' => $order->transaction->bankAccount->account_name,
                        'logo_url' => $order->transaction->bankAccount->logo_url,
                    ] : null,
                    'kitchen_tickets' => $order->transaction->kitchenTickets->map(fn ($ticket) => [
                        'id' => $ticket->id,
                        'ticket_number' => $ticket->ticket_number,
                        'status' => $ticket->status,
                        'notes' => $ticket->notes,
                        'created_at_label' => ReportTimezone::formatSourceDateTime($ticket->getRawOriginal('created_at'), 'd M Y H:i'),
                        'fired_at_label' => ReportTimezone::formatSourceDateTime($ticket->getRawOriginal('fired_at'), 'd M Y H:i'),
                        'acknowledged_at_label' => ReportTimezone::formatSourceDateTime($ticket->getRawOriginal('acknowledged_at'), 'd M Y H:i'),
                        'ready_at_label' => ReportTimezone::formatSourceDateTime($ticket->getRawOriginal('ready_at'), 'd M Y H:i'),
                        'completed_at_label' => ReportTimezone::formatSourceDateTime($ticket->getRawOriginal('completed_at'), 'd M Y H:i'),
                        'station' => [
                            'name' => $ticket->kitchenStation?->name,
                            'code' => $ticket->kitchenStation?->code,
                        ],
                        'items' => $ticket->items->map(fn ($item) => [
                            'id' => $item->id,
                            'product_title' => $item->product_title,
                            'qty' => (int) $item->qty,
                            'status' => $item->status,
                            'notes' => $item->notes,
                            'completed_at_label' => ReportTimezone::formatSourceDateTime($item->getRawOriginal('completed_at'), 'd M Y H:i'),
                        ])->values(),
                    ])->values(),
                ] : null,
                'stock_alerts' => $stockAlerts->all(),
            ],
            'identity' => [
                'customer' => $order->customer
                    ? $this->customerPayload(
                        $order->customer,
                        (int) $order->outlet_id,
                        max(1, (int) $request->integer('orders_page', 1)),
                        max(1, (int) $request->integer('transactions_page', 1))
                    )
                    : null,
            ],
        ]);
    }

    public function cancelStatus(Request $request, string $accessToken)
    {
        $order = TableOrder::query()
            ->where('access_token', $accessToken)
            ->firstOrFail();

        if ($order->status !== 'pending_cashier_payment' || $order->transaction_id !== null) {
            throw ValidationException::withMessages([
                'order' => 'Pesanan ini sudah tidak bisa dibatalkan dari halaman pelanggan.',
            ]);
        }

        $actor = User::query()->orderBy('id')->firstOrFail();
        $this->tableOrderService->cancel(
            $order,
            $actor,
            'Pesanan dibatalkan dari halaman pelanggan.'
        );

        return redirect()
            ->route('table-order.status', $order->access_token)
            ->with('success', 'Pesanan berhasil dibatalkan.');
    }

    public function regeneratePaymentLink(string $accessToken, PaymentGatewayManager $paymentGatewayManager)
    {
        $order = TableOrder::query()
            ->with('transaction')
            ->where('access_token', $accessToken)
            ->firstOrFail();

        if (! $order->transaction) {
            throw ValidationException::withMessages([
                'order' => 'Pesanan ini belum memiliki transaksi pembayaran online.',
            ]);
        }

        if ($order->status === 'paid' || $order->transaction->payment_status === 'paid') {
            return redirect()
                ->route('table-order.status', $order->access_token)
                ->with('info', 'Pembayaran order ini sudah berhasil, link tidak perlu dibuat ulang.');
        }

        try {
            $this->refreshPaymentLink($order, $paymentGatewayManager);
        } catch (PaymentGatewayException $exception) {
            return redirect()
                ->route('table-order.status', $order->access_token)
                ->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('table-order.status', $order->access_token)
            ->with('success', 'Link pembayaran berhasil dibuat ulang.');
    }

    public function checkPaymentStatus(string $accessToken, PaymentGatewayManager $paymentGatewayManager)
    {
        $order = TableOrder::query()
            ->with('transaction')
            ->where('access_token', $accessToken)
            ->firstOrFail();

        $transaction = $order->transaction;
        if (! $transaction) {
            throw ValidationException::withMessages([
                'order' => 'Transaksi pembayaran untuk order ini belum tersedia.',
            ]);
        }

        $paymentMethod = strtolower((string) ($transaction->payment_method ?? $order->payment_method ?? ''));
        if (! in_array($paymentMethod, [PaymentSetting::GATEWAY_XENDIT, PaymentSetting::GATEWAY_PAKASIR], true)) {
            throw ValidationException::withMessages([
                'payment_method' => 'Cek status langsung saat ini hanya tersedia untuk pembayaran online yang didukung.',
            ]);
        }

        $paymentSetting = PaymentSetting::resolveForOutlet((int) $order->outlet_id);
        if (! $paymentSetting || ! $paymentSetting->isGatewayReady($paymentMethod, (int) $order->outlet_id)) {
            throw ValidationException::withMessages([
                'payment_method' => 'Konfigurasi gateway pembayaran online belum lengkap untuk outlet ini.',
            ]);
        }

        try {
            $invoice = $paymentGatewayManager->fetchPaymentStatus($transaction, $paymentMethod, $paymentSetting);
        } catch (PaymentGatewayException $exception) {
            return redirect()
                ->route('table-order.status', $order->access_token)
                ->with('error', $exception->getMessage());
        }

        $mappedStatus = match ($paymentMethod) {
            PaymentSetting::GATEWAY_PAKASIR => match (strtolower((string) ($invoice['status'] ?? 'pending'))) {
                'completed', 'paid', 'settled' => 'paid',
                'expired', 'failed', 'cancelled', 'canceled' => 'failed',
                default => 'pending',
            },
            default => match (strtoupper((string) ($invoice['status'] ?? 'PENDING'))) {
                'PAID', 'SETTLED' => 'paid',
                'EXPIRED', 'FAILED' => 'failed',
                default => 'pending',
            },
        };
        $previousStatus = (string) ($transaction->payment_status ?? '');

        $transaction->update([
            'payment_status' => $mappedStatus,
            'payment_reference' => $invoice['id'] ?? $invoice['order_id'] ?? $transaction->payment_reference,
            'payment_url' => $invoice['invoice_url'] ?? $transaction->payment_url,
            'payment_expires_at' => $invoice['expired_at'] ?? $transaction->payment_expires_at,
        ]);

        if ($mappedStatus === 'paid' && $previousStatus !== 'paid') {
            $this->tableOrderService->finalizePublicPayment($transaction->fresh());
        }

        return redirect()
            ->route('table-order.status', $order->access_token)
            ->with(
                $mappedStatus === 'paid' ? 'success' : 'info',
                $mappedStatus === 'paid'
                    ? 'Status pembayaran online berhasil diperbarui. Pesanan sudah dinyatakan lunas.'
                    : "Status pembayaran online saat ini: {$mappedStatus}."
            );
    }

    public function removeUnavailableItems(string $accessToken)
    {
        $order = TableOrder::query()
            ->with(['items.product:id,stock', 'items.modifiers'])
            ->where('access_token', $accessToken)
            ->firstOrFail();

        if ($order->status !== 'pending_cashier_payment' || $order->transaction_id !== null) {
            throw ValidationException::withMessages([
                'order' => 'Pesanan ini sudah tidak bisa diubah dari halaman pelanggan.',
            ]);
        }

        $remainingItems = $order->items
            ->filter(function (TableOrderItem $item) {
                $currentStock = (int) ($item->product?->stock ?? 0) + (int) ($item->qty ?? 0);
                return $currentStock >= (int) ($item->qty ?? 0);
            })
            ->map(fn (TableOrderItem $item) => [
                'product_id' => (int) ($item->product_id ?? 0),
                'qty' => (int) ($item->qty ?? 0),
                'notes' => $item->notes,
                'modifier_ids' => $item->modifiers
                    ->map(fn ($modifier) => [
                        'id' => (int) ($modifier->product_modifier_option_id ?? 0),
                    ])
                    ->filter(fn (array $modifier) => $modifier['id'] > 0)
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();

        $actor = User::query()->orderBy('id')->firstOrFail();
        $updatedOrder = $this->tableOrderService->updateItems($order, $remainingItems, $actor);

        $message = $updatedOrder->status === 'cancelled'
            ? 'Semua item kosong dihapus dan pesanan dibatalkan karena tidak ada menu tersisa.'
            : 'Menu yang stoknya kosong berhasil dihapus dari pesanan.';

        return redirect()
            ->route('table-order.status', $updatedOrder->access_token)
            ->with('success', $message);
    }

    public function updateStatusItems(Request $request, string $accessToken)
    {
        $order = TableOrder::query()
            ->where('access_token', $accessToken)
            ->firstOrFail();

        $customer = $this->resolvedPublicCustomer($request, (int) $order->outlet_id);
        abort_unless($customer && (int) $customer->id === (int) $order->customer_id, 403);

        if ($order->status !== 'pending_cashier_payment' || $order->transaction_id !== null) {
            throw ValidationException::withMessages([
                'order' => 'Pesanan ini sudah tidak bisa diubah dari halaman pelanggan.',
            ]);
        }

        try {
            $validated = $this->validatePublicOrderPayload($request, (int) $order->outlet_id);
            $items = collect($validated['items'] ?? [])
                ->map(fn (array $item) => [
                    'product_id' => (int) ($item['product_id'] ?? 0),
                    'qty' => (int) ($item['qty'] ?? 0),
                    'notes' => filled($item['notes'] ?? null) ? (string) $item['notes'] : null,
                    'modifier_ids' => collect($item['modifiers'] ?? [])
                        ->map(fn (array $modifier) => ['id' => (int) ($modifier['id'] ?? 0)])
                        ->filter(fn (array $modifier) => $modifier['id'] > 0)
                        ->values()
                        ->all(),
                ])
                ->values()
                ->all();

            $actor = User::query()->orderBy('id')->firstOrFail();
            $updatedOrder = $this->tableOrderService->updateItems($order, $items, $actor);
            $updatedOrder->update([
                'notes' => filled($validated['notes'] ?? null) ? (string) $validated['notes'] : null,
            ]);
        } catch (ValidationException $exception) {
            return redirect()
                ->route('table-order.status', $order->access_token)
                ->withErrors($exception->errors())
                ->withInput();
        }

        return redirect()
            ->route('table-order.status', $updatedOrder->access_token)
            ->with('success', 'Pesanan berhasil diperbarui. Silakan lanjutkan pembayaran ke kasir.');
    }

    private function resolveTable(string $qrToken): DiningTable
    {
        return DiningTable::query()
            ->where('qr_token', $qrToken)
            ->where('status', 'active')
            ->where('self_order_enabled', true)
            ->firstOrFail();
    }

    private function refreshPaymentLink(TableOrder $order, PaymentGatewayManager $paymentGatewayManager): void
    {
        $transaction = $order->transaction;
        $paymentMethod = strtolower((string) ($transaction?->payment_method ?? $order->payment_method ?? ''));

        if (! $transaction || ! in_array($paymentMethod, [PaymentSetting::GATEWAY_XENDIT, PaymentSetting::GATEWAY_MIDTRANS, PaymentSetting::GATEWAY_PAKASIR], true)) {
            throw ValidationException::withMessages([
                'payment_method' => 'Metode pembayaran order ini tidak mendukung link otomatis.',
            ]);
        }

        $paymentSetting = PaymentSetting::resolveForOutlet((int) $order->outlet_id);

        if (! $paymentSetting || ! $paymentSetting->isGatewayReady($paymentMethod, (int) $order->outlet_id)) {
            throw ValidationException::withMessages([
                'payment_method' => 'Konfigurasi gateway pembayaran belum lengkap atau belum aktif untuk outlet ini.',
            ]);
        }

        $paymentResponse = $paymentGatewayManager->createPayment($transaction, $paymentMethod, $paymentSetting);
        $normalizedPaymentPayload = $this->normalizePaymentPayload(
            $paymentMethod,
            $transaction,
            $paymentResponse
        );

        $transaction->update([
            'payment_reference' => $paymentResponse['reference'] ?? null,
            'payment_url' => $paymentResponse['payment_url'] ?? null,
            'payment_payload' => $normalizedPaymentPayload,
            'payment_expires_at' => $paymentResponse['expired_at'] ?? null,
        ]);
    }

    private function syncPendingOnlineOrderStatus(TableOrder $order, PaymentGatewayManager $paymentGatewayManager): TableOrder
    {
        $transaction = $order->transaction;
        $paymentMethod = strtolower((string) ($transaction?->payment_method ?? $order->payment_method ?? ''));
        $paymentStatus = strtolower((string) ($transaction?->payment_status ?? ''));
        $supportedOnlineGateways = [
            PaymentSetting::GATEWAY_XENDIT,
            PaymentSetting::GATEWAY_PAKASIR,
        ];

        if (
            ! $transaction
            || $order->status !== 'pending_cashier_payment'
            || ! in_array($paymentMethod, $supportedOnlineGateways, true)
            || $paymentStatus === 'paid'
            || ($paymentMethod !== PaymentSetting::GATEWAY_PAKASIR && blank($transaction->payment_reference))
        ) {
            return $order;
        }

        $paymentSetting = PaymentSetting::resolveForOutlet((int) $order->outlet_id);
        if (! $paymentSetting || ! $paymentSetting->isGatewayReady($paymentMethod, (int) $order->outlet_id)) {
            return $order;
        }

        try {
            $invoice = $paymentGatewayManager->fetchPaymentStatus($transaction, $paymentMethod, $paymentSetting);
        } catch (PaymentGatewayException) {
            return $order;
        }

        $mappedStatus = match ($paymentMethod) {
            PaymentSetting::GATEWAY_PAKASIR => match (strtolower((string) ($invoice['status'] ?? 'pending'))) {
                'completed', 'paid', 'settled' => 'paid',
                'expired', 'failed', 'cancelled', 'canceled' => 'failed',
                default => 'pending',
            },
            default => match (strtoupper((string) ($invoice['status'] ?? 'PENDING'))) {
                'PAID', 'SETTLED' => 'paid',
                'EXPIRED', 'FAILED' => 'failed',
                default => 'pending',
            },
        };

        if ($mappedStatus !== (string) ($transaction->payment_status ?? '')) {
            $transaction->update([
                'payment_status' => $mappedStatus,
                'payment_reference' => $invoice['id'] ?? $invoice['order_id'] ?? $transaction->payment_reference,
                'payment_url' => $invoice['invoice_url'] ?? $transaction->payment_url,
                'payment_expires_at' => $invoice['expired_at'] ?? $transaction->payment_expires_at,
            ]);

            if ($mappedStatus === 'paid') {
                $this->tableOrderService->finalizePublicPayment($transaction->fresh());
            }

            $order->refresh();
        }

        return $order->load([
            'diningTable:id,name,code,qr_token',
            'items.product:id,title,stock',
            'items.modifiers',
            'transaction:id,invoice,payment_status,payment_method,payment_reference,payment_url,payment_payload,payment_expires_at,bank_account_id,created_at',
            'transaction.bankAccount:id,bank_name,account_number,account_name,logo',
            'transaction.kitchenTickets:id,transaction_id,kitchen_station_id,ticket_number,status,notes,fired_at,acknowledged_at,ready_at,completed_at,created_at',
            'transaction.kitchenTickets.kitchenStation:id,name,code',
            'transaction.kitchenTickets.items:id,kitchen_ticket_id,product_title,qty,status,notes,completed_at',
            'customer:id,name,no_telp,email,address,is_loyalty_member,member_code,loyalty_tier,loyalty_points',
        ]);
    }

    private function ensurePakasirPaymentPayload(TableOrder $order, PaymentGatewayManager $paymentGatewayManager): void
    {
        $transaction = $order->transaction;
        $paymentMethod = strtolower((string) ($transaction?->payment_method ?? $order->payment_method ?? ''));
        $paymentStatus = strtolower((string) ($transaction?->payment_status ?? ''));

        if (
            ! $transaction
            || $paymentMethod !== PaymentSetting::GATEWAY_PAKASIR
            || $order->status !== 'pending_cashier_payment'
            || $paymentStatus === 'paid'
            || filled(data_get($transaction->payment_payload, 'payment_number'))
        ) {
            return;
        }

        try {
            $this->refreshPaymentLink($order, $paymentGatewayManager);
            $order->unsetRelation('transaction');
            $order->load('transaction');
        } catch (\Throwable) {
            // Keep existing fallback to hosted checkout if Pakasir API payload cannot be regenerated.
        }
    }

    private function resolvedPublicCustomer(Request $request, int $outletId): ?Customer
    {
        $customerId = $request->session()->get($this->customerSessionKey($outletId));
        if (! $customerId) {
            return null;
        }

        return Customer::query()->find($customerId);
    }

    private function resolveEditableOrder(Request $request, DiningTable $table, ?Customer $customer): ?TableOrder
    {
        $accessToken = (string) $request->query('edit_order', '');
        if ($accessToken === '' || ! $customer) {
            return null;
        }

        return TableOrder::query()
            ->with(['items.modifiers'])
            ->where('access_token', $accessToken)
            ->where('dining_table_id', $table->id)
            ->where('outlet_id', $table->outlet_id)
            ->where('customer_id', $customer->id)
            ->where('status', 'pending_cashier_payment')
            ->whereNull('transaction_id')
            ->first();
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

    private function customerPayload(
        Customer $customer,
        int $outletId,
        int $ordersPage = 1,
        int $transactionsPage = 1
    ): array
    {
        $perPage = 5;
        $ordersPage = max(1, $ordersPage);
        $transactionsPage = max(1, $transactionsPage);
        $metrics = $this->customerOutletMetricService->metricsForCustomer($customer, $outletId);
        $recentTableOrdersQuery = TableOrder::query()
            ->with('items:id,table_order_id,line_total')
            ->select('id', 'order_number', 'grand_total', 'status', 'created_at', 'access_token')
            ->where('customer_id', $customer->id)
            ->where('outlet_id', $outletId)
            ->latest('created_at');
        $recentTableOrdersTotal = (clone $recentTableOrdersQuery)->count();
        $recentTableOrders = $recentTableOrdersQuery
            ->forPage($ordersPage, $perPage)
            ->get();

        $recentTransactionsQuery = $customer->transactions()
            ->select('id', 'invoice', 'grand_total', 'payment_status', 'created_at', 'outlet_id')
            ->with('outlet:id,name')
            ->where('outlet_id', $outletId)
            ->latest('created_at');
        $recentTransactionsTotal = (clone $recentTransactionsQuery)->count();
        $recentTransactions = $recentTransactionsQuery
            ->forPage($transactionsPage, $perPage)
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
            'last_purchase_at' => ReportTimezone::formatSourceIso8601($metrics['last_purchase_at'] ?? null),
            'recent_orders' => $recentTableOrders->map(fn ($order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'grand_total' => $order->resolvedGrandTotal(),
                'status' => $order->status,
                'created_at' => ReportTimezone::formatSourceIso8601($order->getRawOriginal('created_at')),
                'access_token' => $order->access_token,
            ])->values(),
            'recent_orders_pagination' => [
                'current_page' => $ordersPage,
                'per_page' => $perPage,
                'total' => $recentTableOrdersTotal,
                'last_page' => max(1, (int) ceil($recentTableOrdersTotal / $perPage)),
                'has_prev' => $ordersPage > 1,
                'has_next' => ($ordersPage * $perPage) < $recentTableOrdersTotal,
            ],
            'recent_transactions' => $recentTransactions->map(fn ($transaction) => [
                'id' => $transaction->id,
                'invoice' => $transaction->invoice,
                'grand_total' => (int) $transaction->grand_total,
                'payment_status' => $transaction->payment_status,
                'created_at' => ReportTimezone::formatSourceIso8601($transaction->getRawOriginal('created_at')),
                'outlet_name' => $transaction->outlet?->name,
            ])->values(),
            'recent_transactions_pagination' => [
                'current_page' => $transactionsPage,
                'per_page' => $perPage,
                'total' => $recentTransactionsTotal,
                'last_page' => max(1, (int) ceil($recentTransactionsTotal / $perPage)),
                'has_prev' => $transactionsPage > 1,
                'has_next' => ($transactionsPage * $perPage) < $recentTransactionsTotal,
            ],
        ];
    }

    private function recommendationPayload(Collection $products, int $outletId, ?Customer $customer): array
    {
        $productMap = $products->keyBy('id');
        $promoProducts = $products
            ->filter(fn (array $product) => $this->productHasPromo($product))
            ->take(8)
            ->values();

        $bestSellerIds = TransactionDetail::query()
            ->select('product_id')
            ->where('outlet_id', $outletId)
            ->whereNotNull('product_id')
            ->groupBy('product_id')
            ->orderByRaw('SUM(qty) DESC')
            ->orderByRaw('MAX(id) DESC')
            ->limit(8)
            ->pluck('product_id');

        $bestSellers = $bestSellerIds
            ->map(fn ($productId) => $productMap->get((int) $productId))
            ->filter()
            ->values();

        $historyProductIds = collect();

        if ($customer) {
            $transactionProductIds = Transaction::query()
                ->where('customer_id', $customer->id)
                ->where('outlet_id', $outletId)
                ->latest('id')
                ->limit(20)
                ->pluck('id');

            $transactionHistoryIds = TransactionDetail::query()
                ->whereIn('transaction_id', $transactionProductIds)
                ->whereNotNull('product_id')
                ->orderByDesc('id')
                ->pluck('product_id');

            $tableOrderIds = TableOrder::query()
                ->where('customer_id', $customer->id)
                ->where('outlet_id', $outletId)
                ->latest('id')
                ->limit(20)
                ->pluck('id');

            $tableOrderHistoryIds = TableOrderItem::query()
                ->whereIn('table_order_id', $tableOrderIds)
                ->whereNotNull('product_id')
                ->orderByDesc('id')
                ->pluck('product_id');

            $historyProductIds = $transactionHistoryIds
                ->concat($tableOrderHistoryIds)
                ->unique()
                ->take(8)
                ->values();
        }

        $historyProducts = $historyProductIds
            ->map(fn ($productId) => $productMap->get((int) $productId))
            ->filter()
            ->values();

        return [
            'promo' => $promoProducts->values()->all(),
            'best_sellers' => $bestSellers->values()->all(),
            'history' => $historyProducts->values()->all(),
        ];
    }

    private function productHasPromo(array $product): bool
    {
        $badge = $product['pricing_badge'] ?? null;
        if (! empty($badge['pricing_rule'])) {
            return true;
        }

        $promoPrice = (int) ($badge['promo_price'] ?? 0);
        $basePrice = (int) ($badge['base_price'] ?? ($product['sell_price'] ?? 0));

        return $promoPrice > 0 && $promoPrice < $basePrice;
    }

    private function validatePublicOrderPayload(Request $request, int $outletId): array
    {
        $paymentSetting = PaymentSetting::resolveForOutlet($outletId);
        $enabledGatewayValues = collect($paymentSetting?->enabledGateways($outletId) ?? [])
            ->pluck('value')
            ->filter()
            ->reject(fn ($value) => $value === PaymentSetting::GATEWAY_QRIS)
            ->map(fn ($value) => (string) $value)
            ->values()
            ->all();
        $allowedPaymentMethods = array_values(array_unique([
            'cash',
            ...$enabledGatewayValues,
        ]));

        return $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
            'payment_method' => ['nullable', Rule::in($allowedPaymentMethods)],
            'bank_account_id' => [
                'nullable',
                'integer',
                Rule::exists('bank_accounts', 'id')->where(fn ($query) => $query
                    ->where('outlet_id', $outletId)
                    ->where('is_active', true)),
            ],
            'items' => ['required', 'array', 'min:1'],
            'items.*.client_key' => ['nullable', 'string', 'max:120'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:50'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
            'items.*.is_promo_reward' => ['nullable', 'boolean'],
            'items.*.promo_reward_rule_name' => ['nullable', 'string', 'max:255'],
            'items.*.promo_reward_label' => ['nullable', 'string', 'max:255'],
            'items.*.modifiers' => ['nullable', 'array'],
            'items.*.modifiers.*.id' => ['required', 'integer', 'exists:product_modifier_options,id'],
        ]);
    }

    private function normalizePaymentPayload(string $paymentMethod, Transaction $transaction, array $paymentResponse): ?array
    {
        if ($paymentMethod !== PaymentSetting::GATEWAY_PAKASIR) {
            return $paymentResponse['raw']['payment'] ?? $paymentResponse['raw'] ?? null;
        }

        $rawPayment = $paymentResponse['raw']['payment'] ?? [];
        $paymentUrl = (string) ($paymentResponse['payment_url'] ?? '');
        $resolvedMethod = $rawPayment['payment_method']
            ?? (str_contains($paymentUrl, 'qris_only=1') ? 'qris' : 'pakasir');
        $paymentNumber = $rawPayment['payment_number'] ?? ($paymentResponse['payment_number'] ?? null);
        $expiredAt = $rawPayment['expired_at'] ?? ($paymentResponse['expired_at'] ?? null);

        if (blank($paymentNumber) && blank($expiredAt) && blank($rawPayment)) {
            return null;
        }

        return [
            'project' => $rawPayment['project'] ?? null,
            'order_id' => $rawPayment['order_id'] ?? $transaction->invoice,
            'amount' => (int) ($rawPayment['amount'] ?? $transaction->grand_total),
            'fee' => (int) ($rawPayment['fee'] ?? 0),
            'total_payment' => (int) ($rawPayment['total_payment'] ?? $transaction->grand_total),
            'payment_method' => $resolvedMethod,
            'payment_number' => $paymentNumber,
            'expired_at' => $expiredAt,
        ];
    }
}
