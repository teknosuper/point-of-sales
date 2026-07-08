<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KitchenStationDevice extends Model
{
    use HasFactory;

    public const PRINT_PROFILE_BROWSER = 'browser_manual';
    public const PRINT_PROFILE_RAWBT = 'rawbt_android';
    public const PRINT_PROFILE_QZ_TRAY = 'qz_tray';
    public const PRINT_PROFILE_BRIDGE = 'local_bridge';
    public const RECEIPT_PROFILE_58_SMALL = '58_small';
    public const RECEIPT_PROFILE_58_STANDARD = '58_standard';
    public const RECEIPT_PROFILE_80_STANDARD = '80_standard';

    protected $fillable = [
        'kitchen_station_id',
        'name',
        'device_type',
        'connection_driver',
        'endpoint',
        'is_primary',
        'is_active',
        'meta',
    ];

    protected $casts = [
        'kitchen_station_id' => 'integer',
        'is_primary' => 'boolean',
        'is_active' => 'boolean',
        'meta' => 'array',
    ];

    public function kitchenStation()
    {
        return $this->belongsTo(KitchenStation::class);
    }

    public function printJobs()
    {
        return $this->hasMany(PrintJob::class, 'kitchen_station_device_id');
    }

    public static function printProfiles(): array
    {
        return [
            self::PRINT_PROFILE_BROWSER => 'Browser Manual',
            self::PRINT_PROFILE_RAWBT => 'Android RawBT',
            self::PRINT_PROFILE_QZ_TRAY => 'QZ Tray Desktop',
            self::PRINT_PROFILE_BRIDGE => 'Local Print Bridge',
        ];
    }

    public static function receiptProfiles(): array
    {
        return [
            self::RECEIPT_PROFILE_58_SMALL => '58mm Kecil',
            self::RECEIPT_PROFILE_58_STANDARD => '58mm Standard',
            self::RECEIPT_PROFILE_80_STANDARD => '80mm Standard',
        ];
    }
}
