<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupplierReturn extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'outlet_id',
        'supplier_id',
        'goods_receiving_id',
        'payable_id',
        'document_number',
        'status',
        'notes',
        'returned_at',
        'created_by',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'returned_at' => 'datetime',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function goodsReceiving()
    {
        return $this->belongsTo(GoodsReceiving::class);
    }

    public function payable()
    {
        return $this->belongsTo(Payable::class);
    }

    public function items()
    {
        return $this->hasMany(SupplierReturnItem::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
