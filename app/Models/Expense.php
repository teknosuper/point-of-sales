<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOutlet;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    use BelongsToOutlet, HasFactory;

    public const STATUS_PAID = 'paid';
    public const STATUS_UNPAID = 'unpaid';

    protected $fillable = [
        'outlet_id',
        'expense_date',
        'category',
        'description',
        'amount',
        'payment_method',
        'status',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'outlet_id' => 'integer',
        'amount' => 'integer',
        'created_by' => 'integer',
        'expense_date' => 'date',
    ];

    public function outlet()
    {
        return $this->belongsTo(Outlet::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
