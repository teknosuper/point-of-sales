<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomerOutletMetric extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'customer_id',
        'outlet_id',
        'total_spent',
        'transaction_count',
        'loyalty_points_earned',
        'loyalty_points_redeemed',
        'loyalty_tier',
        'last_purchase_at',
    ];

    protected $casts = [
        'customer_id' => 'integer',
        'outlet_id' => 'integer',
        'total_spent' => 'integer',
        'transaction_count' => 'integer',
        'loyalty_points_earned' => 'integer',
        'loyalty_points_redeemed' => 'integer',
        'loyalty_tier' => 'string',
        'last_purchase_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
