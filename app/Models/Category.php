<?php

namespace App\Models;

use App\Support\ImagePlaceholder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Category extends Model
{
    use HasFactory;

    protected $casts = [
        'id' => 'integer',
        'tenant_outlet_id' => 'integer',
    ];

    /**
     * fillable
     *
     * @var array
     */
    protected $fillable = [
        'image', 'name', 'description', 'tenant_outlet_id',
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

    public function tenantOutlet()
    {
        return $this->belongsTo(Outlet::class, 'tenant_outlet_id');
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

        $normalized = trim($value);

        if (str_starts_with($normalized, 'http://') || str_starts_with($normalized, 'https://') || str_starts_with($normalized, '/storage/')) {
            return $normalized;
        }

        if (Storage::disk('public')->exists('categories/'.$normalized)) {
            return asset('storage/categories/'.$normalized);
        }

        if (Storage::disk('public')->exists('category/'.$normalized)) {
            return asset('storage/category/'.$normalized);
        }

        return ImagePlaceholder::category($attributes['name'] ?? 'Kategori');
    }
}
