<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DiningTable extends Model
{
    use BelongsToOutlet, HasFactory;

    protected static function booted(): void
    {
        static::creating(function (DiningTable $table) {
            if (! filled($table->qr_token)) {
                $table->qr_token = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'outlet_id',
        'name',
        'code',
        'qr_token',
        'capacity',
        'status',
        'self_order_enabled',
        'sort_order',
        'notes',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'capacity' => 'integer',
        'sort_order' => 'integer',
        'self_order_enabled' => 'boolean',
    ];

    public function transactions()
    {
        return $this->hasMany(Transaction::class, 'table_id');
    }

    public function tableOrders()
    {
        return $this->hasMany(TableOrder::class);
    }
}
