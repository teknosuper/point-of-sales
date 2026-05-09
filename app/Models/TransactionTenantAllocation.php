<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransactionTenantAllocation extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'transaction_id',
        'outlet_id',
        'tenant_outlet_id',
        'cashier_id',
        'cashier_shift_id',
        'allocation_number',
        'subtotal',
        'promo_discount_total',
        'manual_discount_total',
        'loyalty_discount_total',
        'voucher_discount_total',
        'grand_total',
        'payment_status',
        'kitchen_status',
        'waiter_status',
        'waiter_id',
        'ready_at',
        'picked_up_at',
        'delivered_at',
        'settled_at',
        'payout_reference',
        'payout_notes',
        'payout_paid_at',
        'notes',
    ];

    protected $casts = [
        'transaction_id' => 'integer',
        'outlet_id' => 'integer',
        'tenant_outlet_id' => 'integer',
        'cashier_id' => 'integer',
        'cashier_shift_id' => 'integer',
        'waiter_id' => 'integer',
        'subtotal' => 'integer',
        'promo_discount_total' => 'integer',
        'manual_discount_total' => 'integer',
        'loyalty_discount_total' => 'integer',
        'voucher_discount_total' => 'integer',
        'grand_total' => 'integer',
        'ready_at' => 'datetime',
        'picked_up_at' => 'datetime',
        'delivered_at' => 'datetime',
        'settled_at' => 'datetime',
        'payout_paid_at' => 'datetime',
    ];

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

    public function tenantOutlet()
    {
        return $this->belongsTo(Outlet::class, 'tenant_outlet_id');
    }

    public function waiter()
    {
        return $this->belongsTo(User::class, 'waiter_id');
    }

    public function items()
    {
        return $this->hasMany(TransactionTenantAllocationItem::class);
    }
}
