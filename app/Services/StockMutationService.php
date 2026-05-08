<?php

namespace App\Services;

use App\Models\GoodsReceiving;
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
            ProductOutletStock::query()->updateOrCreate(
                [
                    'outlet_id' => $stockOpname->outlet_id,
                    'product_id' => $product->id,
                ],
                [
                    'stock' => $stockAfter,
                    'reorder_level' => 0,
                    'last_counted_at' => now(),
                ]
            );
        }

        $product->forceFill([
            'stock' => $stockAfter,
        ])->save();

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
            ProductOutletStock::query()->updateOrCreate(
                [
                    'outlet_id' => $salesReturn->outlet_id,
                    'product_id' => $product->id,
                ],
                [
                    'stock' => $stockAfter,
                    'reorder_level' => 0,
                    'last_counted_at' => now(),
                ]
            );
        }

        $product->forceFill([
            'stock' => max((int) $product->stock, $stockAfter),
        ])->save();

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
            ProductOutletStock::query()->updateOrCreate(
                [
                    'outlet_id' => $goodsReceiving->outlet_id,
                    'product_id' => $product->id,
                ],
                [
                    'stock' => $stockAfter,
                    'reorder_level' => 0,
                    'last_counted_at' => now(),
                ]
            );
        }

        $product->forceFill([
            'stock' => max((int) $product->stock, $stockAfter),
        ])->save();

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
            ProductOutletStock::query()->updateOrCreate(
                [
                    'outlet_id' => $supplierReturn->outlet_id,
                    'product_id' => $product->id,
                ],
                [
                    'stock' => $stockAfter,
                    'reorder_level' => 0,
                    'last_counted_at' => now(),
                ]
            );
        }

        $product->forceFill([
            'stock' => max(0, min((int) $product->stock, $stockAfter)),
        ])->save();

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

    public function stockForOutlet(Product $product, int $outletId): int
    {
        $stock = ProductOutletStock::query()
            ->where('outlet_id', $outletId)
            ->where('product_id', $product->id)
            ->value('stock');

        return $stock !== null ? (int) $stock : (int) $product->stock;
    }

    public function decrementForTransactionDetail(
        Product $product,
        Transaction $transaction,
        TransactionDetail $detail,
        int $qty,
        ?int $userId = null
    ): StockMutation {
        $outletId = (int) $transaction->outlet_id;
        $outletStock = ProductOutletStock::query()->firstOrCreate(
            [
                'outlet_id' => $outletId,
                'product_id' => $product->id,
            ],
            [
                'stock' => (int) $product->stock,
                'reorder_level' => 0,
            ]
        );

        $stockBefore = (int) $outletStock->stock;
        $stockAfter = $stockBefore - $qty;

        if ($stockAfter < 0) {
            throw ValidationException::withMessages([
                'stock' => "Stok outlet tidak mencukupi untuk produk {$product->title}.",
            ]);
        }

        $outletStock->forceFill([
            'stock' => $stockAfter,
        ])->save();

        $product->forceFill([
            'stock' => max(0, (int) $product->stock - $qty),
        ])->save();

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
        $outletStock = ProductOutletStock::query()->firstOrCreate(
            [
                'outlet_id' => $outletId,
                'product_id' => $product->id,
            ],
            [
                'stock' => (int) $product->stock,
                'reorder_level' => 0,
            ]
        );

        $stockBefore = (int) $outletStock->stock;
        $stockAfter = $stockBefore + $qty;

        $outletStock->forceFill([
            'stock' => $stockAfter,
            'last_counted_at' => now(),
        ])->save();

        $product->forceFill([
            'stock' => max((int) $product->stock, $stockAfter),
        ])->save();

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
        $outletStock = ProductOutletStock::query()->firstOrCreate(
            [
                'outlet_id' => $outletId,
                'product_id' => $product->id,
            ],
            [
                'stock' => (int) $product->stock,
                'reorder_level' => 0,
            ]
        );

        $stockBefore = (int) $outletStock->stock;
        $stockAfter = $stockBefore - $qty;

        if ($stockAfter < 0) {
            throw ValidationException::withMessages([
                'stock' => "Stok outlet tidak mencukupi untuk produk {$product->title}.",
            ]);
        }

        $outletStock->forceFill([
            'stock' => $stockAfter,
            'last_counted_at' => now(),
        ])->save();

        $product->forceFill([
            'stock' => max(0, min((int) $product->stock, $stockAfter)),
        ])->save();

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
        $outletStock = ProductOutletStock::query()->firstOrCreate(
            [
                'outlet_id' => $outletId,
                'product_id' => $product->id,
            ],
            [
                'stock' => (int) $product->stock,
                'reorder_level' => 0,
            ]
        );

        $stockBefore = (int) $outletStock->stock;

        if ($stockBefore === $stockAfter) {
            return null;
        }

        $outletStock->forceFill([
            'stock' => $stockAfter,
            'last_counted_at' => now(),
        ])->save();

        $product->forceFill([
            'stock' => $stockAfter,
        ])->save();

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
}
