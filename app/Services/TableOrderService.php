<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\DiningTable;
use App\Models\PaymentSetting;
use App\Models\Product;
use App\Models\ProductModifierOption;
use App\Models\ProductOutletStock;
use App\Models\TableOrder;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use App\Services\TransactionInvoiceService;

class TableOrderService
{
    private ?bool $supportsTableOrderItemPromoRewardMetadata = null;

    public function __construct(
        private readonly CashierShiftService $cashierShiftService,
        private readonly StockMutationService $stockMutationService,
        private readonly KitchenTicketService $kitchenTicketService,
        private readonly FoodcourtTenantAllocationService $foodcourtTenantAllocationService,
        private readonly AuditLogService $auditLogService,
        private readonly LoyaltyService $loyaltyService,
        private readonly PricingService $pricingService,
        private readonly ModifierMarkupService $modifierMarkupService,
        private readonly PrintJobService $printJobService,
        private readonly TransactionInvoiceService $transactionInvoiceService
    ) {}

    public function createFromPublicMenu(DiningTable $table, Customer $customer, array $payload): TableOrder
    {
        $preview = $this->previewPublicMenu($table, $customer, $payload);
        $orderItems = collect($preview['items'] ?? []);
        $subtotal = (int) ($preview['subtotal'] ?? 0);
        $paymentMethod = $this->normalizePublicPaymentMethod($payload['payment_method'] ?? null);
        $bankAccountId = $paymentMethod === PaymentSetting::GATEWAY_BANK_TRANSFER
            ? (int) ($payload['bank_account_id'] ?? 0)
            : null;

        $tableOrder = DB::transaction(function () use ($table, $customer, $payload, $orderItems, $subtotal, $paymentMethod, $bankAccountId) {
            $order = TableOrder::create([
                'outlet_id' => $table->outlet_id,
                'dining_table_id' => $table->id,
                'customer_id' => $customer->id,
                'order_number' => $this->generateOrderNumber(),
                'access_token' => (string) Str::uuid(),
                'source_channel' => 'table_qr',
                'customer_name' => (string) ($customer->name ?? ''),
                'customer_phone' => (string) ($customer->no_telp ?? ''),
                'customer_email' => filled($customer->email ?? null) ? (string) $customer->email : null,
                'notes' => filled($payload['notes'] ?? null) ? (string) $payload['notes'] : null,
                'payment_method' => $paymentMethod,
                'status' => 'pending_cashier_payment',
                'subtotal' => $subtotal,
                'grand_total' => $subtotal,
            ]);

            foreach ($orderItems as $item) {
                $modifiers = $item['modifiers'] ?? [];
                unset($item['cart_id']);
                unset($item['client_key']);
                unset($item['modifiers']);

                $orderItem = $order->items()->create(
                    $this->sanitizeTableOrderItemAttributes($item)
                );

                foreach ($modifiers as $modifier) {
                    $orderItem->modifiers()->create($modifier);
                }
            }

            $this->reserveStockForOrderItems(
                $order,
                $orderItems,
                "Stok dikunci otomatis saat self-order {$order->order_number} dikirim ke kasir."
            );

            if ($paymentMethod !== 'cash') {
                $transaction = $this->createPendingSelfServiceTransaction(
                    $order->fresh(['items.product', 'items.modifiers', 'customer']),
                    $paymentMethod,
                    $bankAccountId
                );

                $order->forceFill([
                    'transaction_id' => $transaction->id,
                ])->save();
            }

            return $order->fresh(['items.modifiers', 'diningTable', 'outlet', 'transaction.bankAccount']);
        });

        $this->auditLogService->log(
            event: 'table_order.created',
            module: 'table_orders',
            auditable: $tableOrder,
            description: "Self-order meja {$table->name} dibuat.",
            after: [
                'order_number' => $tableOrder->order_number,
                'table' => $table->name,
                'payment_method' => $tableOrder->payment_method,
                'status' => $tableOrder->status,
                'grand_total' => $tableOrder->grand_total,
                'items_count' => $tableOrder->items->count(),
            ]
        );

        return $tableOrder;
    }

