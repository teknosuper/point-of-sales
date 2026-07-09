<?php

namespace App\Services;

use BaconQrCode\Renderer\Image\ImagickImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

class ReceiptLayoutService
{
    public function build(
        object $transaction,
        array $store = [],
        string $paperWidth = '58mm',
        ?string $receiptProfile = null
    ): array
    {
        $items = collect($transaction->details ?? []);
        $promoDiscount = (int) $items->sum(fn ($item) => (int) ($item->discount_total ?? 0));
        $voucherDiscount = (int) ($transaction->customer_voucher_discount ?? 0);
        $loyaltyDiscount = (int) ($transaction->loyalty_discount_total ?? 0);
        $manualDiscount = (int) ($transaction->discount ?? 0);
        $shippingCost = (int) ($transaction->shipping_cost ?? 0);
        $grandTotal = (int) ($transaction->grand_total ?? 0);
        $cash = (int) ($transaction->cash ?? 0);
        $change = (int) ($transaction->change ?? 0);
        $subtotal = $grandTotal + $manualDiscount - $shippingCost + $promoDiscount + $voucherDiscount + $loyaltyDiscount;
        $paymentMethodKey = strtolower((string) ($transaction->payment_method ?? 'cash'));
        $paymentMethodLabel = $this->paymentMethodLabel($paymentMethodKey);
        $paymentSummary = $this->paymentSummary($transaction, $paymentMethodKey);
        $paidAmount = $paymentMethodKey === 'cash' ? max($cash, $grandTotal) : max($cash, $grandTotal);
        $transactionNotes = $items
            ->pluck('notes')
            ->filter()
            ->map(fn ($note) => trim((string) $note))
            ->filter()
            ->unique()
            ->values()
            ->all();
        $feedbackUrl = $this->feedbackUrl($transaction);

        return [
            'paper_width' => $paperWidth,
            'receipt_profile' => $this->normalizeReceiptProfile($paperWidth, $receiptProfile),
            'store' => array_filter([
                'name' => $store['name'] ?? null,
                'address' => $store['address'] ?? null,
                'phone' => $store['phone'] ?? null,
                'email' => $store['email'] ?? null,
                'website' => $store['website'] ?? null,
            ]),
            'meta_rows' => array_values(array_filter([
                ['label' => 'No', 'value' => $transaction->invoice ?? '-'],
                ['label' => 'Tgl', 'value' => $transaction->created_at ? $this->formatReceiptDateTime($transaction->created_at, $paperWidth) : '-'],
                ['label' => 'Kasir', 'value' => $transaction->cashier->name ?? '-'],
                ['label' => 'Pelanggan', 'value' => $transaction->customer->name ?? 'Umum'],
                filled($transaction->order_reference_name ?? null) ? ['label' => 'Nama Order', 'value' => $transaction->order_reference_name] : null,
                filled($transaction->order_reference_notes ?? null) ? ['label' => 'Ket. Order', 'value' => $transaction->order_reference_notes] : null,
                ['label' => 'Pesanan', 'value' => ($transaction->order_type ?? 'take_away') === 'dine_in' ? 'Dine In' : 'Take Away'],
                $transaction->diningTable?->name ? ['label' => 'Meja', 'value' => $transaction->diningTable->code ?: $transaction->diningTable->name] : null,
                $transaction->waiter?->name ? ['label' => 'Waiter', 'value' => $transaction->waiter->name] : null,
            ])),
            'items' => $items->map(function ($item) {
                $qty = max(1, (int) ($item->qty ?? 1));
                $lineTotal = (int) ($item->price ?? 0);
                $modifierTotal = (int) collect($item->modifiers ?? [])->sum('total_price');
                $baseLineTotal = max(0, $lineTotal - $modifierTotal);
                $unitPrice = (int) ($item->unit_price ?: ($qty ? $baseLineTotal / $qty : $baseLineTotal));
                $baseUnitPrice = (int) ($item->base_unit_price ?: $unitPrice);

                $isReward = (bool) ($item->is_promo_reward ?? false) || ($unitPrice <= 0 && $baseUnitPrice > 0);

                return [
                    'name' => $item->product->title ?? 'Produk',
                    'promo' => $this->promoSummary($item, $qty, $baseUnitPrice, $unitPrice),
                    'qty' => $qty,
                    'unit_price_label' => $isReward ? 'Bonus' : $this->compactMoney($unitPrice),
                    'unit_note' => $isReward ? null : '@ '.$this->compactMoney($unitPrice).'/item',
                    'line_total_label' => $this->compactMoney($baseLineTotal),
                    'detail_left' => sprintf('%dx %s', $qty, $isReward ? 'Bonus' : $this->compactMoney($unitPrice)),
                    'detail_right' => $this->compactMoney($baseLineTotal),
                    'notes' => $this->normalizeOptionalText($item->notes ?? null),
                    'modifiers' => collect($item->modifiers ?? [])->map(fn ($modifier) => [
                        'label' => '+ '.$modifier->name,
                        'value' => $this->compactMoney((int) ($modifier->total_price ?? 0)),
                    ])->values()->all(),
                ];
            })->values()->all(),
            'totals' => array_values(array_filter([
                ['label' => 'Subtotal', 'value' => $this->compactMoney($subtotal)],
                $promoDiscount > 0 ? ['label' => 'Diskon', 'value' => $this->compactMoney($promoDiscount)] : null,
                $manualDiscount > 0 ? ['label' => 'Diskon Manual', 'value' => '-'.$this->compactMoney($manualDiscount)] : null,
                $voucherDiscount > 0 ? ['label' => 'Voucher', 'value' => '-'.$this->compactMoney($voucherDiscount)] : null,
                $loyaltyDiscount > 0 ? ['label' => 'Poin', 'value' => '-'.$this->compactMoney($loyaltyDiscount)] : null,
                $shippingCost > 0 ? ['label' => 'Ongkir', 'value' => $this->compactMoney($shippingCost)] : null,
                ['label' => 'Total', 'value' => $this->compactMoney($grandTotal), 'strong' => true],
            ])),
            'payments' => array_values(array_filter([
                ['label' => 'Metode', 'value' => $paymentMethodLabel],
                $paymentMethodKey === 'cash'
                    ? ['label' => 'Tunai', 'value' => $this->compactMoney($paidAmount)]
                    : ['label' => $paymentMethodLabel, 'value' => $this->compactMoney($paidAmount)],
                $change > 0 ? ['label' => 'Kembalian', 'value' => $this->compactMoney($change)] : null,
                $paymentSummary ? ['label' => 'Info', 'value' => $paymentSummary] : null,
            ])),
            'notes' => ! empty($transactionNotes) ? implode(', ', $transactionNotes) : null,
            'feedback' => [
                'url' => $feedbackUrl,
                'label' => 'SCAN QR UNTUK KRITIK & SARAN',
                'qr_url' => $this->feedbackQrUrl($feedbackUrl),
            ],
            'footer_lines' => [
                'Terima kasih!',
                '#'.($transaction->invoice ?? '-'),
            ],
        ];
    }

