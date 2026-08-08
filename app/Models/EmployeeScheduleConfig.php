<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeScheduleConfig extends Model
{
    protected $fillable = [
        'day_off_per_week',
        'blocked_weekdays',
        'max_night_per_week',
        'night_after_off',
        'priority_shift_id',
    ];

    protected $casts = [
        'day_off_per_week' => 'integer',
        'blocked_weekdays' => 'array',
        'max_night_per_week' => 'integer',
        'night_after_off' => 'boolean',
        'priority_shift_id' => 'integer',
    ];

    /**
     * Ambil konfigurasi jadwal (single row). Dibuat otomatis bila belum ada.
     */
    public static function rule(): self
    {
        return static::query()->first() ?? static::query()->create([
            'day_off_per_week' => 1,
            'blocked_weekdays' => [5, 6, 7],
            'max_night_per_week' => 3,
            'night_after_off' => true,
            'priority_shift_id' => null,
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
