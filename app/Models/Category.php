<?php

namespace App\Models;

use App\Support\ImagePlaceholder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory;

    protected $casts = [
        'id' => 'integer',
    ];

    /**
     * fillable
     *
     * @var array
     */
    protected $fillable = [
        'image', 'name', 'description',
    ];

    /**
     * products
     *
     * @return void
     */
    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function pricingRules()
    {
        return $this->hasMany(PricingRule::class);
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
            return ImagePlaceholder::category($attributes['name'] ?? 'Kategori');
        }

        return asset('storage/categories/'.$value);
    }
}
