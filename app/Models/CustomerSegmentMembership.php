<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomerSegmentMembership extends Model
{
    use BelongsToOutlet, HasFactory;

    public const SOURCE_MANUAL = 'manual';

    public const SOURCE_AUTO = 'auto';

    protected $fillable = [
        'customer_id',
        'customer_segment_id',
        'outlet_id',
        'source',
        'matched_at',
    ];

    protected $casts = [
        'customer_id' => 'integer',
        'customer_segment_id' => 'integer',
        'outlet_id' => 'integer',
        'matched_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function segment()
    {
        return $this->belongsTo(CustomerSegment::class, 'customer_segment_id');
    }
}
