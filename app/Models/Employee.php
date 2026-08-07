<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    use HasFactory;

    protected $casts = [
        'id' => 'integer',
        'rotation_order' => 'integer',
        'is_active' => 'boolean',
    ];

    protected $fillable = [
        'name',
        'job_type',
        'phone',
        'notes',
        'rotation_order',
        'is_active',
    ];

    public function schedules(): HasMany
    {
        return $this->hasMany(EmployeeSchedule::class);
    }
}