    public function buildEscPosPreview(array $layout): array
    {
        $cols = $this->receiptColumns($layout);
        $isCompact58 = $cols <= 32;
        $separator = str_repeat('-', $cols);
        $store = $layout['store'] ?? [];
        $metaRows = $layout['meta_rows'] ?? [];
        $items = $layout['items'] ?? [];
        $totals = $layout['totals'] ?? [];
        $payments = $layout['payments'] ?? [];
        $footerLines = $layout['footer_lines'] ?? [];
        $lines = [];

        if (! empty($store['name'])) {
            $lines = array_merge($lines, $this->centerWrappedText((string) $store['name'], $cols));
        }

        $storeFields = $isCompact58
            ? ['address', 'phone', 'email', 'website']
            : ['address', 'phone', 'email', 'website'];

        foreach ($storeFields as $field) {
            if (! empty($store[$field])) {
                $lines = array_merge($lines, $this->centerWrappedText((string) $store[$field], $cols));
            }
        }

        $lines[] = $separator;

        foreach ($metaRows as $row) {
            $lines = array_merge(
                $lines,
                $this->receiptMetaLines(
                    (string) ($row['label'] ?? ''),
                    (string) ($row['value'] ?? ''),
                    $cols
                )
            );
        }

        if (! empty($layout['notes'])) {
            $lines = array_merge($lines, $this->wrapText('Catatan: '.(string) $layout['notes'], $cols));
        }

        $lines[] = $separator;
        $lines[] = $this->receiptItemsHeaderLine($cols);

        foreach ($items as $item) {
            $lines = array_merge($lines, $this->receiptItemPrimaryLines($item, $cols));

            if (! empty($item['promo'])) {
                $lines = array_merge($lines, $this->wrapWithPrefix((string) $item['promo'], $cols, '    '));
            }

            if (! empty($item['unit_note'])) {
                $lines = array_merge($lines, $this->wrapWithPrefix((string) $item['unit_note'], $cols, '    '));
            }

            foreach (($item['modifiers'] ?? []) as $modifier) {
                $lines = array_merge($lines, $this->twoColumnLines((string) ($modifier['label'] ?? ''), (string) ($modifier['value'] ?? ''), $cols));
            }

            if (! empty($item['notes'])) {
                $lines = array_merge($lines, $this->wrapText('* '.(string) $item['notes'], $cols));
            }
        }

        $lines[] = $separator;

        foreach ($totals as $row) {
            $lines = array_merge($lines, $this->twoColumnLines((string) ($row['label'] ?? ''), (string) ($row['value'] ?? ''), $cols));
        }

        $lines[] = $separator;

        foreach ($payments as $row) {
            if (($row['label'] ?? '') === 'Info') {
                $lines = array_merge($lines, $this->wrapWithPrefix((string) ($row['value'] ?? ''), $cols, '  '));
                continue;
            }

            $lines = array_merge($lines, $this->twoColumnLines((string) ($row['label'] ?? ''), (string) ($row['value'] ?? ''), $cols));
        }

        $lines[] = $separator;

        foreach ($footerLines as $footerLine) {
            if (! empty($footerLine)) {
                $lines = array_merge($lines, $this->centerWrappedText((string) $footerLine, $cols));
            }
        }

        if (! empty($layout['feedback']['label'])) {
            $lines[] = '';
            $lines[] = '';
            $lines = array_merge($lines, $this->centerWrappedText((string) $layout['feedback']['label'], $cols));
        }

        return [
            'paper_width' => $layout['paper_width'] ?? '58mm',
            'receipt_profile' => $layout['receipt_profile'] ?? null,
            'cols' => $cols,
            'lines' => $lines,
        ];
    }

