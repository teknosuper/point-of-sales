<?php

namespace App\Models;

use App\Models\Outlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationSound extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type',
        'file_path',
        'original_name',
        'file_size',
        'is_active',
        'sort_order',
        'outlet_id',
        'station_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'file_size' => 'integer',
        'sort_order' => 'integer',
    ];

    public function outlet()
    {
        return $this->belongsTo(Outlet::class);
    }

    public function station()
    {
        return $this->belongsTo(KitchenStation::class, 'station_id');
    }

    // Sound types
    const TYPE_NEW_ORDER = 'new_order';
    const TYPE_GENERAL = 'general';
    const TYPE_ERROR = 'error';
    const TYPE_REMINDER = 'reminder';
    const TYPE_PRINT_PENDING = 'print_pending';
    const TYPE_PRINT_FAILED = 'print_failed';
    const TYPE_PRINT_SUCCESS = 'print_success';

    public static function getTypes(): array
    {
        return [
            self::TYPE_NEW_ORDER => 'Pesanan Baru',
            self::TYPE_GENERAL => 'Umum',
            self::TYPE_ERROR => 'Error',
            self::TYPE_REMINDER => 'Pengingat',
            self::TYPE_PRINT_PENDING => 'Cetak Tertunda',
            self::TYPE_PRINT_FAILED => 'Cetak Gagal',
            self::TYPE_PRINT_SUCCESS => 'Cetak Berhasil',
        ];
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeForStation($query, int $stationId)
    {
        return $query->where('station_id', $stationId);
    }

    public function scopeForOutlet($query, int $outletId)
    {
        return $query->where('outlet_id', $outletId);
    }

    public function scopeGlobal($query)
    {
        return $query->whereNull('station_id')->whereNull('outlet_id');
    }

    public function getUrlAttribute(): string
    {
        return '/storage/' . $this->file_path;
    }

    public function getFileSizeHumanAttribute(): string
    {
        if (!$this->file_size) {
            return '-';
        }

        $bytes = $this->file_size;
        if ($bytes < 1024) {
            return $bytes . ' B';
        }
        if ($bytes < 1024 * 1024) {
            return round($bytes / 1024, 1) . ' KB';
        }

        return round($bytes / (1024 * 1024), 1) . ' MB';
    }
}
