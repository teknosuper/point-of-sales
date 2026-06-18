<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TableOrder extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'outlet_id',
        'dining_table_id',
        'customer_id',
        'order_number',
        'access_token',
        'source_channel',
        'customer_name',
        'customer_phone',
        'customer_email',
        'notes',
        'payment_method',
        'status',
        'subtotal',
        'grand_total',
        'approved_by',
        'approved_at',
        'transaction_id',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'dining_table_id' => 'integer',
        'customer_id' => 'integer',
        'subtotal' => 'integer',
        'grand_total' => 'integer',
        'approved_by' => 'integer',
        'transaction_id' => 'integer',
        'approved_at' => 'datetime',
    ];

    public function diningTable()
    {
        return $this->belongsTo(DiningTable::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(TableOrderItem::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

    public function resolvedSubtotal(): int
    {
        $itemsTotal = $this->relationLoaded('items')
            ? (int) $this->items->sum('line_total')
            : (int) $this->items()->sum('line_total');

        return $itemsTotal > 0 ? $itemsTotal : (int) ($this->subtotal ?? 0);
    }

    public function resolvedGrandTotal(): int
    {
        $itemsTotal = $this->relationLoaded('items')
            ? (int) $this->items->sum('line_total')
            : (int) $this->items()->sum('line_total');

        return $itemsTotal > 0 ? $itemsTotal : (int) ($this->grand_total ?? 0);
    }
}
