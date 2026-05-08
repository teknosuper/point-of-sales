<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KitchenTicket extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'outlet_id',
        'transaction_id',
        'cashier_shift_id',
        'kitchen_station_id',
        'ticket_number',
        'source_channel',
        'status',
        'notes',
        'fired_at',
        'acknowledged_at',
        'completed_at',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'transaction_id' => 'integer',
        'cashier_shift_id' => 'integer',
        'kitchen_station_id' => 'integer',
        'fired_at' => 'datetime',
        'acknowledged_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

    public function cashierShift()
    {
        return $this->belongsTo(CashierShift::class);
    }

    public function kitchenStation()
    {
        return $this->belongsTo(KitchenStation::class);
    }

    public function items()
    {
        return $this->hasMany(KitchenTicketItem::class);
    }

    public function events()
    {
        return $this->hasMany(KitchenTicketEvent::class);
    }

    public function printJobs()
    {
        return $this->hasMany(PrintJob::class);
    }
}
