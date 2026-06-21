<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseOrderService
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function generateDocumentNumber(): string
    {
        $prefix = 'PO-'.now()->format('Ymd').'-';
        $lockKey = 'purchase-order-document:'.$prefix;

        try {
            return Cache::lock($lockKey, 10)->block(5, function () use ($prefix) {
                return $this->nextDocumentNumber($prefix);
            });
        } catch (\Throwable) {
            return $this->nextDocumentNumber($prefix);
        }
    }

    public function createOrder(array $data, array $items, int $userId): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $items, $userId) {
            $order = PurchaseOrder::create([
                'outlet_id' => $data['outlet_id'] ?? null,
                'supplier_id' => $data['supplier_id'] ?? null,
                'document_number' => $data['document_number'] ?? $this->generateDocumentNumber(),
                'status' => 'draft',
                'notes' => $data['notes'] ?? null,
                'created_by' => $userId,
            ]);

            foreach ($items as $item) {
                PurchaseOrderItem::create([
                    'purchase_order_id' => $order->id,
                    'product_id' => $item['product_id'],
                    'qty_ordered' => $item['qty_ordered'],
                    'qty_received' => 0,
                    'unit_price' => $item['unit_price'],
                ]);
            }

            $this->auditLogService->log(
                event: 'purchase_order.created',
                module: 'purchase',
                auditable: $order,
                description: 'Purchase order '.$order->document_number.' dibuat.',
                after: [
                    'document_number' => $order->document_number,
                    'supplier_id' => $order->supplier_id,
                    'status' => 'draft',
                    'total_items' => count($items),
                ],
                meta: ['purchase_order_id' => $order->id],
            );

            return $order;
        });
    }

    public function placeOrder(PurchaseOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $before = $order->replicate();

            $order->update([
                'status' => 'ordered',
                'ordered_at' => now(),
            ]);

            $this->auditLogService->log(
                event: 'purchase_order.ordered',
                module: 'purchase',
                auditable: $order,
                description: 'Purchase order '.$order->document_number.' dipesan ke supplier.',
                before: ['status' => $before->status],
                after: ['status' => 'ordered'],
                meta: ['purchase_order_id' => $order->id],
            );
        });
    }

    public function cancelOrder(PurchaseOrder $order): void
    {
        DB::transaction(function () use ($order) {
            $before = $order->replicate();

            $order->update([
                'status' => 'cancelled',
            ]);

            $this->auditLogService->log(
                event: 'purchase_order.cancelled',
                module: 'purchase',
                auditable: $order,
                description: 'Purchase order '.$order->document_number.' dibatalkan.',
                before: ['status' => $before->status],
                after: ['status' => 'cancelled'],
                meta: ['purchase_order_id' => $order->id],
            );
        });
    }

    private function nextDocumentNumber(string $prefix): string
    {
        $last = PurchaseOrder::where('document_number', 'like', $prefix.'%')
            ->orderByDesc('document_number')
            ->value('document_number');

        $next = $last ? (int) Str::afterLast($last, '-') + 1 : 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
