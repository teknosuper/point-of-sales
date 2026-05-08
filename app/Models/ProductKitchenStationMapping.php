<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductKitchenStationMapping extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'kitchen_station_id',
        'priority',
        'fire_on_sale',
        'is_active',
    ];

    protected $casts = [
        'product_id' => 'integer',
        'kitchen_station_id' => 'integer',
        'priority' => 'integer',
        'fire_on_sale' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function kitchenStation()
    {
        return $this->belongsTo(KitchenStation::class);
    }
}