    public function previewPublicMenu(DiningTable $table, Customer $customer, array $payload): array
    {
        if ($table->status !== 'active' || ! $table->self_order_enabled) {
            throw ValidationException::withMessages([
                'table' => 'Meja ini tidak menerima self-order saat ini.',
            ]);
        }

        $items = collect($payload['items'] ?? [])
            ->map(function (array $item) {
                return [
                    'client_key' => filled($item['client_key'] ?? null) ? (string) $item['client_key'] : null,
                    'product_id' => (int) ($item['product_id'] ?? 0),
                    'qty' => max(0, (int) ($item['qty'] ?? 0)),
                    'notes' => filled($item['notes'] ?? null) ? (string) $item['notes'] : null,
                    'is_promo_reward' => (bool) ($item['is_promo_reward'] ?? false),
                    'promo_reward_rule_name' => filled($item['promo_reward_rule_name'] ?? null)
                        ? (string) $item['promo_reward_rule_name']
                        : null,
                    'promo_reward_label' => filled($item['promo_reward_label'] ?? null)
                        ? (string) $item['promo_reward_label']
                        : null,
                    'modifier_ids' => collect($item['modifiers'] ?? [])
                        ->map(fn (array $modifier) => (int) ($modifier['id'] ?? 0))
                        ->filter(fn (int $id) => $id > 0)
                        ->unique()
                        ->values(),
                ];
            })
            ->filter(fn (array $item) => $item['product_id'] > 0 && $item['qty'] > 0)
            ->values();

        if ($items->isEmpty()) {
            throw ValidationException::withMessages([
                'items' => 'Pilih minimal satu menu.',
            ]);
        }

        $productIds = $items->pluck('product_id')->all();
        $products = Product::query()
            ->with(['tenantOutlet:id,name,code'])
            ->whereIn('id', $productIds)
            ->orderBy('title')
            ->get()
            ->keyBy('id');

        $modifierOptions = ProductModifierOption::query()
            ->whereIn('product_id', $productIds)
            ->where('is_active', true)
            ->get()
            ->groupBy('product_id');
        $requestedQtyByProduct = $items
            ->groupBy('product_id')
            ->map(fn (Collection $group) => (int) $group->sum('qty'));

        $orderItems = $items->map(function (array $item, int $index) use ($products, $modifierOptions, $table, $requestedQtyByProduct) {
            /** @var Product|null $product */
            $product = $products->get($item['product_id']);
            if (! $product) {
                throw ValidationException::withMessages([
                    'items' => 'Ada produk yang tidak ditemukan.',
                ]);
            }

            $availableStock = $this->resolveAvailableStock($product, $table->outlet_id);
            $requestedQty = (int) ($requestedQtyByProduct->get($product->id) ?? $item['qty']);

            if ($availableStock < $requestedQty) {
                throw ValidationException::withMessages([
                    'items' => "Stok produk {$product->title} tidak mencukupi.",
                ]);
            }

            $unitPrice = (int) ($product->sell_price ?? 0);
            $productModifierOptions = $modifierOptions->get($product->id, collect());
            $selectedModifiers = $productModifierOptions
                ->whereIn('id', $item['modifier_ids']->all())
                ->values();

            if ($item['modifier_ids']->isNotEmpty() && $selectedModifiers->count() !== $item['modifier_ids']->count()) {
                throw ValidationException::withMessages([
                    'items' => "Topping untuk produk {$product->title} tidak valid.",
                ]);
            }

            $this->ensureGroupedModifiersSatisfied(
                $product,
                $productModifierOptions,
                $selectedModifiers,
                'items'
            );

            $modifierPricing = $selectedModifiers
                ->mapWithKeys(fn (ProductModifierOption $option) => [
                    $option->id => $this->modifierMarkupService->resolveForBasePrice((int) ($option->price ?? 0), (int) $table->outlet_id),
                ]);
            $modifierUnitTotal = (int) $modifierPricing->sum(fn (array $pricing) => (int) ($pricing['effective_price'] ?? 0));

            return [
                'cart_id' => -($index + 1),
                'client_key' => $item['client_key'],
                'product_id' => $product->id,
                'tenant_outlet_id' => $product->tenant_outlet_id ?: $table->outlet_id,
                'product_title' => $product->title,
                'qty' => $item['qty'],
                'base_unit_price' => $unitPrice,
                'unit_price' => $unitPrice,
                'line_total' => ($unitPrice + $modifierUnitTotal) * $item['qty'],
                'discount_total' => 0,
                'pricing_rule_id' => null,
                'pricing_rule_name' => null,
                'pricing_rule_kind' => null,
                'pricing_group_key' => null,
                'pricing_group_label' => null,
                'is_promo_reward' => (bool) ($item['is_promo_reward'] ?? false),
                'promo_reward_rule_name' => $item['promo_reward_rule_name'],
                'promo_reward_label' => $item['promo_reward_label'],
                'notes' => $item['notes'],
                'modifiers' => $selectedModifiers->map(fn (ProductModifierOption $option) => [
                    'product_modifier_option_id' => $option->id,
                    'name' => $option->name,
                    'qty' => $item['qty'],
                    'unit_price' => (int) ($modifierPricing->get($option->id)['effective_price'] ?? 0),
                    'base_price' => (int) ($modifierPricing->get($option->id)['base_price'] ?? 0),
                    'markup_price' => (int) ($modifierPricing->get($option->id)['markup_price'] ?? 0),
                    'total_price' => (int) ($modifierPricing->get($option->id)['effective_price'] ?? 0) * $item['qty'],
                ])->values()->all(),
            ];
        });

        $pricingPreview = $this->pricingService->previewCart(
            $orderItems->map(function (array $item) use ($products) {
                $cart = new \App\Models\Cart([
                    'product_id' => (int) $item['product_id'],
                    'qty' => (int) $item['qty'],
                    'price' => (int) $item['line_total'],
                    'is_promo_reward' => (bool) ($item['is_promo_reward'] ?? false),
                    'promo_reward_rule_name' => $item['promo_reward_rule_name'] ?? null,
                    'promo_reward_label' => $item['promo_reward_label'] ?? null,
                ]);
                $cart->setAttribute('id', (int) $item['cart_id']);

                $cart->setRelation('product', $products->get($item['product_id']));
                $cart->setRelation('modifiers', collect($item['modifiers'] ?? [])->map(
                    fn (array $modifier) => (object) [
                        'total_price' => (int) ($modifier['total_price'] ?? 0),
                        'markup_price' => (int) ($modifier['markup_price'] ?? 0),
                    ]
                ));

                return $cart;
            }),
            $customer,
            outletId: $table->outlet_id
        );

        $pricingItems = collect($pricingPreview['items'] ?? [])->keyBy('cart_id');

        $orderItems = $orderItems->map(function (array $item) use ($pricingItems) {
            $pricingItem = $pricingItems->get((int) $item['cart_id']);

            if (! $pricingItem) {
                return $item;
            }

            return [
                ...$item,
                'base_unit_price' => (int) ($pricingItem['base_unit_price'] ?? $item['base_unit_price']),
                'customer_base_unit_price' => (int) ($pricingItem['customer_base_unit_price'] ?? $item['base_unit_price']),
                'tenant_base_unit_price' => (int) ($pricingItem['tenant_base_unit_price'] ?? 0),
                'owner_markup_unit_price' => (int) ($pricingItem['owner_markup_unit_price'] ?? 0),
                'unit_price' => (int) ($pricingItem['effective_unit_price'] ?? $item['unit_price']),
                'line_total' => (int) ($pricingItem['line_total'] ?? $item['line_total']),
                'discount_total' => (int) ($pricingItem['line_discount_total'] ?? $item['discount_total']),
                'tenant_discount_total' => (int) ($pricingItem['tenant_discount_total'] ?? 0),
                'owner_discount_total' => (int) ($pricingItem['owner_discount_total'] ?? 0),
                'tenant_net_total' => (int) ($pricingItem['tenant_net_total'] ?? 0),
                'owner_net_total' => (int) ($pricingItem['owner_net_total'] ?? 0),
                'pricing_rule_id' => data_get($pricingItem, 'pricing_rule.id'),
                'pricing_rule_name' => data_get($pricingItem, 'pricing_rule.name'),
                'pricing_rule_kind' => data_get($pricingItem, 'pricing_rule.kind'),
                'pricing_rule_price_basis' => data_get($pricingItem, 'pricing_rule.price_basis'),
                'pricing_group_key' => $pricingItem['pricing_group_key'] ?? null,
                'pricing_group_label' => $pricingItem['pricing_group_label'] ?? null,
                'is_promo_reward' => (bool) ($item['is_promo_reward'] ?? false),
                'promo_reward_rule_name' => $item['promo_reward_rule_name'] ?? null,
                'promo_reward_label' => $item['promo_reward_label'] ?? null,
            ];
        })->values();

        $subtotal = (int) data_get($pricingPreview, 'summary.grand_total', $orderItems->sum('line_total'));

        $previewItems = collect($pricingPreview['items'] ?? [])
            ->map(function (array $pricingItem) use ($orderItems) {
                $sourceItem = $orderItems->firstWhere('cart_id', (int) ($pricingItem['cart_id'] ?? 0));

                return [
                    ...$pricingItem,
                    'cart_id' => $sourceItem['client_key'] ?? (string) ($pricingItem['cart_id'] ?? ''),
                    'client_key' => $sourceItem['client_key'] ?? null,
                ];
            })
            ->values()
            ->all();

        return [
            'items' => $orderItems->values()->all(),
            'subtotal' => $subtotal,
            'grand_total' => $subtotal,
            'pricing_preview' => [
                ...$pricingPreview,
                'items' => $previewItems,
            ],
        ];
    }

