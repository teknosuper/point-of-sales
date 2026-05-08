<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransactionTenantAllocationItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'transaction_tenant_allocation_id',
        'transaction_detail_id',
        'tenant_outlet_id',
        'product_id',
        'kitchen_station_id',
        'qty',
        'base_unit_price',
        'unit_price',
        'line_total',
        'discount_total',
        'notes',
    ];

    protected $casts = [
        'transaction_tenant_allocation_id' => 'integer',
        'transaction_detail_id' => 'integer',
        'tenant_outlet_id' => 'integer',
        'product_id' => 'integer',
        'kitchen_station_id' => 'integer',
        'qty' => 'integer',
        'base_unit_price' => 'integer',
        'unit_price' => 'integer',
        'line_total' => 'integer',
        'discount_total' => 'integer',
    ];

    public function allocation()
    {
        return $this->belongsTo(TransactionTenantAllocation::class, 'transaction_tenant_allocation_id');
    }

    public function transactionDetail()
    {
        return $this->belongsTo(TransactionDetail::class);
    }

    public function tenantOutlet()
    {
        return $this->belongsTo(Outlet::class, 'tenant_outlet_id');
    }
}
