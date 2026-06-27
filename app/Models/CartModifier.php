<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CartModifier extends Model
{
    use HasFactory;

    protected $fillable = [
        'cart_id',
        'name',
        'qty',
        'unit_price',
        'base_price',
        'markup_price',
        'total_price',
    ];

    protected $casts = [
        'cart_id' => 'integer',
        'qty' => 'integer',
        'unit_price' => 'integer',
        'base_price' => 'integer',
        'markup_price' => 'integer',
        'total_price' => 'integer',
    ];

    public function cart()
    {
        return $this->belongsTo(Cart::class);
    }
}
