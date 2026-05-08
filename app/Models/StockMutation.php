<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockMutation extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'outlet_id',
        'product_id',
        'reference_type',
        'reference_id',
        'mutation_type',
        'qty',
        'stock_before',
        'stock_after',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'id' => 'integer',
        'outlet_id' => 'integer',
        'product_id' => 'integer',
        'reference_id' => 'integer',
        'qty' => 'integer',
        'stock_before' => 'integer',
        'stock_after' => 'integer',
        'created_by' => 'integer',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
