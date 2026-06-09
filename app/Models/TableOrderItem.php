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
        'customer_base_unit_price',
        'tenant_base_unit_price',
        'owner_markup_unit_price',
        'unit_price',
        'line_total',
        'discount_total',
        'tenant_discount_total',
        'owner_discount_total',
        'tenant_net_total',
        'owner_net_total',
        'pricing_rule_id',
        'pricing_rule_name',
        'pricing_rule_kind',
        'pricing_rule_price_basis',
        'pricing_group_key',
        'pricing_group_label',
        'is_promo_reward',
        'promo_reward_rule_name',
        'promo_reward_label',
        'notes',
    ];

    protected $casts = [
        'table_order_id' => 'integer',
        'product_id' => 'integer',
        'tenant_outlet_id' => 'integer',
        'qty' => 'integer',
        'base_unit_price' => 'integer',
        'customer_base_unit_price' => 'integer',
        'tenant_base_unit_price' => 'integer',
        'owner_markup_unit_price' => 'integer',
        'unit_price' => 'integer',
        'line_total' => 'integer',
        'discount_total' => 'integer',
        'tenant_discount_total' => 'integer',
        'owner_discount_total' => 'integer',
        'tenant_net_total' => 'integer',
        'owner_net_total' => 'integer',
        'pricing_rule_id' => 'integer',
        'pricing_rule_price_basis' => 'string',
        'is_promo_reward' => 'boolean',
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
