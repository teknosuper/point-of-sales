<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductModifierOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'group_name',
        'order_type_scope',
        'name',
        'price',
        'stock',
        'is_active',
        'is_required',
        'selection_mode',
        'min_select',
        'max_select',
        'sort_order',
        'group_sort_order',
    ];

    protected $casts = [
        'product_id' => 'integer',
        'price' => 'integer',
        'stock' => 'integer',
        'is_active' => 'boolean',
        'is_required' => 'boolean',
        'min_select' => 'integer',
        'max_select' => 'integer',
        'sort_order' => 'integer',
        'group_sort_order' => 'integer',
    ];

    public function appliesTo(?string $orderType): bool
    {
        $scope = trim((string) ($this->order_type_scope ?? ''));

        if ($scope === '' || $scope === 'both') {
            return true;
        }

        return $orderType !== null && $scope === $orderType;
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
