<?php

namespace App\Models;

use App\Support\ImagePlaceholder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Product extends Model
{
    use HasFactory;

    protected $casts = [
        'id' => 'integer',
        'category_id' => 'integer',
        'tenant_hpp_price' => 'integer',
        'buy_price' => 'integer',
        'sell_price' => 'integer',
        'tenant_discount_price' => 'integer',
        'stock' => 'integer',
        'tenant_outlet_id' => 'integer',
        'supports_modifiers' => 'boolean',
    ];

    /**
     * fillable
     *
     * @var array
     */
    protected $fillable = [
        'image',
        'barcode',
        'sku',
        'title',
        'description',
        'tenant_hpp_price',
        'buy_price',
        'sell_price',
        'tenant_discount_price',
        'category_id',
        'tenant_outlet_id',
        'supports_modifiers',
        'stock',
    ];

    /**
     * category
     *
     * @return void
     */
    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function stockOpnameItems()
    {
        return $this->hasMany(StockOpnameItem::class);
    }

    public function stockMutations()
    {
        return $this->hasMany(StockMutation::class);
    }

    public function salesReturnItems()
    {
        return $this->hasMany(SalesReturnItem::class);
    }

    public function pricingRules()
    {
        return $this->hasMany(PricingRule::class);
    }

    public function outletStocks()
    {
        return $this->hasMany(ProductOutletStock::class);
    }

    public function tenantOutlet()
    {
        return $this->belongsTo(Outlet::class, 'tenant_outlet_id');
    }

    public function kitchenStationMappings()
    {
        return $this->hasMany(ProductKitchenStationMapping::class);
    }

    public function modifierOptions()
    {
        return $this->hasMany(ProductModifierOption::class)
            ->orderBy('sort_order')
            ->orderBy('name');
    }

    /**
     * image
     */
    protected function image(): Attribute
    {
        return Attribute::make(
            get: fn ($value, array $attributes) => $this->resolveImageUrl($value, $attributes),
        );
    }

    protected function resolveImageUrl(mixed $value, array $attributes): string
    {
        if (! is_string($value) || blank($value) || in_array(strtolower($value), ['default.jpg', 'default.jpeg', 'default.png'], true)) {
            return ImagePlaceholder::product($attributes['title'] ?? 'Produk');
        }

        if (
            Str::startsWith($value, ['http://', 'https://', '/storage/'])
            || Str::startsWith($value, 'data:')
        ) {
            return $value;
        }

        return '/storage/products/'.ltrim($value, '/');
    }
}