    public function approvePayment(
        TableOrder $tableOrder,
        User $cashier,
        int $cashAmount,
        string $paymentMethod = 'cash'
    ): Transaction
    {
        if ($tableOrder->status !== 'pending_cashier_payment') {
            throw ValidationException::withMessages([
                'order' => 'Order ini tidak lagi menunggu pembayaran kasir.',
            ]);
        }

        if (! in_array($paymentMethod, ['cash', 'qris'], true)) {
            throw ValidationException::withMessages([
                'payment_method' => 'Metode pembayaran QR meja tidak valid.',
            ]);
        }

        $resolvedGrandTotal = $tableOrder->resolvedGrandTotal();

        if ($cashAmount < $resolvedGrandTotal) {
            throw ValidationException::withMessages([
                'cash' => $paymentMethod === 'cash'
                    ? 'Nominal tunai kurang dari total order.'
                    : 'Nominal pembayaran kurang dari total order.',
            ]);
        }

        $tableOrder->loadMissing(['items.product', 'items.modifiers', 'diningTable']);
        $activeShift = $this->cashierShiftService->requireActiveShiftForUser(
            $cashier->id,
            $tableOrder->outlet_id,
            lockForUpdate: true
        );

        $transaction = DB::transaction(function () use ($tableOrder, $cashier, $activeShift, $cashAmount, $paymentMethod) {
            $resolvedGrandTotal = $tableOrder->resolvedGrandTotal();
            $invoice = $this->generateInvoiceNumber();
            $changeAmount = $paymentMethod === 'cash'
                ? max(0, $cashAmount - $resolvedGrandTotal)
                : 0;

            $transaction = Transaction::create([
                'cashier_id' => $cashier->id,
                'cashier_shift_id' => $activeShift->id,
                'outlet_id' => $tableOrder->outlet_id,
                'customer_id' => $tableOrder->customer_id,
                'order_type' => 'dine_in',
                'table_id' => $tableOrder->dining_table_id,
                'invoice' => $invoice,
                'cash' => $cashAmount,
                'change' => $changeAmount,
                'discount' => 0,
                'shipping_cost' => 0,
                'grand_total' => $resolvedGrandTotal,
                'payment_method' => $paymentMethod,
                'payment_status' => 'paid',
            ]);

            foreach ($tableOrder->items as $item) {
                $product = $item->product;
                if (! $product) {
                    throw ValidationException::withMessages([
                        'order' => "Produk {$item->product_title} tidak lagi tersedia.",
                    ]);
                }

                $detail = $transaction->details()->create([
                    'transaction_id' => $transaction->id,
                    'outlet_id' => $tableOrder->outlet_id,
                    'tenant_outlet_id' => $item->tenant_outlet_id ?: $tableOrder->outlet_id,
                    'product_id' => $product->id,
                    'qty' => (int) $item->qty,
                    'base_unit_price' => (int) ($item->base_unit_price ?? $item->unit_price),
                    'customer_base_unit_price' => (int) ($item->customer_base_unit_price ?? $item->base_unit_price ?? $item->unit_price),
                    'tenant_base_unit_price' => (int) ($item->tenant_base_unit_price ?? $product->buy_price),
                    'owner_markup_unit_price' => (int) ($item->owner_markup_unit_price ?? max(0, (int) $product->sell_price - (int) $product->buy_price)),
                    'unit_price' => (int) $item->unit_price,
                    'price' => (int) $item->line_total,
                    'notes' => $item->notes,
                    'discount_total' => (int) ($item->discount_total ?? 0),
                    'tenant_discount_total' => (int) ($item->tenant_discount_total ?? 0),
                    'owner_discount_total' => (int) ($item->owner_discount_total ?? 0),
                    'tenant_net_total' => (int) ($item->tenant_net_total ?? ((int) $product->buy_price * (int) $item->qty)),
                    'owner_net_total' => (int) ($item->owner_net_total ?? max(0, ((int) $product->sell_price - (int) $product->buy_price) * (int) $item->qty)),
                    'pricing_rule_id' => $item->pricing_rule_id,
                    'pricing_rule_name' => $item->pricing_rule_name,
                    'pricing_rule_kind' => $item->pricing_rule_kind,
                    'pricing_rule_price_basis' => $item->pricing_rule_price_basis,
                    'pricing_group_key' => $item->pricing_group_key,
                    'pricing_group_label' => $item->pricing_group_label,
                    'is_promo_reward' => (bool) ($item->is_promo_reward ?? false),
                    'promo_reward_rule_name' => $item->promo_reward_rule_name,
                    'promo_reward_label' => $item->promo_reward_label,
                ]);

                foreach ($item->modifiers as $modifier) {
                    $detail->modifiers()->create([
                        'name' => $modifier->name,
                        'qty' => (int) $modifier->qty,
                        'unit_price' => (int) $modifier->unit_price,
                        'base_price' => (int) ($modifier->base_price ?? $modifier->unit_price),
                        'markup_price' => (int) ($modifier->markup_price ?? 0),
                        'total_price' => (int) $modifier->total_price,
                    ]);
                }

                $transaction->profits()->create([
                    'transaction_id' => $transaction->id,
                    'total' => ((int) $item->line_total) - ((int) $product->buy_price * (int) $item->qty),
                ]);

            }

            $tableOrder->update([
                'subtotal' => $resolvedGrandTotal,
                'grand_total' => $resolvedGrandTotal,
                'status' => 'paid',
                'approved_by' => $cashier->id,
                'approved_at' => now(),
                'transaction_id' => $transaction->id,
            ]);

            return $transaction;
        });

        // --- Heavy side-effects moved OUTSIDE DB::transaction to release row locks ASAP ---
        $transaction = $transaction->fresh(['customer', 'details.product.kitchenStationMappings', 'details.modifiers', 'diningTable', 'details.product']);

        $customer = $tableOrder->customer?->fresh();
        if ($customer) {
            $this->loyaltyService->finalizeTransaction($transaction, $customer, []);
        }

        $this->foodcourtTenantAllocationService->rebuildForTransaction($transaction->fresh(['details']));
        $this->kitchenTicketService->createForTransaction($transaction, 'table_qr');

        $this->auditLogService->log(
            event: 'table_order.cash_payment_approved',
            module: 'table_orders',
            auditable: $tableOrder->fresh(),
            description: "Pembayaran {$paymentMethod} order {$tableOrder->order_number} dikonfirmasi kasir.",
            before: [
                'status' => 'pending_cashier_payment',
                'transaction_id' => null,
            ],
            after: [
                'status' => 'paid',
                'transaction_id' => $transaction->id,
                'invoice' => $transaction->invoice,
                'payment_method' => $paymentMethod,
            ],
        );

        $this->printJobService->queueReceipt($transaction, userId: $cashier->id);

        return $transaction;
    }

