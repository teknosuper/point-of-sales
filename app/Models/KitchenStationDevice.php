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
}