    public function encodeEscPosPayload(array $layout): string
    {
        $preview = $this->buildEscPosPreview($layout);
        $cols = (int) ($preview['cols'] ?? 32);
        $isCompact58 = $cols <= 32;
        $chunks = ["\x1B\x40", "\x1B\x61\x00"];

        $chunks[] = $isCompact58 ? "\x1B\x4D\x01" : "\x1B\x4D\x00";

        foreach (($preview['lines'] ?? []) as $line) {
            $this->appendEncodedLine($chunks, (string) $line);
        }

        if (! empty($layout['feedback']['url'])) {
            $chunks[] = "\x1B\x61\x01";
            foreach ($this->buildEscPosBitImageQrCode(
                (string) $layout['feedback']['url'],
                (string) ($layout['paper_width'] ?? '58mm')
            ) as $byteChunk) {
                $chunks[] = $byteChunk;
            }
            $chunks[] = "\x1B\x61\x00";
        }

        $chunks[] = "\n\n\n";
        $chunks[] = "\x1D\x56\x00";

        return base64_encode(implode('', $chunks));
    }

    private function paymentMethodLabel(string $key): string
    {
        return match ($key) {
            'cash' => 'Tunai',
            'bank_transfer' => 'Transfer Bank',
            'midtrans' => 'Midtrans',
            'xendit' => 'Xendit',
            'pay_later' => 'Piutang',
            default => strtoupper(str_replace('_', ' ', $key)),
        };
    }

