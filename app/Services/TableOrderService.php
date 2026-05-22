<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\DiningTable;
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

class TableOrderService
{
    public function __construct(
        private readonly CashierShiftService $cashierShiftService,
        private readonly StockMutationService $stockMutationService,
        private readonly KitchenTicketService $kitchenTicketService,
        private readonly FoodcourtTenantAllocationService $foodcourtTenantAllocationService,
        private readonly AuditLogService $auditLogService,
        private readonly LoyaltyService $loyaltyService,
        private readonly PricingService $pricingService
    ) {}

    public function createFromPublicMenu(DiningTable $table, Customer $customer, array $payload): TableOrder
    {
        if ($table->status !== 'active' || ! $table->self_order_enabled) {
            throw ValidationException::withMessages([
                'table' => 'Meja ini tidak menerima self-order saat ini.',
            ]);
        }

        $items = collect($payload['items'] ?? [])
            ->map(function (array $item) {
                return [
                    'product_id' => (int) ($item['product_id'] ?? 0),
                    'qty' => max(0, (int) ($item['qty'] ?? 0)),
                    'notes' => filled($item['notes'] ?? null) ? (string) $item['notes'] : null,
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

        $orderItems = $items->map(function (array $item, int $index) use ($products, $modifierOptions, $table) {
            /** @var Product|null $product */
            $product = $products->get($item['product_id']);
            if (! $product) {
                throw ValidationException::withMessages([
                    'items' => 'Ada produk yang tidak ditemukan.',
                ]);
            }

            $availableStock = $this->resolveAvailableStock($product, $table->outlet_id);
            if ($availableStock < $item['qty']) {
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

            $modifierUnitTotal = (int) $selectedModifiers->sum(fn (ProductModifierOption $option) => (int) $option->price);

            return [
                'cart_id' => -($index + 1),
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
                'notes' => $item['notes'],
                'modifiers' => $selectedModifiers->map(fn (ProductModifierOption $option) => [
                    'product_modifier_option_id' => $option->id,
                    'name' => $option->name,
                    'qty' => $item['qty'],
                    'unit_price' => (int) $option->price,
                    'total_price' => (int) $option->price * $item['qty'],
                ])->values()->all(),
            ];
        });

        $pricingPreview = $this->pricingService->previewCart(
            $orderItems->map(function (array $item) use ($products) {
                $cart = new \App\Models\Cart([
                    'id' => (int) $item['cart_id'],
                    'product_id' => (int) $item['product_id'],
                    'qty' => (int) $item['qty'],
                    'price' => (int) $item['line_total'],
                ]);

                $cart->setRelation('product', $products->get($item['product_id']));
                $cart->setRelation('modifiers', collect($item['modifiers'] ?? [])->map(
                    fn (array $modifier) => (object) ['total_price' => (int) ($modifier['total_price'] ?? 0)]
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
                'unit_price' => (int) ($pricingItem['effective_unit_price'] ?? $item['unit_price']),
                'line_total' => (int) ($pricingItem['line_total'] ?? $item['line_total']),
                'discount_total' => (int) ($pricingItem['line_discount_total'] ?? $item['discount_total']),
                'pricing_rule_id' => data_get($pricingItem, 'pricing_rule.id'),
                'pricing_rule_name' => data_get($pricingItem, 'pricing_rule.name'),
                'pricing_rule_kind' => data_get($pricingItem, 'pricing_rule.kind'),
                'pricing_group_key' => $pricingItem['pricing_group_key'] ?? null,
                'pricing_group_label' => $pricingItem['pricing_group_label'] ?? null,
            ];
        })->values();

        $subtotal = (int) $orderItems->sum('line_total');

        $tableOrder = DB::transaction(function () use ($table, $customer, $payload, $orderItems, $subtotal) {
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
                'payment_method' => 'cash',
                'status' => 'pending_cashier_payment',
                'subtotal' => $subtotal,
                'grand_total' => $subtotal,
            ]);

            foreach ($orderItems as $item) {
                $modifiers = $item['modifiers'] ?? [];
                unset($item['cart_id']);
                unset($item['modifiers']);

                $orderItem = $order->items()->create($item);

                foreach ($modifiers as $modifier) {
                    $orderItem->modifiers()->create($modifier);
                }
            }

            return $order->load(['items.modifiers', 'diningTable', 'outlet']);
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

    public function approveCashPayment(TableOrder $tableOrder, User $cashier, int $cashAmount): Transaction
    {
        if ($tableOrder->status !== 'pending_cashier_payment') {
            throw ValidationException::withMessages([
                'order' => 'Order ini tidak lagi menunggu pembayaran kasir.',
            ]);
        }

        if ($cashAmount < (int) $tableOrder->grand_total) {
            throw ValidationException::withMessages([
                'cash' => 'Nominal tunai kurang dari total order.',
            ]);
        }

        $tableOrder->loadMissing(['items.product', 'items.modifiers', 'diningTable']);
        $activeShift = $this->cashierShiftService->requireActiveShiftForUser(
            $cashier->id,
            $tableOrder->outlet_id,
            lockForUpdate: true
        );

        $transaction = DB::transaction(function () use ($tableOrder, $cashier, $activeShift, $cashAmount) {
            $invoice = $this->generateInvoiceNumber();
            $changeAmount = max(0, $cashAmount - (int) $tableOrder->grand_total);

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
                'grand_total' => (int) $tableOrder->grand_total,
                'payment_method' => 'cash',
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
                    'unit_price' => (int) $item->unit_price,
                    'price' => (int) $item->line_total,
                    'notes' => $item->notes,
                    'discount_total' => (int) ($item->discount_total ?? 0),
                    'pricing_rule_id' => $item->pricing_rule_id,
                    'pricing_rule_name' => $item->pricing_rule_name,
                    'pricing_rule_kind' => $item->pricing_rule_kind,
                    'pricing_group_key' => $item->pricing_group_key,
                    'pricing_group_label' => $item->pricing_group_label,
                ]);

                foreach ($item->modifiers as $modifier) {
                    $detail->modifiers()->create([
                        'name' => $modifier->name,
                        'qty' => (int) $modifier->qty,
                        'unit_price' => (int) $modifier->unit_price,
                        'total_price' => (int) $modifier->total_price,
                    ]);
                }

                $transaction->profits()->create([
                    'transaction_id' => $transaction->id,
                    'total' => ((int) $item->line_total) - ((int) $product->buy_price * (int) $item->qty),
                ]);

                $this->stockMutationService->decrementForTransactionDetail(
                    $product,
                    $transaction,
                    $detail,
                    (int) $item->qty,
                    $cashier->id
                );
            }

            $transaction->refresh();
            $transaction->load(['details.product.kitchenStationMappings', 'details.modifiers']);

            $customer = $tableOrder->customer?->fresh();
            if ($customer) {
                $this->loyaltyService->finalizeTransaction($transaction, $customer, []);
            }

            $this->foodcourtTenantAllocationService->rebuildForTransaction($transaction->fresh(['details']));
            $this->kitchenTicketService->createForTransaction($transaction, 'table_qr');

            $tableOrder->update([
                'status' => 'paid',
                'approved_by' => $cashier->id,
                'approved_at' => now(),
                'transaction_id' => $transaction->id,
            ]);

            return $transaction->fresh(['diningTable', 'details.product']);
        });

        $this->auditLogService->log(
            event: 'table_order.cash_payment_approved',
            module: 'table_orders',
            auditable: $tableOrder->fresh(),
            description: "Pembayaran tunai order {$tableOrder->order_number} dikonfirmasi kasir.",
            before: [
                'status' => 'pending_cashier_payment',
                'transaction_id' => null,
            ],
            after: [
                'status' => 'paid',
                'transaction_id' => $transaction->id,
                'invoice' => $transaction->invoice,
            ],
            actor: $cashier
        );

        return $transaction;
    }

    public function cancel(TableOrder $tableOrder, User $actor, ?string $reason = null): TableOrder
    {
        if ($tableOrder->status !== 'pending_cashier_payment') {
            throw ValidationException::withMessages([
                'order' => 'Hanya order yang masih menunggu pembayaran yang bisa dibatalkan.',
            ]);
        }

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
            actor: $actor
        );

        return $tableOrder;
    }

    private function resolveAvailableStock(Product $product, int $outletId): int
    {
        if (Schema::hasTable('product_outlet_stocks')) {
            $stock = ProductOutletStock::query()
                ->where('outlet_id', $outletId)
                ->where('product_id', $product->id)
                ->value('stock');

            return (int) ($stock ?? 0);
        }

        return (int) ($product->stock ?? 0);
    }

    private function generateOrderNumber(): string
    {
        return 'TBL-'.Str::upper(Str::random(8));
    }

    private function generateInvoiceNumber(): string
    {
        return 'TRX-'.Str::upper(Str::random(10));
    }
}
