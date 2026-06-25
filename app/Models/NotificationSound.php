<?php

namespace App\Models;

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
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'file_size' => 'integer',
        'sort_order' => 'integer',
    ];

    // Sound types
    const TYPE_NEW_ORDER = 'new_order';
    const TYPE_GENERAL = 'general';
    const TYPE_ERROR = 'error';
    const TYPE_REMINDER = 'reminder';

    public static function getTypes(): array
    {
        return [
            self::TYPE_NEW_ORDER => 'Pesanan Baru',
            self::TYPE_GENERAL => 'Umum',
            self::TYPE_ERROR => 'Error',
            self::TYPE_REMINDER => 'Pengingat',
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