    private function paymentSummary(object $transaction, string $methodKey): ?string
    {
        return match ($methodKey) {
            'bank_transfer' => trim(implode(' / ', array_filter([
                $transaction->bankAccount->bank_name ?? null,
                $transaction->bankAccount->account_number ?? null,
            ]))),
            'midtrans', 'xendit' => $transaction->payment_reference ?? null,
            'pay_later' => 'Pembayaran dicatat sebagai piutang',
            default => null,
        };
    }

    private function promoSummary(object $item, int $qty, int $baseUnitPrice, int $unitPrice): ?string
    {
        if ((bool) ($item->is_promo_reward ?? false)) {
            return implode(' - ', array_filter([
                'Bonus Gratis '.max(1, $qty).'x',
                $item->promo_reward_rule_name ?? null,
            ]));
        }

        if ((int) ($item->discount_total ?? 0) <= 0) {
            return null;
        }

        $kindLabel = match ($item->pricing_rule_kind) {
            'standard_discount' => 'Harga Spesial',
            'qty_break' => 'Belanja Lebih Untung',
            'bundle_price' => 'Paket Hemat',
            'buy_x_get_y' => 'Promo Buy Get',
            default => 'Promo Spesial',
        };

        $headline = match ($item->pricing_rule_kind) {
            'qty_break' => 'Beli '.$qty.'+ lebih hemat',
            'bundle_price' => 'Ambil paket, harga lebih hemat',
            'buy_x_get_y' => null,
            default => null,
        };

        if ($item->pricing_rule_kind === 'buy_x_get_y') {
            $name = $item->pricing_group_label ?: $item->pricing_rule_name;

            return 'Promo: '.$name;
        }

        $parts = array_filter([
            $kindLabel,
            $headline,
            $item->pricing_group_label ?: $item->pricing_rule_name,
            $baseUnitPrice > $unitPrice ? $this->compactMoney($baseUnitPrice).' -> '.$this->compactMoney($unitPrice) : null,
        ]);

        return implode(' - ', $parts);
    }

    private function feedbackUrl(object $transaction): string
    {
        return route('feedback.transactions.show', ['invoice' => $transaction->invoice], true);
    }

    private function feedbackQrUrl(string $url): string
    {
        return 'https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=4&data='.urlencode($url);
    }

