<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KitchenSoundConfig extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_type',
        'interval_seconds',
        'is_enabled',
    ];

    protected $casts = [
        'interval_seconds' => 'integer',
        'is_enabled' => 'boolean',
    ];

    const EVENT_PRINT_FAILED = 'print_failed';
    const EVENT_PRINT_PENDING = 'print_pending';
    const EVENT_PRINT_REMINDER = 'print_reminder';

    public static function getEventLabels(): array
    {
        return [
            self::EVENT_PRINT_FAILED => 'Cetak Gagal',
            self::EVENT_PRINT_PENDING => 'Cetak Tertunda',
            self::EVENT_PRINT_REMINDER => 'Pengingat (Printed)',
        ];
    }

    public function scopeEnabled($query)
    {
        return $query->where('is_enabled', true)->where('interval_seconds', '>', 0);
    }
}