    public function updateItems(TableOrder $tableOrder, array $items, User $actor): TableOrder
    {
        if ($tableOrder->status !== 'pending_cashier_payment') {
            throw ValidationException::withMessages([
                'order' => 'Order ini tidak bisa diedit karena sudah diproses.',
            ]);
        }

        $tableOrder->loadMissing(['items.product']);

        $validatedItems = collect($items ?? [])
            ->map(function (array $item) {
                return [
                    'product_id' => (int) ($item['product_id'] ?? 0),
                    'qty' => max(0, (int) ($item['qty'] ?? 0)),
                    'notes' => filled($item['notes'] ?? null) ? (string) $item['notes'] : null,
                    'modifier_ids' => collect($item['modifier_ids'] ?? [])
                        ->map(fn (array $modifier) => (int) ($modifier['id'] ?? 0))
                        ->filter(fn (int $id) => $id > 0)
                        ->unique()
                        ->values(),
                ];
            })
            ->filter(fn (array $item) => $item['product_id'] > 0 && $item['qty'] > 0)
            ->values();

        if ($validatedItems->isEmpty()) {
            return $this->cancel(
                $tableOrder,
                $actor,
                'Semua item dihapus melalui edit pesanan.'
            );
        }

        $productIds = $validatedItems->pluck('product_id')->all();
        $products = Product::query()
            ->with(['tenantOutlet:id,name,code'])
            ->whereIn('id', $productIds)
            ->orderBy('title')
            ->get()
            ->keyBy('id');

        $modifierOptions = ProductModifierOption::query()
            ->whereIn('product_id', $productIds)
            ->where('is_active', true)
            ->get()
            ->groupBy('product_id');

        $requestedQtyByProduct = $validatedItems
            ->groupBy('product_id')
            ->map(fn (Collection $group) => (int) $group->sum('qty'));
        $currentReservedQtyByProduct = $tableOrder->items
            ->groupBy('product_id')
            ->map(fn (Collection $group) => (int) $group->sum('qty'));

        $orderItems = $validatedItems->map(function (array $item) use ($products, $modifierOptions, $tableOrder, $requestedQtyByProduct, $currentReservedQtyByProduct) {
            $product = $products->get($item['product_id']);
            if (! $product) {
                throw ValidationException::withMessages([
                    'items' => 'Ada produk yang tidak ditemukan.',
                ]);
            }

            $availableStock = $this->resolveAvailableStock($product, $tableOrder->outlet_id)
                + (int) ($currentReservedQtyByProduct->get($product->id) ?? 0);
            $requestedQty = (int) ($requestedQtyByProduct->get($product->id) ?? $item['qty']);

            if ($availableStock < $requestedQty) {
                throw ValidationException::withMessages([
                    'items' => "Stok produk {$product->title} tidak mencukupi.",
                ]);
            }

            $unitPrice = (int) ($product->sell_price ?? 0);
            $productModifierOptions = $modifierOptions->get($product->id, collect());
            $selectedModifiers = $productModifierOptions
                ->whereIn('id', $item['modifier_ids']->all())
                ->values();

            if ($item['modifier_ids']->isNotEmpty() && $selectedModifiers->count() !== $item['modifier_ids']->count()) {
                throw ValidationException::withMessages([
                    'items' => "Topping untuk produk {$product->title} tidak valid.",
                ]);
            }

            $this->ensureGroupedModifiersSatisfied(
                $product,
                $productModifierOptions,
                $selectedModifiers,
                'items'
            );

            $modifierPricing = $selectedModifiers
                ->mapWithKeys(fn (ProductModifierOption $option) => [
                    $option->id => $this->modifierMarkupService->resolveForBasePrice((int) ($option->price ?? 0), (int) $tableOrder->outlet_id),
                ]);
            $modifierUnitTotal = (int) $modifierPricing->sum(fn (array $pricing) => (int) ($pricing['effective_price'] ?? 0));

            return [
                'product_id' => $product->id,
                'tenant_outlet_id' => $product->tenant_outlet_id ?: $tableOrder->outlet_id,
                'product_title' => $product->title,
                'qty' => $item['qty'],
                'base_unit_price' => $unitPrice,
                'unit_price' => $unitPrice + $modifierUnitTotal,
                'line_total' => ($unitPrice + $modifierUnitTotal) * $item['qty'],
                'discount_total' => 0,
                'notes' => $item['notes'],
                'modifiers' => $selectedModifiers->map(fn (ProductModifierOption $option) => [
                    'product_modifier_option_id' => $option->id,
                    'name' => $option->name,
                    'qty' => $item['qty'],
                    'unit_price' => (int) ($modifierPricing->get($option->id)['effective_price'] ?? 0),
                    'total_price' => (int) ($modifierPricing->get($option->id)['effective_price'] ?? 0) * $item['qty'],
                ])->values()->all(),
            ];
        });

        return DB::transaction(function () use ($tableOrder, $orderItems, $products, $currentReservedQtyByProduct, $requestedQtyByProduct) {
            $this->releaseReservedStockForOrder(
                $tableOrder,
                $tableOrder->items,
                "Stok reservasi order {$tableOrder->order_number} dikembalikan sementara untuk proses edit pesanan."
            );

            // Delete old items
            $tableOrder->items()->delete();

            // Create new items
            $grandTotal = 0;
            foreach ($orderItems as $item) {
                $modifiers = collect($item['modifiers']);
                unset($item['modifiers']);
                
                $tableOrderItem = $tableOrder->items()->create($item);
                $grandTotal += (int) $item['line_total'];

                foreach ($modifiers as $modifier) {
                    $tableOrderItem->modifiers()->create($modifier);
                }
            }

            $tableOrder->update([
                'grand_total' => $grandTotal,
                'subtotal' => $grandTotal,
            ]);

            $this->reserveStockForOrderItems(
                $tableOrder,
                $orderItems,
                "Stok reservasi order {$tableOrder->order_number} diperbarui setelah edit pesanan."
            );

            return $tableOrder->fresh(['items.modifiers', 'diningTable', 'customer']);
        });
    }

