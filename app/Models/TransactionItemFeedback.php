<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransactionItemFeedback extends Model
{
    use HasFactory;

    protected $table = 'transaction_item_feedbacks';

    protected $fillable = [
        'outlet_id',
        'transaction_id',
        'transaction_detail_id',
        'rating',
        'feedback_text',
        'delivery_status',
        'customer_alert_message',
        'customer_alert_requested_at',
        'customer_alert_count',
        'kitchen_ticket_event_id',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'transaction_id' => 'integer',
        'transaction_detail_id' => 'integer',
        'rating' => 'integer',
        'customer_alert_requested_at' => 'datetime',
        'customer_alert_count' => 'integer',
        'kitchen_ticket_event_id' => 'integer',
    ];

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

    public function transactionDetail()
    {
        return $this->belongsTo(TransactionDetail::class);
    }

    public function kitchenTicketEvent()
    {
        return $this->belongsTo(KitchenTicketEvent::class);
    }
}
