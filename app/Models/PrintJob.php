<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PrintJob extends Model
{
    use BelongsToOutlet, HasFactory;

    public const TYPE_KITCHEN_TICKET = 'kitchen_ticket';
    public const TYPE_RECEIPT = 'receipt';
    public const TYPE_PARKING_TICKET = 'parking_ticket';

    public const STATUS_QUEUED = 'queued';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_SUCCESS = 'success';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'outlet_id',
        'transaction_id',
        'kitchen_ticket_id',
        'kitchen_station_device_id',
        'job_type',
        'status',
        'copies',
        'payload',
        'queued_at',
        'processing_at',
        'processed_at',
        'failed_at',
        'failure_reason',
        'created_by',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'transaction_id' => 'integer',
        'kitchen_ticket_id' => 'integer',
        'kitchen_station_device_id' => 'integer',
        'copies' => 'integer',
        'payload' => 'array',
        'queued_at' => 'datetime',
        'processing_at' => 'datetime',
        'processed_at' => 'datetime',
        'failed_at' => 'datetime',
        'created_by' => 'integer',
    ];

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

    public function kitchenTicket()
    {
        return $this->belongsTo(KitchenTicket::class);
    }

    public function device()
    {
        return $this->belongsTo(KitchenStationDevice::class, 'kitchen_station_device_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
