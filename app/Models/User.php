<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasFactory, HasRoles, Notifiable {
        hasPermissionTo as protected spatieHasPermissionTo;
        checkPermissionTo as protected spatieCheckPermissionTo;
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'avatar',
        'preferred_workspace',
        'preferred_kitchen_station_id',
        'waiter_service_scope',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'preferred_kitchen_station_id' => 'integer',
        ];
    }

    /**
     * Accessor for avatar URL.
     */
    protected function avatar(): Attribute
    {
        return Attribute::make(
            get: function ($value) {
                if (! $value) {
                    return null;
                }

                if (
                    str_starts_with($value, 'http://') ||
                    str_starts_with($value, 'https://') ||
                    str_starts_with($value, '/storage/')
                ) {
                    return $value;
                }

                return asset('storage/'.ltrim($value, '/'));
            }
        );
    }

    /**
     *  get all permissions users
     */
    public function getPermissions()
    {
        return $this->getAllPermissions()->mapWithKeys(function ($permission) {
            return [
                $permission['name'] => true,
            ];
        });
    }

    /**
     * check role isSuperAdmin
     */
    public function isSuperAdmin()
    {
        return $this->hasRole('super-admin');
    }

    public function hasPermissionTo($permission, $guardName = null): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return $this->spatieHasPermissionTo($permission, $guardName);
    }

    public function checkPermissionTo($permission, $guardName = null): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return $this->spatieCheckPermissionTo($permission, $guardName);
    }

    public function cashierShifts()
    {
        return $this->hasMany(CashierShift::class);
    }

    public function outlets()
    {
        return $this->belongsToMany(Outlet::class)
            ->withPivot('is_primary')
            ->withTimestamps();
    }

    public function waiterTenantOutlets()
    {
        return $this->belongsToMany(Outlet::class, 'user_waiter_tenant_outlet', 'user_id', 'tenant_outlet_id')
            ->withTimestamps();
    }

    public function accessibleOutletsQuery(): Builder
    {
        if ($this->isSuperAdmin()) {
            return Outlet::query();
        }

        $directOutletIds = $this->outlets()
            ->select('outlets.id');

        $directMainOutletIds = $this->outlets()
            ->select('outlets.id')
            ->where('outlets.outlet_type', 'main');

        return Outlet::query()
            ->where(function (Builder $query) use ($directOutletIds, $directMainOutletIds) {
                $query->whereIn('outlets.id', $directOutletIds)
                    ->orWhere(function (Builder $tenantQuery) use ($directMainOutletIds) {
                        $tenantQuery->where('outlets.outlet_type', 'tenant')
                            ->whereIn('outlets.parent_outlet_id', $directMainOutletIds);
                    });
            });
    }

    public function hasAccessToOutlet(int $outletId): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return $this->accessibleOutletsQuery()
            ->where('outlets.id', $outletId)
            ->exists();
    }

    public function isKitchenWorkspace(): bool
    {
        return $this->preferred_workspace === 'kitchen';
    }

    public function isWaiter(): bool
    {
        return $this->can('waiter-board-access');
    }

    public function servesAllTenantOutlets(): bool
    {
        return ($this->waiter_service_scope ?? 'outlet_all') === 'outlet_all';
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }

    public function preferredKitchenStation()
    {
        return $this->belongsTo(KitchenStation::class, 'preferred_kitchen_station_id');
    }
}