    private function buildEscPosBitImageQrCode(string $url, string $paperWidth = '58mm'): array
    {
        $pngData = $this->generateQrPng($url, $paperWidth);
        $image = imagecreatefromstring($pngData);

        if ($image === false) {
            return [];
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $widthBytes = (int) ceil($width / 8);
        $stripeHeight = 24;
        $chunks = ["\n"];

        for ($y = 0; $y < $height; $y += $stripeHeight) {
            $chunks[] = "\x1B\x2A\x21".chr($widthBytes % 256).chr(intdiv($widthBytes, 256));

            for ($xb = 0; $xb < $widthBytes; $xb++) {
                for ($slice = 0; $slice < 3; $slice++) {
                    $byte = 0;

                    for ($bit = 0; $bit < 8; $bit++) {
                        $x = $xb * 8 + $bit;
                        $yy = $y + ($slice * 8) + $bit;

                        if ($x >= $width || $yy >= $height) {
                            continue;
                        }

                        $colorIndex = imagecolorat($image, $x, $yy);
                        $rgba = imagecolorsforindex($image, $colorIndex);
                        $luminance = ($rgba['red'] * 0.299) + ($rgba['green'] * 0.587) + ($rgba['blue'] * 0.114);

                        if ($rgba['alpha'] < 127 && $luminance < 220) {
                            $byte |= (0x80 >> $bit);
                        }
                    }

                    $chunks[] = chr($byte);
                }
            }

            $chunks[] = "\n";
        }

        imagedestroy($image);

        return [...$chunks, "\n"];
    }

    private function generateQrPng(string $url, string $paperWidth = '58mm'): string
    {
        $size = $paperWidth === '80mm' ? 384 : 256;
        $renderer = new ImageRenderer(
            new RendererStyle($size, 4),
            new ImagickImageBackEnd('png', 100)
        );

        return (new Writer($renderer))->writeString($url);
    }

    private function compactMoney(int $value): string
    {
        return number_format($value, 0, ',', '.');
    }

    private function appendEncodedLine(array &$chunks, string $text = ''): void
    {
        $chunks[] = $this->sanitizeReceiptLine($text)."\n";
    }

    private function formatReceiptDateTime(mixed $value, string $paperWidth): string
    {
        $date = \App\Support\ReportTimezone::sourceToDisplayCarbon($value);

        return $paperWidth === '58mm'
            ? $date->format('d/m/y H:i')
            : $date->format('d/m/Y H:i');
    }

    private function normalizeOptionalText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        if ($text === '' || in_array(strtolower($text), ['null', 'undefined', '-'], true)) {
            return null;
        }

        return $text;
    }

    private function wrapWithPrefix(string $text, int $width, string $prefix = ''): array
    {
        return array_map(
            fn ($line) => $prefix.$line,
            $this->wrapText($text, max(1, $width - strlen($prefix)))
        );
    }

    private function centerWrappedText(string $text, int $width): array
    {
        return array_map(
            fn ($line) => $this->centerText($line, $width),
            $this->wrapText($text, $width)
        );
    }

    private function wrapText(string $text, int $width): array
    {
        $text = $this->sanitizeReceiptContent($text);
        if ($text === '') {
            return [];
        }

        $words = preg_split('/\s+/', $text) ?: [];
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            if ($word === '') {
                continue;
            }

            if (strlen($word) > $width) {
                if ($current !== '') {
                    $lines[] = $current;
                    $current = '';
                }

                foreach (str_split($word, $width) as $segment) {
                    $lines[] = $segment;
                }

                continue;
            }

            $candidate = $current === '' ? $word : $current.' '.$word;
            if (strlen($candidate) <= $width) {
                $current = $candidate;
                continue;
            }

            $lines[] = $current;
            $current = $word;
        }

        if ($current !== '') {
            $lines[] = $current;
        }

