<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'outlet_id',
        'supplier_id',
        'document_number',
        'status',
        'notes',
        'created_by',
        'ordered_at',
        'completed_at',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'ordered_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items()
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function goodsReceivings()
    {
        return $this->hasMany(GoodsReceiving::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payable()
    {
        return $this->hasOne(Payable::class);
    }
}
