<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmployeeShift extends Model
{
    use HasFactory;

    protected $casts = [
        'id' => 'integer',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    protected $fillable = [
        'name',
        'start_time',
        'end_time',
        'sort_order',
        'is_active',
    ];

    public function schedules(): HasMany
    {
        return $this->hasMany(EmployeeSchedule::class);
    }

    /**
     * Durasi shift dalam menit (menangani shift lintas malam, mis. 16:00-00:00).
     */
    public function durationMinutes(): int
    {
        if (! $this->start_time || ! $this->end_time) {
            return 0;
        }

        $start = strtotime($this->start_time);
        $end = strtotime($this->end_time);

        $minutes = ($end - $start) / 60;

        if ($minutes <= 0) {
            $minutes += 24 * 60;
        }

        return (int) round($minutes);
    }
}
