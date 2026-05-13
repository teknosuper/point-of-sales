<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TableOrderItemModifier extends Model
{
    use HasFactory;

    protected $fillable = [
        'table_order_item_id',
        'product_modifier_option_id',
        'name',
        'qty',
        'unit_price',
        'total_price',
    ];

    protected $casts = [
        'table_order_item_id' => 'integer',
        'product_modifier_option_id' => 'integer',
        'qty' => 'integer',
        'unit_price' => 'integer',
        'total_price' => 'integer',
    ];

    public function tableOrderItem()
    {
        return $this->belongsTo(TableOrderItem::class);
    }

    public function option()
    {
        return $this->belongsTo(ProductModifierOption::class, 'product_modifier_option_id');
    }
}
