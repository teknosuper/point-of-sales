<?php

namespace App\Services;

use App\Models\Transaction;
use Illuminate\Support\Facades\Cache;

class TransactionInvoiceService
{
    public function generate(?\DateTimeInterface $issuedAt = null): string
    {
        $issuedAt ??= now();

        $prefix = 'TRX-'.$issuedAt->format('dmy');
        $lockKey = 'transaction-invoice:'.$prefix;
        $nextInvoice = null;

        try {
            $lock = Cache::lock($lockKey, 10);
            $nextInvoice = $lock->block(5, function () use ($prefix) {
                return $this->nextInvoiceForPrefix($prefix);
            });
        } catch (\Throwable) {
            $nextInvoice = $this->nextInvoiceForPrefix($prefix);
        }

        return $nextInvoice;
    }

    private function nextInvoiceForPrefix(string $prefix): string
    {
        $latestInvoice = Transaction::query()
            ->where('invoice', 'like', $prefix.'-%')
            ->orderByDesc('id')
            ->value('invoice');

        $lastSequence = 0;

        if (
            is_string($latestInvoice) &&
            preg_match('/^'.preg_quote($prefix, '/').'-(\d+)$/', $latestInvoice, $matches)
        ) {
            $lastSequence = (int) ($matches[1] ?? 0);
        }

        $nextSequence = $lastSequence + 1;

        return sprintf('%s-%s', $prefix, str_pad((string) $nextSequence, 4, '0', STR_PAD_LEFT));
    }
}
