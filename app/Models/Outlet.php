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
        'commission_rate_percent',
        'logo',
        'is_active',
        'is_default',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
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
