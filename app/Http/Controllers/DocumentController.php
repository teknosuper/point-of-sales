<?php

namespace App\Http\Controllers;

use App\Models\Outlet;
use App\Models\Payable;
use App\Models\Receivable;
use App\Models\Category;
use App\Models\Transaction;
use App\Services\OutletResolver;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Picqer\Barcode\BarcodeGeneratorPNG;

class DocumentController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    private function ensureFontDirectory(): void
    {
        $fontDir = storage_path('fonts');
        if (! is_dir($fontDir)) {
            @mkdir($fontDir, 0755, true);
        }
    }

    private function storeProfile(?Outlet $outlet = null): array
    {
        $profile = $outlet?->profilePayload() ?? $this->outletResolver->profilePayload();
        $logo = $profile['logo'] ?? null;

        $logoData = null;
        if ($logo) {
            $localPath = null;
            if (str_starts_with($logo, asset('storage'))) {
                $localPath = public_path(str_replace(asset(''), '', $logo));
            } elseif (str_starts_with($logo, '/storage')) {
                $localPath = public_path($logo);
            }

            if ($localPath && file_exists($localPath)) {
                $logoData = 'data:image/png;base64,'.base64_encode(file_get_contents($localPath));
            }
        }

        return [
            'name' => $profile['name'] ?? 'POINZA',
            'logo' => $logo,
            'logo_data' => $logoData,
            'address' => $profile['address'] ?? '',
            'phone' => $profile['phone'] ?? '',
            'email' => $profile['email'] ?? '',
            'website' => $profile['website'] ?? '',
        ];
    }

    private function barcode(string $code): string
    {
        $generator = new BarcodeGeneratorPNG;
        $data = $generator->getBarcode($code, $generator::TYPE_CODE_128);

        return 'data:image/png;base64,'.base64_encode($data);
    }

    private function ensureUserCanAccessOutlet(Request $request, ?int $outletId): void
    {
        $user = $request->user();

        if (! $user || $user->isSuperAdmin() || ! $outletId) {
            return;
        }

        abort_unless($user->hasAccessToOutlet($outletId), 403);
    }

    public function invoice(Request $request, string $invoice)
    {
        $this->ensureFontDirectory();

        $transaction = Transaction::with(['details.product', 'details.modifiers', 'cashier', 'waiter', 'diningTable', 'customer', 'outlet'])
            ->where('invoice', $invoice)
            ->firstOrFail();
        $this->ensureUserCanAccessOutlet($request, $transaction->outlet_id);

        $pdf = Pdf::loadView('pdf.invoice', [
            'transaction' => $transaction,
            'store' => $this->storeProfile($transaction->outlet),
            'barcode' => $this->barcode($transaction->invoice),
        ])->setPaper('a4');

        return $pdf->stream("invoice-{$transaction->invoice}.pdf");
    }

    /**
     * Public version of invoice (no auth needed).
     */
    public function publicInvoice(Request $request, string $invoice)
    {
        return $this->invoice($request, $invoice);
    }

    public function receipt(Request $request, string $invoice, string $size = '80')
    {
        $this->ensureFontDirectory();

        $transaction = Transaction::with([
            'details.product',
            'details.modifiers',
            'details.pricingRule',
            'cashier',
            'waiter',
            'diningTable',
            'customer',
            'bankAccount',
            'outlet',
        ])
            ->where('invoice', $invoice)
            ->firstOrFail();
        $this->ensureUserCanAccessOutlet($request, $transaction->outlet_id);

        $template = $size === '58' ? 'pdf.receipt_58' : 'pdf.receipt_80';
        $width = $size === '58' ? 164.4 : 226.8; // points (mm*2.8346)
        $pdf = Pdf::loadView($template, [
            'transaction' => $transaction,
            'store' => $this->storeProfile($transaction->outlet),
            'barcode' => $this->barcode($transaction->invoice),
        ])->setPaper([0, 0, $width, 800], 'portrait');

        return $pdf->stream("receipt-{$transaction->invoice}-{$size}.pdf");
    }

    public function shipping(Request $request, string $invoice)
    {
        $this->ensureFontDirectory();

        $transaction = Transaction::with(['details.product', 'details.modifiers', 'customer', 'cashier', 'waiter', 'diningTable', 'outlet'])
            ->where('invoice', $invoice)
            ->firstOrFail();
        $this->ensureUserCanAccessOutlet($request, $transaction->outlet_id);

        $pdf = Pdf::loadView('pdf.shipping_label', [
            'transaction' => $transaction,
            'store' => $this->storeProfile($transaction->outlet),
            'barcode' => $this->barcode($transaction->invoice),
        ]);

        // Set kertas 150mm x 100mm (dalam Points: 1mm = 2.83465pt)
        // 150mm = 425pt, 100mm = 283pt
        $pdf->setPaper([0, 0, 425, 283], 'landscape');

        return $pdf->stream("shipping-{$transaction->invoice}.pdf");
    }

    public function menuBook(Request $request)
    {
        $this->ensureFontDirectory();

        $outlet = $this->outletResolver->resolve($request, $request->user());

        $categories = Category::query()
            ->with([
                'products' => function ($query) {
                    $query
                        ->with([
                            'tenantOutlet:id,name,code',
                            'modifierOptions' => fn ($modifierQuery) => $modifierQuery
                                ->where('is_active', true)
                                ->orderBy('sort_order')
                                ->orderBy('name'),
                        ])
                        ->orderBy('tenant_outlet_id')
                        ->orderBy('title');
                },
            ])
            ->whereHas('products')
            ->orderBy('name')
            ->get();

        $pdf = Pdf::loadView('pdf.menu_book', [
            'store' => $this->storeProfile($outlet),
            'generatedAt' => now(),
            'categories' => $categories,
        ])->setPaper('a4');

        return $pdf->stream('buku-menu.pdf');
    }

    public function receivable(Request $request, Receivable $receivable)
    {
        $this->ensureFontDirectory();
        $this->ensureUserCanAccessOutlet($request, $receivable->outlet_id);

        $receivable->load(['customer', 'payments.bankAccount', 'payments.user', 'outlet']);

        $pdf = Pdf::loadView('pdf.receivable', [
            'receivable' => $receivable,
            'store' => $this->storeProfile($receivable->outlet),
            'barcode' => $this->barcode($receivable->invoice),
        ])->setPaper('a5', 'portrait');

        return $pdf->stream("piutang-{$receivable->invoice}.pdf");
    }

    public function payable(Request $request, Payable $payable)
    {
        $this->ensureFontDirectory();
        $this->ensureUserCanAccessOutlet($request, $payable->outlet_id);

        $payable->load(['supplier', 'payments.bankAccount', 'payments.user', 'outlet']);

        $pdf = Pdf::loadView('pdf.payable', [
            'payable' => $payable,
            'store' => $this->storeProfile($payable->outlet),
            'barcode' => $this->barcode($payable->document_number),
        ])->setPaper('a5', 'portrait');

        return $pdf->stream("hutang-{$payable->document_number}.pdf");
    }
}
