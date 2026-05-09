<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiningTable extends Model
{
    use BelongsToOutlet, HasFactory;

    protected $fillable = [
        'outlet_id',
        'name',
        'code',
        'capacity',
        'status',
        'sort_order',
        'notes',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'capacity' => 'integer',
        'sort_order' => 'integer',
    ];

    public function transactions()
    {
        return $this->hasMany(Transaction::class, 'table_id');
    }
}
