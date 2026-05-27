<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceiving;
use App\Models\Payable;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierReturn;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Inertia\Inertia;

class ProcurementReportController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $filters = [
            'start_date' => (string) $request->input('start_date', ''),
            'end_date' => (string) $request->input('end_date', ''),
            'supplier_id' => (string) $request->input('supplier_id', ''),
            'search' => trim((string) $request->input('search', '')),
            'po_status' => (string) $request->input('po_status', ''),
            'payable_status' => (string) $request->input('payable_status', ''),
            'return_status' => (string) $request->input('return_status', ''),
        ];

        $purchaseOrders = $this->purchaseOrdersQuery($outlet?->id, $filters)
            ->with(['supplier:id,name', 'creator:id,name'])
            ->with('items:id,purchase_order_id,qty_ordered,unit_price')
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (PurchaseOrder $order) => [
                'id' => $order->id,
                'document_number' => $order->document_number,
                'status' => $order->status,
                'supplier_name' => $order->supplier?->name,
                'creator_name' => $order->creator?->name,
                'ordered_at' => optional($order->ordered_at)->toIso8601String(),
                'created_at' => optional($order->created_at)->toIso8601String(),
                'total_amount' => (int) $order->items->sum(fn ($item) => (int) $item->qty_ordered * (int) $item->unit_price),
                'items_count' => $order->items->count(),
            ])
            ->values();

        $goodsReceivings = $this->goodsReceivingsQuery($outlet?->id, $filters)
            ->with(['supplier:id,name', 'receiver:id,name', 'purchaseOrder:id,document_number'])
            ->with(['items.purchaseOrderItem:id,unit_price'])
            ->latest('received_at')
            ->limit(10)
            ->get()
            ->map(fn (GoodsReceiving $receiving) => [
                'id' => $receiving->id,
                'document_number' => $receiving->document_number,
                'purchase_order_number' => $receiving->purchaseOrder?->document_number,
                'supplier_name' => $receiving->supplier?->name,
                'receiver_name' => $receiving->receiver?->name,
                'received_at' => optional($receiving->received_at)->toIso8601String(),
                'total_amount' => (int) $receiving->items->sum(
                    fn ($item) => (int) $item->qty_received * (int) ($item->purchaseOrderItem?->unit_price ?? 0)
                ),
                'items_count' => $receiving->items->count(),
            ])
            ->values();

        $payables = $this->payablesQuery($outlet?->id, $filters)
            ->with('supplier:id,name')
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn (Payable $payable) => [
                'id' => $payable->id,
                'document_number' => $payable->document_number,
                'status' => $payable->status,
                'supplier_name' => $payable->supplier?->name,
                'due_date' => optional($payable->due_date)->toDateString(),
                'total' => (int) round($payable->total ?? 0),
                'paid' => (int) round($payable->paid ?? 0),
                'remaining' => max(0, (int) round(($payable->total ?? 0) - ($payable->paid ?? 0))),
            ])
            ->values();

        $supplierReturns = $this->supplierReturnsQuery($outlet?->id, $filters)
            ->with(['supplier:id,name', 'creator:id,name'])
            ->with('items:id,supplier_return_id,qty_returned,unit_price')
            ->latest('created_at')
            ->limit(10)
            ->get()
            ->map(fn (SupplierReturn $return) => [
                'id' => $return->id,
                'document_number' => $return->document_number,
                'status' => $return->status,
                'supplier_name' => $return->supplier?->name,
                'creator_name' => $return->creator?->name,
                'returned_at' => optional($return->returned_at)->toIso8601String(),
                'created_at' => optional($return->created_at)->toIso8601String(),
                'total_amount' => (int) round($return->items->sum(fn ($item) => (int) $item->qty_returned * (float) $item->unit_price)),
                'items_count' => $return->items->count(),
            ])
            ->values();

        $summary = [
            'purchase_order_total' => (int) $this->purchaseOrdersQuery($outlet?->id, $filters)
                ->with('items:id,purchase_order_id,qty_ordered,unit_price')
                ->get()
                ->sum(fn (PurchaseOrder $order) => $order->items->sum(fn ($item) => (int) $item->qty_ordered * (int) $item->unit_price)),
            'goods_receiving_total' => (int) $this->goodsReceivingsQuery($outlet?->id, $filters)
                ->with(['items.purchaseOrderItem:id,unit_price'])
                ->get()
                ->sum(fn (GoodsReceiving $receiving) => $receiving->items->sum(fn ($item) => (int) $item->qty_received * (int) ($item->purchaseOrderItem?->unit_price ?? 0))),
            'payable_total' => (int) round($this->payablesQuery($outlet?->id, $filters)->sum('total')),
            'payable_paid_total' => (int) round($this->payablesQuery($outlet?->id, $filters)->sum('paid')),
            'supplier_return_total' => (int) round($this->supplierReturnsQuery($outlet?->id, $filters)
                ->with('items:id,supplier_return_id,qty_returned,unit_price')
                ->get()
                ->sum(fn (SupplierReturn $return) => $return->items->sum(fn ($item) => (int) $item->qty_returned * (float) $item->unit_price))),
        ];
        $summary['payable_remaining_total'] = max(0, $summary['payable_total'] - $summary['payable_paid_total']);

        $suppliers = Supplier::query()
            ->when(
                $outlet?->id,
                fn ($query) => $query->where('outlet_id', $outlet->id),
                fn ($query) => $query->whereNull('outlet_id')
            )
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Dashboard/Reports/Procurement', [
            'filters' => $filters,
            'summary' => $summary,
            'purchaseOrders' => $purchaseOrders,
            'goodsReceivings' => $goodsReceivings,
            'payables' => $payables,
            'supplierReturns' => $supplierReturns,
            'suppliers' => $suppliers,
            'workspace' => [
                'mode' => $outlet?->outlet_type === 'tenant' ? 'tenant' : 'owner',
                'active_outlet' => $outlet?->profilePayload(),
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $filters = [
            'start_date' => (string) $request->input('start_date', ''),
            'end_date' => (string) $request->input('end_date', ''),
            'supplier_id' => (string) $request->input('supplier_id', ''),
            'search' => trim((string) $request->input('search', '')),
            'po_status' => (string) $request->input('po_status', ''),
            'payable_status' => (string) $request->input('payable_status', ''),
            'return_status' => (string) $request->input('return_status', ''),
        ];

        $filename = 'procurement-report-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($outlet, $filters) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['section', 'document_number', 'status', 'supplier', 'reference', 'date', 'amount', 'paid', 'remaining']);

            foreach ($this->purchaseOrdersQuery($outlet?->id, $filters)->with(['supplier:id,name', 'items:id,purchase_order_id,qty_ordered,unit_price'])->get() as $order) {
                fputcsv($handle, [
                    'purchase_order',
                    $order->document_number,
                    $order->status,
                    $order->supplier?->name,
                    '',
                    optional($order->created_at)->toDateString(),
                    (int) $order->items->sum(fn ($item) => (int) $item->qty_ordered * (int) $item->unit_price),
                    '',
                    '',
                ]);
            }

            foreach ($this->goodsReceivingsQuery($outlet?->id, $filters)->with(['supplier:id,name', 'purchaseOrder:id,document_number', 'items.purchaseOrderItem:id,unit_price'])->get() as $receiving) {
                fputcsv($handle, [
                    'goods_receiving',
                    $receiving->document_number,
                    '',
                    $receiving->supplier?->name,
                    $receiving->purchaseOrder?->document_number,
                    optional($receiving->received_at)->toDateString(),
                    (int) $receiving->items->sum(fn ($item) => (int) $item->qty_received * (int) ($item->purchaseOrderItem?->unit_price ?? 0)),
                    '',
                    '',
                ]);
            }

            foreach ($this->payablesQuery($outlet?->id, $filters)->with('supplier:id,name')->get() as $payable) {
                fputcsv($handle, [
                    'payable',
                    $payable->document_number,
                    $payable->status,
                    $payable->supplier?->name,
                    '',
                    optional($payable->due_date)->toDateString(),
                    (int) round($payable->total ?? 0),
                    (int) round($payable->paid ?? 0),
                    max(0, (int) round(($payable->total ?? 0) - ($payable->paid ?? 0))),
                ]);
            }

            foreach ($this->supplierReturnsQuery($outlet?->id, $filters)->with(['supplier:id,name', 'items:id,supplier_return_id,qty_returned,unit_price'])->get() as $return) {
                fputcsv($handle, [
                    'supplier_return',
                    $return->document_number,
                    $return->status,
                    $return->supplier?->name,
                    '',
                    optional($return->created_at)->toDateString(),
                    (int) round($return->items->sum(fn ($item) => (int) $item->qty_returned * (float) $item->unit_price)),
                    '',
                    '',
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    private function purchaseOrdersQuery(?int $outletId, array $filters)
    {
        return PurchaseOrder::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->when($filters['supplier_id'] !== '', fn ($query) => $query->where('supplier_id', $filters['supplier_id']))
            ->when($filters['po_status'] !== '', fn ($query) => $query->where('status', $filters['po_status']))
            ->when($filters['search'] !== '', fn ($query) => $query->where('document_number', 'like', '%'.$filters['search'].'%'))
            ->when($filters['start_date'] !== '', fn ($query) => $query->whereDate('created_at', '>=', $filters['start_date']))
            ->when($filters['end_date'] !== '', fn ($query) => $query->whereDate('created_at', '<=', $filters['end_date']));
    }

    private function goodsReceivingsQuery(?int $outletId, array $filters)
    {
        return GoodsReceiving::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->when($filters['supplier_id'] !== '', fn ($query) => $query->where('supplier_id', $filters['supplier_id']))
            ->when($filters['search'] !== '', fn ($query) => $query->where('document_number', 'like', '%'.$filters['search'].'%'))
            ->when($filters['start_date'] !== '', fn ($query) => $query->whereDate('received_at', '>=', $filters['start_date']))
            ->when($filters['end_date'] !== '', fn ($query) => $query->whereDate('received_at', '<=', $filters['end_date']));
    }

    private function payablesQuery(?int $outletId, array $filters)
    {
        return Payable::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->when($filters['supplier_id'] !== '', fn ($query) => $query->where('supplier_id', $filters['supplier_id']))
            ->when($filters['payable_status'] !== '', fn ($query) => $query->where('status', $filters['payable_status']))
            ->when($filters['search'] !== '', fn ($query) => $query->where('document_number', 'like', '%'.$filters['search'].'%'))
            ->when($filters['start_date'] !== '', fn ($query) => $query->whereDate('created_at', '>=', $filters['start_date']))
            ->when($filters['end_date'] !== '', fn ($query) => $query->whereDate('created_at', '<=', $filters['end_date']));
    }

    private function supplierReturnsQuery(?int $outletId, array $filters)
    {
        return SupplierReturn::query()
            ->when($outletId, fn ($query) => $query->where('outlet_id', $outletId))
            ->when($filters['supplier_id'] !== '', fn ($query) => $query->where('supplier_id', $filters['supplier_id']))
            ->when($filters['return_status'] !== '', fn ($query) => $query->where('status', $filters['return_status']))
            ->when($filters['search'] !== '', fn ($query) => $query->where('document_number', 'like', '%'.$filters['search'].'%'))
            ->when($filters['start_date'] !== '', fn ($query) => $query->whereDate('created_at', '>=', $filters['start_date']))
            ->when($filters['end_date'] !== '', fn ($query) => $query->whereDate('created_at', '<=', $filters['end_date']));
    }
}
