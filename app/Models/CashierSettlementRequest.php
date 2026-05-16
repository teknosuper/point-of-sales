<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CashierSettlementRequest extends Model
{
    use BelongsToOutlet, HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'outlet_id',
        'cashier_id',
        'cashier_shift_id',
        'request_number',
        'business_date',
        'gross_sales_total',
        'base_sales_total',
        'markup_total',
        'requested_amount',
        'recipient_user_id',
        'recipient_name',
        'requested_notes',
        'request_proof_photos',
        'status',
        'approved_by',
        'approved_at',
        'rejected_by',
        'rejected_at',
        'rejection_reason',
        'approved_amount',
        'approved_cash_amount',
        'approved_transfer_amount',
        'approved_other_amount',
        'approved_other_label',
        'approval_reference',
        'approval_notes',
        'approval_proof_photos',
        'paid_at',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'cashier_id' => 'integer',
        'cashier_shift_id' => 'integer',
        'recipient_user_id' => 'integer',
        'approved_by' => 'integer',
        'rejected_by' => 'integer',
        'business_date' => 'date',
        'gross_sales_total' => 'integer',
        'base_sales_total' => 'integer',
        'markup_total' => 'integer',
        'requested_amount' => 'integer',
        'request_proof_photos' => 'array',
        'approved_amount' => 'integer',
        'approved_cash_amount' => 'integer',
        'approved_transfer_amount' => 'integer',
        'approved_other_amount' => 'integer',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'approval_proof_photos' => 'array',
        'paid_at' => 'datetime',
    ];

    public function cashier()
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function cashierShift()
    {
        return $this->belongsTo(CashierShift::class);
    }

    public function recipientUser()
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejectedBy()
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }
}
