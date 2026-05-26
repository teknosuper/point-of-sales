<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransactionDetail extends Model
{
    use BelongsToOutlet, HasFactory;

    /**
     * fillable
     *
     * @var array
     */
    protected $fillable = [
        'transaction_id',
        'outlet_id',
        'tenant_outlet_id',
        'product_id',
        'kitchen_station_id',
        'qty',
        'base_unit_price',
        'customer_base_unit_price',
        'tenant_base_unit_price',
        'owner_markup_unit_price',
        'unit_price',
        'price',
        'notes',
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
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'tenant_outlet_id' => 'integer',
        'qty' => 'integer',
        'kitchen_station_id' => 'integer',
        'base_unit_price' => 'integer',
        'customer_base_unit_price' => 'integer',
        'tenant_base_unit_price' => 'integer',
        'owner_markup_unit_price' => 'integer',
        'unit_price' => 'integer',
        'price' => 'integer',
        'discount_total' => 'integer',
        'tenant_discount_total' => 'integer',
        'owner_discount_total' => 'integer',
        'tenant_net_total' => 'integer',
        'owner_net_total' => 'integer',
        'pricing_rule_id' => 'integer',
        'pricing_rule_kind' => 'string',
        'pricing_rule_price_basis' => 'string',
    ];

    /**
     * transaction
     *
     * @return void
     */
    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }

    /**
     * product
     *
     * @return void
     */
    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function pricingRule()
    {
        return $this->belongsTo(PricingRule::class);
    }

    public function kitchenStation()
    {
        return $this->belongsTo(KitchenStation::class);
    }

    public function tenantOutlet()
    {
        return $this->belongsTo(Outlet::class, 'tenant_outlet_id');
    }

    public function tenantAllocationItems()
    {
        return $this->hasMany(TransactionTenantAllocationItem::class);
    }

    public function salesReturnItems()
    {
        return $this->hasMany(SalesReturnItem::class);
    }

    public function modifiers()
    {
        return $this->hasMany(TransactionDetailModifier::class);
    }
}