        return $lines;
    }

    private function twoColumnLines(string $left, string $right, int $cols): array
    {
        $left = $this->sanitizeReceiptContent($left);
        $right = $this->sanitizeReceiptContent($right);

        if ($left === '' && $right === '') {
            return [''];
        }

        $rightWidth = $cols <= 32
            ? max(7, min((int) floor($cols * 0.30), $cols - 10))
            : max(8, min((int) floor($cols * 0.42), $cols - 8));
        $leftWidth = max(1, $cols - $rightWidth - 1);
        $leftLines = $this->wrapText($left, $leftWidth);
        $rightLines = $this->wrapText($right, $rightWidth);
        $count = max(count($leftLines), count($rightLines), 1);
        $lines = [];

        for ($i = 0; $i < $count; $i++) {
            $leftPart = $leftLines[$i] ?? '';
            $rightPart = $rightLines[$i] ?? '';
            $space = max(1, $cols - strlen($leftPart) - strlen($rightPart));
            $lines[] = $leftPart.str_repeat(' ', $space).$rightPart;
        }

        return $lines;
    }

    private function receiptItemsHeaderLine(int $cols): string
    {
        [$qtyWidth, $nameWidth, $totalWidth] = $this->receiptItemColumnWidths($cols);

        return str_pad('Qty', $qtyWidth)
            .' '
            .$this->centerText('Item', $nameWidth)
            .' '
            .str_pad('Total', $totalWidth, ' ', STR_PAD_LEFT);
    }

    private function receiptColumns(array $layout): int
    {
        $paperWidth = (string) ($layout['paper_width'] ?? '58mm');
        $profile = $this->normalizeReceiptProfile($paperWidth, $layout['receipt_profile'] ?? null);

        return match ($profile) {
            '58_small' => 32,
            '58_standard' => 32,
            default => 48,
        };
    }

    private function normalizeReceiptProfile(string $paperWidth, ?string $receiptProfile): string
    {
        $profile = trim((string) $receiptProfile);

        if ($profile !== '') {
            return $profile;
        }

        return $paperWidth === '58mm' ? '58_small' : '80_standard';
    }

    private function receiptItemPrimaryLines(array $item, int $cols): array
    {
        $qty = (string) ($item['qty'] ?? '1x');
        $name = (string) ($item['name'] ?? 'Item');
        $total = (string) ($item['line_total_label'] ?? $item['detail_right'] ?? '0');
        [$qtyWidth, $nameWidth, $totalWidth] = $this->receiptItemColumnWidths($cols);
        $nameLines = $this->wrapText($name, $nameWidth);
        $lines = [];

        foreach ($nameLines as $index => $nameLine) {
            $leftPrefix = $index === 0 ? str_pad(substr($qty, 0, $qtyWidth), $qtyWidth) : str_repeat(' ', $qtyWidth);
            $rightValue = $index === 0 ? $total : '';
            $lines[] = $leftPrefix
                .' '
                .str_pad(substr($nameLine, 0, $nameWidth), $nameWidth)
                .' '
                .str_pad(substr($rightValue, 0, $totalWidth), $totalWidth, ' ', STR_PAD_LEFT);
        }

        return $lines;
    }

    private function receiptItemColumnWidths(int $cols): array
    {
        $qtyWidth = $cols >= 48 ? 4 : 3;
        $totalWidth = $cols >= 48 ? 12 : 9;
        $nameWidth = max(1, $cols - $qtyWidth - $totalWidth - 2);

        return [$qtyWidth, $nameWidth, $totalWidth];
    }

    private function centerText(string $text, int $width): string
    {
        $text = substr($text, 0, max(0, $width));
        $padding = max(0, $width - strlen($text));
        $left = intdiv($padding, 2);
        $right = $padding - $left;

        return str_repeat(' ', $left).$text.str_repeat(' ', $right);
    }

    private function receiptMetaLines(string $label, string $value, int $cols): array
    {
        if ($cols >= 48) {
            return $this->twoColumnLines($label.' :', $value, $cols);
        }

        $label = $this->sanitizeReceiptContent($label);
        $value = $this->sanitizeReceiptContent($value);

        if ($label === '') {
            return $this->wrapText($value, $cols);
        }

        if ($value === '') {
            return $this->wrapText($label, $cols);
        }

        $prefix = $label.' : ';
        $prefixWidth = strlen($prefix);

        if ($prefixWidth < $cols) {
            $wrappedValues = $this->wrapText($value, max(1, $cols - $prefixWidth));

            if (! empty($wrappedValues)) {
                $lines = [];

                foreach ($wrappedValues as $index => $line) {
                    $lines[] = $index === 0
                        ? $prefix.$line
                        : str_repeat(' ', $prefixWidth).$line;
                }

                return $lines;
            }
        }

        return $this->wrapText($prefix.$value, $cols);
    }

    private function sanitizeReceiptLine(string $text): string
    {
        $text = preg_replace('/[\x00-\x08\x0B-\x1F\x7F]/u', ' ', $text) ?? $text;

        return rtrim($text);
    }

    private function sanitizeReceiptContent(string $text): string
    {
        $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $text) ?? $text;
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return trim($text);
    }
}
