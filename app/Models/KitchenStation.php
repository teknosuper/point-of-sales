<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KitchenStation extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'outlet_id',
        'name',
        'slug',
        'code',
        'station_type',
        'display_mode',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function devices()
    {
        return $this->hasMany(KitchenStationDevice::class);
    }

    public function outlet()
    {
        return $this->belongsTo(Outlet::class);
    }

    public function productMappings()
    {
        return $this->hasMany(ProductKitchenStationMapping::class);
    }

    public function kitchenTickets()
    {
        return $this->hasMany(KitchenTicket::class);
    }
}