    public function cancel(TableOrder $tableOrder, User $actor, ?string $reason = null): TableOrder
    {
        if ($tableOrder->status !== 'pending_cashier_payment') {
            throw ValidationException::withMessages([
                'order' => 'Hanya order yang masih menunggu pembayaran yang bisa dibatalkan.',
            ]);
        }

        $tableOrder->loadMissing(['items.product']);

        $this->releaseReservedStockForOrder(
            $tableOrder,
            $tableOrder->items,
            $reason
                ? "Order {$tableOrder->order_number} dibatalkan. Stok dikembalikan otomatis sistem. Alasan: {$reason}"
                : "Order {$tableOrder->order_number} dibatalkan. Stok dikembalikan otomatis sistem.",
            $actor->id
        );

        $tableOrder->update([
            'status' => 'cancelled',
            'approved_by' => $actor->id,
            'approved_at' => now(),
        ]);

        $tableOrder = $tableOrder->fresh(['diningTable']);

        $this->auditLogService->log(
            event: 'table_order.cancelled',
            module: 'table_orders',
            auditable: $tableOrder,
            description: "Order {$tableOrder->order_number} dibatalkan oleh kasir.",
            before: [
                'status' => 'pending_cashier_payment',
            ],
            after: [
                'status' => 'cancelled',
                'reason' => $reason,
            ],
        );

        return $tableOrder;
    }

