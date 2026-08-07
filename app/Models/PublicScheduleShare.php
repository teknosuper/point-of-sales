<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PublicScheduleShare extends Model
{
    protected $fillable = ['token', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
