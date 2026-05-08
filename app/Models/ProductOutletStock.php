<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductOutletStock extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'outlet_id',
        'product_id',
        'stock',
        'reorder_level',
        'last_counted_at',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'product_id' => 'integer',
        'stock' => 'integer',
        'reorder_level' => 'integer',
        'last_counted_at' => 'datetime',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
