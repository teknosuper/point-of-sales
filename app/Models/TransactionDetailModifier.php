<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransactionDetailModifier extends Model
{
    use HasFactory;

    protected $fillable = [
        'transaction_detail_id',
        'name',
        'qty',
        'unit_price',
        'total_price',
    ];

    protected $casts = [
        'transaction_detail_id' => 'integer',
        'qty' => 'integer',
        'unit_price' => 'integer',
        'total_price' => 'integer',
    ];

    public function transactionDetail()
    {
        return $this->belongsTo(TransactionDetail::class);
    }
}