    private function resolveAvailableStock(Product $product, int $outletId): int
    {
        return (int) ($product->stock ?? 0);
    }

    private function reserveStockForOrderItems(
        TableOrder $tableOrder,
        Collection $orderItems,
        string $notes,
        ?int $userId = null
    ): void {
        $products = Product::query()
            ->whereIn('id', $orderItems->pluck('product_id')->filter()->unique()->all())
            ->get()
            ->keyBy('id');

        $qtyByProduct = $orderItems
            ->groupBy('product_id')
            ->map(fn (Collection $group) => (int) $group->sum('qty'));

        foreach ($qtyByProduct as $productId => $qty) {
            $product = $products->get((int) $productId);
            if (! $product || $qty <= 0) {
                continue;
            }

            $this->stockMutationService->decrementForOutlet(
                $product,
                (int) $tableOrder->outlet_id,
                $qty,
                'table_order',
                (int) $tableOrder->id,
                $notes,
                $userId
            );
        }
    }

    private function releaseReservedStockForOrder(
        TableOrder $tableOrder,
        Collection $items,
        string $notes,
        ?int $userId = null
    ): void {
        $products = Product::query()
            ->whereIn('id', $items->pluck('product_id')->filter()->unique()->all())
            ->get()
            ->keyBy('id');

        $qtyByProduct = $items
            ->groupBy('product_id')
            ->map(fn (Collection $group) => (int) $group->sum('qty'));

        foreach ($qtyByProduct as $productId => $qty) {
            $product = $products->get((int) $productId);
            if (! $product || $qty <= 0) {
                continue;
            }

            $this->stockMutationService->incrementForOutlet(
                $product,
                (int) $tableOrder->outlet_id,
                $qty,
                'table_order',
                (int) $tableOrder->id,
                $notes,
                $userId
            );
        }
    }

