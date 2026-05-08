<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KitchenStationDevice extends Model
{
    use HasFactory;

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
}
