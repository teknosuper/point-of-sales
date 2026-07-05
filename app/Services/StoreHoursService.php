<?php

namespace App\Services;

use App\Models\CashierShift;
use App\Models\Outlet;
use App\Models\Setting;
use Carbon\Carbon;

/**
 * StoreHoursService — helper terpusat untuk status buka/tutup toko.
 *
 * Dipakai oleh:
 * - PublicMenuController (daftar menu publik /daftarmenu)
 * - PublicTableOrderController (self-order meja pelanggan)
 * - TransactionController (POS dashboard)
 *
 * Menghindari discrepancy data antar halaman.
 */
class StoreHoursService
{
    /**
     * Resolve status jam operasional toko untuk outlet tertentu.
     *
     * @return array{
     *   is_permanently_closed: bool,
     *   is_open: bool,
     *   has_active_shift: bool,
     *   open_time: string,
     *   close_time: string,
     *   notes: string,
     *   current_time: string,
     *   minutes_until_open: int|null,
     *   next_open_label: string|null,
     * }
     */
    public function resolve(?Outlet $outlet): array
    {
        $outletId = $outlet?->id;
        $isPermanentlyClosed = $outlet ? ! (bool) $outlet->is_active : false;
        $isManuallyOpen = Setting::getBool('daily_store_open', true, $outletId);

        $hasActiveShift = CashierShift::query()
            ->where('status', CashierShift::STATUS_OPEN)
            ->when($outletId, fn ($q) => $q->where('outlet_id', $outletId))
            ->exists();

        $openTime = (string) Setting::get('daily_store_open_time', '08:00', $outletId);
        $closeTime = (string) Setting::get('daily_store_close_time', '22:00', $outletId);
        $notes = (string) Setting::get('daily_store_notes', '', $outletId);

        $now = Carbon::now();
        $currentTime = $now->format('H:i');

        // Hitung countdown ke jam buka jika toko tutup karena flag is_open=false atau shift belum buka
        $minutesUntilOpen = null;
        $nextOpenLabel = null;

        if (! $isPermanentlyClosed && (! $isManuallyOpen || ! $hasActiveShift) && $openTime) {
            try {
                $openCarbon = Carbon::createFromFormat('H:i', $openTime);
                if ($openCarbon !== false) {
                    // Set ke hari ini
                    $openCarbon->setDate($now->year, $now->month, $now->day);

                    // Jika jam buka sudah lewat hari ini, set ke besok
                    if ($now->greaterThanOrEqualTo($openCarbon)) {
                        $openCarbon->addDay();
                    }

                    $diffMinutes = (int) $now->diffInMinutes($openCarbon);
                    $minutesUntilOpen = $diffMinutes;

                    if ($diffMinutes < 60) {
                        $nextOpenLabel = "{$diffMinutes} menit lagi";
                    } elseif ($diffMinutes < 1440) { // kurang dari 1 hari
                        $hours = intdiv($diffMinutes, 60);
                        $mins = $diffMinutes % 60;
                        $nextOpenLabel = $mins > 0
                            ? "{$hours} jam {$mins} menit lagi"
                            : "{$hours} jam lagi";
                    } else {
                        $nextOpenLabel = "Besok pukul {$openTime}";
                    }
                }
            } catch (\Throwable) {
                // Abaikan error parsing jam
            }
        }

        return [
            'is_permanently_closed' => $isPermanentlyClosed,
            'is_open' => $isManuallyOpen,
            'has_active_shift' => $hasActiveShift,
            'open_time' => $openTime,
            'close_time' => $closeTime,
            'notes' => $notes,
            'current_time' => $currentTime,
            'minutes_until_open' => $minutesUntilOpen,
            'next_open_label' => $nextOpenLabel,
        ];
    }

    /**
     * Resolve untuk POS (TransactionController).
     * Return format yang kompatibel dengan `operationalSettings` yang sudah dipakai frontend POS.
     */
    public function resolveForPos(?Outlet $outlet): array
    {
        $base = $this->resolve($outlet);

        return [
            'outlet_is_active' => ! $base['is_permanently_closed'],
            'is_open' => $base['is_open'],
            'has_active_shift' => $base['has_active_shift'],
            'open_time' => $base['open_time'],
            'close_time' => $base['close_time'],
            'notes' => $base['notes'],
            'current_time' => $base['current_time'],
            'minutes_until_open' => $base['minutes_until_open'],
            'next_open_label' => $base['next_open_label'],
        ];
    }
}
