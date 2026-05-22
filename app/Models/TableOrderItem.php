<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TableOrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'table_order_id',
        'product_id',
        'tenant_outlet_id',
        'product_title',
        'qty',
        'base_unit_price',
        'unit_price',
        'line_total',
        'discount_total',
        'pricing_rule_id',
        'pricing_rule_name',
        'pricing_rule_kind',
        'pricing_group_key',
        'pricing_group_label',
        'notes',
    ];

    protected $casts = [
        'table_order_id' => 'integer',
        'product_id' => 'integer',
        'tenant_outlet_id' => 'integer',
        'qty' => 'integer',
        'base_unit_price' => 'integer',
        'unit_price' => 'integer',
        'line_total' => 'integer',
        'discount_total' => 'integer',
        'pricing_rule_id' => 'integer',
    ];

    public function tableOrder()
    {
        return $this->belongsTo(TableOrder::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function tenantOutlet()
    {
        return $this->belongsTo(Outlet::class, 'tenant_outlet_id');
    }

    public function pricingRule()
    {
        return $this->belongsTo(PricingRule::class);
    }

    public function modifiers()
    {
        return $this->hasMany(TableOrderItemModifier::class);
    }
}