    public function finalizePublicPayment(Transaction $transaction): ?TableOrder
    {
        $tableOrder = TableOrder::query()
            ->with(['customer', 'items.modifiers'])
            ->where('transaction_id', $transaction->id)
            ->first();

        if (! $tableOrder) {
            return null;
        }

        if ($tableOrder->status === 'paid') {
            return $tableOrder;
        }

        $tableOrder->update([
            'status' => 'paid',
            'approved_by' => $transaction->cashier_id,
            'approved_at' => now(),
        ]);

        $transaction = $transaction->fresh(['customer', 'details.product.kitchenStationMappings', 'details.modifiers', 'diningTable', 'details.product']);
        $customer = $tableOrder->customer?->fresh();

        if ($customer) {
            $this->loyaltyService->finalizeTransaction($transaction, $customer, []);
        }

        $this->foodcourtTenantAllocationService->rebuildForTransaction($transaction->fresh(['details']));
        $this->kitchenTicketService->createForTransaction($transaction, 'table_qr');

        $this->auditLogService->log(
            event: 'table_order.self_payment_completed',
            module: 'table_orders',
            auditable: $tableOrder->fresh(),
            description: "Pembayaran {$transaction->payment_method} order {$tableOrder->order_number} terkonfirmasi otomatis.",
            before: [
                'status' => 'pending_cashier_payment',
                'transaction_id' => $transaction->id,
            ],
            after: [
                'status' => 'paid',
                'transaction_id' => $transaction->id,
                'payment_status' => $transaction->payment_status,
                'payment_method' => $transaction->payment_method,
            ],
        );

        $this->printJobService->queueReceipt($transaction, userId: $transaction->cashier_id);

        return $tableOrder;
    }

    private function generateOrderNumber(): string
    {
        return 'TBL-'.Str::upper(Str::random(8));
    }

    private function generateInvoiceNumber(): string
    {
        return $this->transactionInvoiceService->generate();
    }

    private function sanitizeTableOrderItemAttributes(array $attributes): array
    {
        if ($this->supportsTableOrderItemPromoRewardMetadata()) {
            return $attributes;
        }

        unset(
            $attributes['is_promo_reward'],
            $attributes['promo_reward_rule_name'],
            $attributes['promo_reward_label'],
        );

        return $attributes;
    }

    private function normalizePublicPaymentMethod(mixed $value): string
    {
        $paymentMethod = strtolower(trim((string) $value));

        return in_array($paymentMethod, [
            'cash',
            PaymentSetting::GATEWAY_BANK_TRANSFER,
            PaymentSetting::GATEWAY_MIDTRANS,
            PaymentSetting::GATEWAY_XENDIT,
        ], true)
            ? $paymentMethod
            : 'cash';
    }

