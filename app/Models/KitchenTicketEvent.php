<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KitchenTicketEvent extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'kitchen_ticket_id',
        'user_id',
        'event',
        'payload',
        'created_at',
    ];

    protected $casts = [
        'kitchen_ticket_id' => 'integer',
        'user_id' => 'integer',
        'payload' => 'array',
        'created_at' => 'datetime',
    ];

    public function kitchenTicket()
    {
        return $this->belongsTo(KitchenTicket::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
