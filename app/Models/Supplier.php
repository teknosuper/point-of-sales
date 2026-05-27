<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'outlet_id',
        'name',
        'phone',
        'email',
        'address',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
    ];

    public function payables()
    {
        return $this->hasMany(Payable::class);
    }
}
