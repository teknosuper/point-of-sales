<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeScheduleConfig extends Model
{
    protected $fillable = ['day_off_per_week', 'blocked_weekdays'];

    protected $casts = [
        'day_off_per_week' => 'integer',
        'blocked_weekdays' => 'array',
    ];

    /**
     * Ambil konfigurasi jadwal (single row). Dibuat otomatis bila belum ada.
     */
    public static function rule(): self
    {
        return static::query()->first() ?? static::query()->create([
            'day_off_per_week' => 1,
            'blocked_weekdays' => [5, 6, 7],
        ]);
    }

    /**
     * Nomor hari (Carbon dayOfWeek, 1=Senin .. 7=Minggu) yang dilarang untuk libur.
     */
    public function blockedDays(): array
    {
        $days = array_values(array_map('intval', (array) $this->blocked_weekdays));

        return $days ?: [];
    }
}
