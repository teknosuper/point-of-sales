<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductModifierOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'name',
        'price',
        'is_active',
        'is_required',
        'sort_order',
    ];

    protected $casts = [
        'product_id' => 'integer',
        'price' => 'integer',
        'is_active' => 'boolean',
        'is_required' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
