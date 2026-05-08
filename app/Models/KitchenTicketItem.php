<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KitchenTicketItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'kitchen_ticket_id',
        'transaction_detail_id',
        'product_id',
        'product_title',
        'qty',
        'status',
        'notes',
        'fired_at',
        'completed_at',
    ];

    protected $casts = [
        'kitchen_ticket_id' => 'integer',
        'transaction_detail_id' => 'integer',
        'product_id' => 'integer',
        'qty' => 'integer',
        'fired_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function kitchenTicket()
    {
        return $this->belongsTo(KitchenTicket::class);
    }

    public function transactionDetail()
    {
        return $this->belongsTo(TransactionDetail::class);
    }
}
