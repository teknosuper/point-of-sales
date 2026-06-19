<?php

namespace App\Services;

use App\Models\GoodsReceiving;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductOutletStock;
use App\Models\SalesReturn;
use App\Models\StockMutation;
use App\Models\StockOpname;
use App\Models\SupplierReturn;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use Illuminate\Validation\ValidationException;

class StockMutationService
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function recordInitialStock(Product $product, ?int $userId = null): ?StockMutation
    {
        $initialStock = (int) $product->stock;

        if ($initialStock <= 0) {
            return null;
        }

        $mutation = StockMutation::create([
            'outlet_id' => null,
            'product_id' => $product->id,
            'reference_type' => 'product_create',
            'reference_id' => $product->id,
            'mutation_type' => 'in',
            'qty' => $initialStock,
            'stock_before' => 0,
            'stock_after' => $initialStock,
            'notes' => 'Initial stock saat produk dibuat.',
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Initial stock produk dicatat.',
            before: [
                'product_id' => $product->id,
                'stock_before' => 0,
                'stock_after' => 0,
                'difference' => 0,
                'reason' => 'Initial stock saat produk dibuat.',
                'reference' => 'product:'.$product->id,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => 0,
                'stock_after' => $initialStock,
                'difference' => $initialStock,
                'reason' => 'Initial stock saat produk dibuat.',
                'reference' => 'product:'.$product->id,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'reference_type' => $mutation->reference_type,
                'reference_id' => $mutation->reference_id,
                'mutation_type' => $mutation->mutation_type,
                'qty' => (int) $mutation->qty,
            ],
        );

        return $mutation;
    }

    public function recordStockOpnameAdjustment(
        Product $product,
        StockOpname $stockOpname,
        int $stockBefore,
        int $stockAfter,
        ?string $reason,
        ?int $userId = null
    ): ?StockMutation {
        if ($stockBefore === $stockAfter) {
            return null;
        }

        if ($stockOpname->outlet_id) {
            $this->syncUnifiedStock($product, $stockAfter, (int) $stockOpname->outlet_id, true);
        } else {
            $product->forceFill([
                'stock' => $stockAfter,
            ])->save();
        }

        $mutation = StockMutation::create([
            'outlet_id' => $stockOpname->outlet_id,
            'product_id' => $product->id,
            'reference_type' => 'stock_opname',
            'reference_id' => $stockOpname->id,
            'mutation_type' => 'adjustment',
            'qty' => abs($stockAfter - $stockBefore),
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $reason ?: 'Adjustment dari stock opname.',
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Stok produk disesuaikan melalui stock opname.',
            before: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'difference' => 0,
                'reason' => $reason,
                'reference' => $stockOpname->code,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'difference' => $stockAfter - $stockBefore,
                'reason' => $reason ?: 'Adjustment dari stock opname.',
                'reference' => $stockOpname->code,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'stock_opname_id' => $stockOpname->id,
                'stock_opname_code' => $stockOpname->code,
                'mutation_type' => $mutation->mutation_type,
                'qty' => (int) $mutation->qty,
            ],
        );

        return $mutation;
    }

    public function recordSalesReturnRestock(
        Product $product,
        SalesReturn $salesReturn,
        int $stockBefore,
        int $stockAfter,
        ?string $reason,
        ?int $userId = null
    ): ?StockMutation {
        if ($stockBefore === $stockAfter) {
            return null;
        }

        if ($salesReturn->outlet_id) {
            $this->syncUnifiedStock($product, $stockAfter, (int) $salesReturn->outlet_id, true);
        } else {
            $product->forceFill([
                'stock' => $stockAfter,
            ])->save();
        }

        $mutation = StockMutation::create([
            'outlet_id' => $salesReturn->outlet_id,
            'product_id' => $product->id,
            'reference_type' => 'sales_return',
            'reference_id' => $salesReturn->id,
            'mutation_type' => 'in',
            'qty' => abs($stockAfter - $stockBefore),
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $reason ?: 'Restock dari retur penjualan.',
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Stok produk bertambah dari restock retur penjualan.',
            before: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'difference' => 0,
                'reason' => $reason,
                'reference' => $salesReturn->code,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'difference' => $stockAfter - $stockBefore,
                'reason' => $reason ?: 'Restock dari retur penjualan.',
                'reference' => $salesReturn->code,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'sales_return_id' => $salesReturn->id,
                'sales_return_code' => $salesReturn->code,
                'mutation_type' => $mutation->mutation_type,
                'qty' => (int) $mutation->qty,
            ],
        );

        return $mutation;
    }

    public function recordPurchaseInbound(
        Product $product,
        GoodsReceiving $goodsReceiving,
        int $qty,
        int $stockBefore,
        int $stockAfter,
        ?string $notes = null,
        ?int $userId = null
    ): StockMutation {
        if ($goodsReceiving->outlet_id) {
            $this->syncUnifiedStock($product, $stockAfter, (int) $goodsReceiving->outlet_id, true);
        } else {
            $product->forceFill([
                'stock' => $stockAfter,
            ])->save();
        }

        $mutation = StockMutation::create([
            'outlet_id' => $goodsReceiving->outlet_id,
            'product_id' => $product->id,
            'reference_type' => 'goods_receiving',
            'reference_id' => $goodsReceiving->id,
            'mutation_type' => 'in',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes ?: 'Stok masuk dari penerimaan barang.',
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Stok masuk dari penerimaan barang '.$goodsReceiving->document_number,
            before: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'difference' => 0,
                'reference' => $goodsReceiving->document_number,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'difference' => $stockAfter - $stockBefore,
                'reference' => $goodsReceiving->document_number,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'goods_receiving_id' => $goodsReceiving->id,
                'document_number' => $goodsReceiving->document_number,
                'mutation_type' => $mutation->mutation_type,
                'qty' => $qty,
            ],
        );

        return $mutation;
    }

    public function recordSupplierReturnOut(
        Product $product,
        SupplierReturn $supplierReturn,
        int $qty,
        int $stockBefore,
        int $stockAfter,
        ?string $notes = null,
        ?int $userId = null
    ): StockMutation {
        if ($stockAfter < 0) {
            throw ValidationException::withMessages([
                'stock' => "Stok outlet tidak mencukupi untuk retur supplier produk {$product->title}.",
            ]);
        }

        if ($supplierReturn->outlet_id) {
            $this->syncUnifiedStock($product, $stockAfter, (int) $supplierReturn->outlet_id, true);
        } else {
            $product->forceFill([
                'stock' => $stockAfter,
            ])->save();
        }

        $mutation = StockMutation::create([
            'outlet_id' => $supplierReturn->outlet_id,
            'product_id' => $product->id,
            'reference_type' => 'supplier_return',
            'reference_id' => $supplierReturn->id,
            'mutation_type' => 'out',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes ?: 'Retur barang ke supplier.',
            'created_by' => $userId,
        ]);

        $this->auditLogService->log(
            event: 'stock.adjusted',
            module: 'stock',
            auditable: $product,
            description: 'Stok keluar dari retur supplier '.$supplierReturn->document_number,
            before: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockBefore,
                'difference' => 0,
                'reference' => $supplierReturn->document_number,
            ],
            after: [
                'product_id' => $product->id,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'difference' => $stockAfter - $stockBefore,
                'reference' => $supplierReturn->document_number,
            ],
            meta: [
                'stock_mutation_id' => $mutation->id,
                'supplier_return_id' => $supplierReturn->id,
                'document_number' => $supplierReturn->document_number,
                'mutation_type' => $mutation->mutation_type,
                'qty' => $qty,
            ],
        );

        return $mutation;
    }

    /**
     * Batch decrement stock for all transaction details at once.
     * Returns audit log payloads to be logged AFTER the transaction commits,
     * avoiding N audit_log INSERTs inside the DB::transaction.
     *
     * @param  array<array{product: Product, detail: TransactionDetail, qty: int}>  $items
     * @return array<int, array{event: string, module: string, auditable: Product, description: string, before: array, after: array, meta: array}>
     */
    public function decrementBatchForTransaction(
        array $items,
        Transaction $transaction,
        ?int $userId = null
    ): array {
        $outletId = (int) $transaction->outlet_id;
        $auditPayloads = [];

        // Pre-load all ProductOutletStock rows for the products in this transaction
        $productIds = array_map(fn (array $item) => $item['product']->id, $items);
        $existingStocks = ProductOutletStock::query()
            ->where('outlet_id', $outletId)
            ->whereIn('product_id', $productIds)
            ->get()
            ->keyBy('product_id');

        foreach ($items as $item) {
            /** @var Product $product */
            $product = $item['product'];
            /** @var TransactionDetail $detail */
            $detail = $item['detail'];
            $qty = (int) $item['qty'];

            $outletStock = $existingStocks->get($product->id);

            if (! $outletStock) {
                $outletStock = $this->ensureOutletStock($product, $outletId);
                $existingStocks->put($product->id, $outletStock);
            }

            $stockBefore = (int) $outletStock->stock;
            $stockAfter = $stockBefore - $qty;

            if ($stockAfter < 0) {
                throw ValidationException::withMessages([
                    'stock' => "Stok outlet tidak mencukupi untuk produk {$product->title}.",
                ]);
            }

            $this->syncUnifiedStock($product, $stockAfter, $outletId, true);
            $outletStock->forceFill([
                'stock' => $stockAfter,
            ]);
            $existingStocks->put($product->id, $outletStock);

            $mutation = StockMutation::create([
                'outlet_id' => $outletId,
                'product_id' => $product->id,
                'reference_type' => 'transaction',
                'reference_id' => $transaction->id,
                'mutation_type' => 'out',
                'qty' => $qty,
                'stock_before' => $stockBefore,
                'stock_after' => $stockAfter,
                'notes' => 'Stok keluar dari transaksi '.$transaction->invoice.'.',
                'created_by' => $userId,
            ]);

            // Collect audit payload instead of logging immediately
            $auditPayloads[] = [
                'event' => 'stock.decremented',
                'module' => 'stock',
                'auditable' => $product,
                'description' => 'Stok produk dikurangi dari transaksi '.$transaction->invoice.'.',
                'before' => [
                    'product_id' => $product->id,
                    'stock_before' => $stockBefore,
                    'stock_after' => $stockBefore,
                    'difference' => 0,
                    'reference' => $transaction->invoice,
                ],
                'after' => [
                    'product_id' => $product->id,
                    'stock_before' => $stockBefore,
                    'stock_after' => $stockAfter,
                    'difference' => $stockAfter - $stockBefore,
                    'reference' => $transaction->invoice,
                ],
                'meta' => [
                    'stock_mutation_id' => $mutation->id,
                    'transaction_id' => $transaction->id,
                    'invoice' => $transaction->invoice,
                    'mutation_type' => 'out',
                    'qty' => $qty,
                ],
            ];
        }

        return $auditPayloads;
    }

    public function stockForOutlet(Product $product, int $outletId): int
    {
        return (int) (Product::query()->whereKey($product->id)->value('stock') ?? $product->stock ?? 0);
    }

    public function decrementForTransactionDetail(
        Product $product,
        Transaction $transaction,
        TransactionDetail $detail,
        int $qty,
        ?int $userId = null
    ): StockMutation {
        $outletId = (int) $transaction->outlet_id;
        $outletStock = $this->ensureOutletStock($product, $outletId);

        $stockBefore = (int) $outletStock->stock;
        $stockAfter = $stockBefore - $qty;

        if ($stockAfter < 0) {
            throw ValidationException::withMessages([
                'stock' => "Stok outlet tidak mencukupi untuk produk {$product->title}.",
            ]);
        }

        $this->syncUnifiedStock($product, $stockAfter, $outletId, true);

        return StockMutation::create([
            'outlet_id' => $outletId,
            'product_id' => $product->id,
            'reference_type' => 'transaction',
            'reference_id' => $transaction->id,
            'mutation_type' => 'out',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => 'Stok keluar dari transaksi '.$transaction->invoice.'.',
            'created_by' => $userId,
        ]);
    }

    public function incrementForOutlet(
        Product $product,
        int $outletId,
        int $qty,
        string $referenceType,
        int $referenceId,
        string $notes,
        ?int $userId = null
    ): StockMutation {
        $outletStock = $this->ensureOutletStock($product, $outletId);

        $stockBefore = (int) $outletStock->stock;
        $stockAfter = $stockBefore + $qty;

        $this->syncUnifiedStock($product, $stockAfter, $outletId, true);

        return StockMutation::create([
            'outlet_id' => $outletId,
            'product_id' => $product->id,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'mutation_type' => 'in',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes,
            'created_by' => $userId,
        ]);
    }

    public function decrementForOutlet(
        Product $product,
        int $outletId,
        int $qty,
        string $referenceType,
        int $referenceId,
        string $notes,
        ?int $userId = null
    ): StockMutation {
        $outletStock = $this->ensureOutletStock($product, $outletId);

        $stockBefore = (int) $outletStock->stock;
        $stockAfter = $stockBefore - $qty;

        if ($stockAfter < 0) {
            throw ValidationException::withMessages([
                'stock' => "Stok outlet tidak mencukupi untuk produk {$product->title}.",
            ]);
        }

        $this->syncUnifiedStock($product, $stockAfter, $outletId, true);

        return StockMutation::create([
            'outlet_id' => $outletId,
            'product_id' => $product->id,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'mutation_type' => 'out',
            'qty' => $qty,
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes,
            'created_by' => $userId,
        ]);
    }

    public function setPhysicalStockForOutlet(
        Product $product,
        int $outletId,
        int $stockAfter,
        string $referenceType,
        int $referenceId,
        ?string $notes = null,
        ?int $userId = null
    ): ?StockMutation {
        $outletStock = $this->ensureOutletStock($product, $outletId);

        $stockBefore = (int) $outletStock->stock;

        if ($stockBefore === $stockAfter) {
            $this->syncUnifiedStock($product, $stockAfter, $outletId, true);
            return null;
        }

        $outletStock->forceFill([
            'stock' => $stockAfter,
            'last_counted_at' => now(),
        ])->save();

        $this->syncLegacyProductStock($product);

        return StockMutation::create([
            'outlet_id' => $outletId,
            'product_id' => $product->id,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'mutation_type' => 'adjustment',
            'qty' => abs($stockAfter - $stockBefore),
            'stock_before' => $stockBefore,
            'stock_after' => $stockAfter,
            'notes' => $notes ?: 'Adjustment stok outlet.',
            'created_by' => $userId,
        ]);
    }

    private function ensureOutletStock(Product $product, int $outletId): ProductOutletStock
    {
        return ProductOutletStock::query()->firstOrCreate(
            [
                'outlet_id' => $outletId,
                'product_id' => $product->id,
            ],
            [
                'stock' => $this->seedOutletStock($product),
                'reorder_level' => 0,
            ]
        );
    }

    private function seedOutletStock(Product $product): int
    {
        return (int) $product->stock;
    }

    private function syncLegacyProductStock(Product $product): void
    {
        $product->forceFill([
            'stock' => max(0, (int) $product->stock),
        ])->save();
    }

    private function syncUnifiedStock(
        Product $product,
        int $stockAfter,
        ?int $outletId = null,
        bool $touchLastCounted = false
    ): void {
        $stockAfter = max(0, $stockAfter);

        if ($outletId) {
            $this->ensureOutletStock($product, $outletId);
        }

        $this->ensureAllOutletStocks($product, $stockAfter);

        $update = ['stock' => $stockAfter];

        if ($touchLastCounted) {
            $update['last_counted_at'] = now();
        }

        ProductOutletStock::query()
            ->where('product_id', $product->id)
            ->update($update);

        $product->forceFill([
            'stock' => $stockAfter,
        ])->save();
    }

    private function ensureAllOutletStocks(Product $product, int $stock = 0): void
    {
        $existingOutletIds = ProductOutletStock::query()
            ->where('product_id', $product->id)
            ->pluck('outlet_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $missingOutletIds = Outlet::query()
            ->active()
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->reject(fn (int $id) => in_array($id, $existingOutletIds, true));

        foreach ($missingOutletIds as $missingOutletId) {
            ProductOutletStock::query()->create([
                'outlet_id' => $missingOutletId,
                'product_id' => $product->id,
                'stock' => $stock,
                'reorder_level' => 0,
                'last_counted_at' => now(),
            ]);
        }
    }
}
