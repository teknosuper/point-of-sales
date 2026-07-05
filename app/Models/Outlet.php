<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Outlet extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'slug',
        'name',
        'legal_name',
        'address',
        'city',
        'phone',
        'email',
        'website',
        'outlet_type',
        'parent_outlet_id',
        'commission_rate_percent',
        'logo',
        'is_active',
        'is_default',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'parent_outlet_id' => 'integer',
        'commission_rate_percent' => 'decimal:2',
        'sort_order' => 'integer',
    ];

    protected $appends = [
        'logo_url',
    ];

    public function users()
    {
        return $this->belongsToMany(User::class)
            ->withPivot('is_primary')
            ->withTimestamps();
    }

    public function parentOutlet()
    {
        return $this->belongsTo(self::class, 'parent_outlet_id');
    }

    public function childTenants()
    {
        return $this->hasMany(self::class, 'parent_outlet_id')
            ->where('outlet_type', 'tenant');
    }

    public function productStocks()
    {
        return $this->hasMany(ProductOutletStock::class);
    }

    public function kitchenStations()
    {
        return $this->hasMany(KitchenStation::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }

    public function tenantAllocations()
    {
        return $this->hasMany(TransactionTenantAllocation::class, 'tenant_outlet_id');
    }

    public function cashierShifts()
    {
        return $this->hasMany(CashierShift::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeTenant($query)
    {
        return $query->where('outlet_type', 'tenant');
    }

    /**
     * Resolve daftar tenant outlet aktif yang punya produk.
     * Helper terpusat — dipakai di POS, self-order meja, dan daftar menu publik.
     * Hanya mengembalikan outlet_type=tenant yang is_active=true.
     */
    public static function activeTenantOutletsWithProducts(?int $parentOutletId = null): \Illuminate\Support\Collection
    {
        return static::query()
            ->whereIn('id', \App\Models\Product::whereNotNull('tenant_outlet_id')->distinct()->pluck('tenant_outlet_id'))
            ->active()
            ->tenant()
            ->when($parentOutletId, fn ($q) => $q->where('parent_outlet_id', $parentOutletId))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'sort_order'])
            ->values();
    }

    /**
     * Kembalikan Set berisi ID tenant outlet yang NONAKTIF (is_active=false).
     * Dipakai untuk memfilter produk dari tenant tutup permanen di POS dan halaman publik.
     */
    public static function inactiveTenantIds(): array
    {
        return static::query()
            ->tenant()
            ->where('is_active', false)
            ->pluck('id')
            ->all();
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }

    public function profilePayload(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'slug' => $this->slug,
            'name' => $this->name,
            'parent_outlet_id' => $this->parent_outlet_id,
            'logo' => $this->logo_url,
            'address' => $this->address ?? '',
            'phone' => $this->phone ?? '',
            'email' => $this->email ?? '',
            'website' => $this->website ?? '',
            'city' => $this->city ?? '',
            'outlet_type' => $this->outlet_type ?? 'main',
            'commission_rate_percent' => (float) ($this->commission_rate_percent ?? 0),
        ];
    }

    public function getLogoUrlAttribute(): ?string
    {
        if (! $this->logo) {
            return null;
        }

        if (
            Str::startsWith($this->logo, ['http://', 'https://', '/storage/'])
            || Str::startsWith($this->logo, 'data:')
        ) {
            return $this->logo;
        }

        return '/storage/'.ltrim($this->logo, '/');
    }
}
