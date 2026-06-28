<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PosCheckoutReservation extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'outlet_id',
        'signature',
        'items',
        'status',
        'reserved_at',
        'released_at',
        'consumed_at',
        'last_seen_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'outlet_id' => 'integer',
        'items' => 'array',
        'reserved_at' => 'datetime',
        'released_at' => 'datetime',
        'consumed_at' => 'datetime',
        'last_seen_at' => 'datetime',
    ];
}