    private function createPendingSelfServiceTransaction(
        TableOrder $tableOrder,
        string $paymentMethod,
        ?int $bankAccountId = null
    ): Transaction {
        $openShift = $this->cashierShiftService->getOpenShiftForOutlet($tableOrder->outlet_id);

        if (! $openShift) {
            throw ValidationException::withMessages([
                'payment_method' => 'Belum ada shift kasir aktif di outlet ini, jadi pembayaran self order belum bisa diproses.',
            ]);
        }

        $transaction = Transaction::create([
            'cashier_id' => (int) $openShift->user_id,
            'cashier_shift_id' => (int) $openShift->id,
            'outlet_id' => (int) $tableOrder->outlet_id,
            'customer_id' => (int) $tableOrder->customer_id,
            'order_type' => 'dine_in',
            'order_reference_name' => $tableOrder->customer_name,
            'table_id' => (int) $tableOrder->dining_table_id,
            'invoice' => $this->generateInvoiceNumber(),
            'cash' => 0,
            'change' => 0,
            'discount' => 0,
            'shipping_cost' => 0,
            'grand_total' => (int) $tableOrder->resolvedGrandTotal(),
            'payment_method' => $paymentMethod,
            'payment_status' => $paymentMethod === PaymentSetting::GATEWAY_BANK_TRANSFER ? 'unpaid' : 'pending',
            'bank_account_id' => $paymentMethod === PaymentSetting::GATEWAY_BANK_TRANSFER ? $bankAccountId : null,
        ]);

        foreach ($tableOrder->items as $item) {
            $product = $item->product;

            if (! $product) {
                throw ValidationException::withMessages([
                    'items' => "Produk {$item->product_title} tidak lagi tersedia.",
                ]);
            }

            $detail = $transaction->details()->create([
                'transaction_id' => $transaction->id,
                'outlet_id' => $tableOrder->outlet_id,
                'tenant_outlet_id' => $item->tenant_outlet_id ?: $tableOrder->outlet_id,
                'product_id' => $product->id,
                'qty' => (int) $item->qty,
                'base_unit_price' => (int) ($item->base_unit_price ?? $item->unit_price),
                'customer_base_unit_price' => (int) ($item->customer_base_unit_price ?? $item->base_unit_price ?? $item->unit_price),
                'tenant_base_unit_price' => (int) ($item->tenant_base_unit_price ?? $product->buy_price),
                'owner_markup_unit_price' => (int) ($item->owner_markup_unit_price ?? max(0, (int) $product->sell_price - (int) $product->buy_price)),
                'unit_price' => (int) $item->unit_price,
                'price' => (int) $item->line_total,
                'notes' => $item->notes,
                'discount_total' => (int) ($item->discount_total ?? 0),
                'tenant_discount_total' => (int) ($item->tenant_discount_total ?? 0),
                'owner_discount_total' => (int) ($item->owner_discount_total ?? 0),
                'tenant_net_total' => (int) ($item->tenant_net_total ?? ((int) $product->buy_price * (int) $item->qty)),
                'owner_net_total' => (int) ($item->owner_net_total ?? max(0, ((int) $product->sell_price - (int) $product->buy_price) * (int) $item->qty)),
                'pricing_rule_id' => $item->pricing_rule_id,
                'pricing_rule_name' => $item->pricing_rule_name,
                'pricing_rule_kind' => $item->pricing_rule_kind,
                'pricing_rule_price_basis' => $item->pricing_rule_price_basis,
                'pricing_group_key' => $item->pricing_group_key,
                'pricing_group_label' => $item->pricing_group_label,
                'is_promo_reward' => (bool) ($item->is_promo_reward ?? false),
                'promo_reward_rule_name' => $item->promo_reward_rule_name,
                'promo_reward_label' => $item->promo_reward_label,
            ]);

            foreach ($item->modifiers as $modifier) {
                $detail->modifiers()->create([
                    'name' => $modifier->name,
                    'qty' => (int) $modifier->qty,
                    'unit_price' => (int) $modifier->unit_price,
                    'base_price' => (int) ($modifier->base_price ?? $modifier->unit_price),
                    'markup_price' => (int) ($modifier->markup_price ?? 0),
                    'total_price' => (int) $modifier->total_price,
                ]);
            }

            $transaction->profits()->create([
                'transaction_id' => $transaction->id,
                'total' => ((int) $item->line_total) - ((int) $product->buy_price * (int) $item->qty),
            ]);
        }

        return $transaction;
    }

    private function ensureGroupedModifiersSatisfied(
        Product $product,
        Collection $productModifierOptions,
        Collection $selectedModifiers,
        string $errorKey
    ): void {
        $groupedOptions = $productModifierOptions
            ->where('is_active', true)
            ->groupBy(function (ProductModifierOption $option) {
                $groupName = trim((string) ($option->group_name ?? ''));

                return $groupName !== '' ? $groupName : 'Topping';
            });

        foreach ($groupedOptions as $groupName => $options) {
            $firstOption = $options->first();
            $selectionMode = trim((string) ($firstOption->selection_mode ?? 'optional')) ?: 'optional';
            $minSelect = max(
                $selectionMode === 'optional' ? 0 : 1,
                (int) ($firstOption->min_select ?? 0)
            );
            $maxSelectRaw = (int) ($firstOption->max_select ?? 0);
            $maxSelect = $selectionMode === 'single'
                ? 1
                : ($maxSelectRaw > 0 ? $maxSelectRaw : null);
            $selectedCount = $selectedModifiers
                ->whereIn('id', $options->pluck('id')->all())
                ->count();

            if ($selectedCount < $minSelect) {
                throw ValidationException::withMessages([
                    $errorKey => $minSelect <= 1
                        ? "Kategori topping {$groupName} wajib dipilih untuk produk {$product->title}."
                        : "Kategori topping {$groupName} untuk produk {$product->title} wajib memilih minimal {$minSelect} opsi.",
                ]);
            }

            if ($maxSelect !== null && $selectedCount > $maxSelect) {
                throw ValidationException::withMessages([
                    $errorKey => $maxSelect <= 1
                        ? "Kategori topping {$groupName} untuk produk {$product->title} hanya boleh memilih 1 opsi."
                        : "Kategori topping {$groupName} untuk produk {$product->title} maksimal {$maxSelect} opsi.",
                ]);
            }
        }

        if ($groupedOptions->isEmpty()
            && (bool) $product->requires_modifier_selection
            && $selectedModifiers->isEmpty()) {
            throw ValidationException::withMessages([
                $errorKey => "Produk {$product->title} wajib memilih minimal satu topping.",
            ]);
        }
    }

    private function supportsTableOrderItemPromoRewardMetadata(): bool
    {
        if ($this->supportsTableOrderItemPromoRewardMetadata !== null) {
            return $this->supportsTableOrderItemPromoRewardMetadata;
        }

        return $this->supportsTableOrderItemPromoRewardMetadata =
            Schema::hasColumn('table_order_items', 'is_promo_reward')
            && Schema::hasColumn('table_order_items', 'promo_reward_rule_name')
            && Schema::hasColumn('table_order_items', 'promo_reward_label');
    }
}
