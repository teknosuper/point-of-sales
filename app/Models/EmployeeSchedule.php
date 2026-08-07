<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeSchedule extends Model
{
    use HasFactory;

    public const STATUS_MASUK = 'masuk';

    public const STATUS_LIBUR = 'libur';

    public const STATUS_CUTI = 'cuti';

    public const STATUS_IZIN = 'izin';

    public const STATUS_SAKIT = 'sakit';

    public const STATUSES = [
        self::STATUS_MASUK,
        self::STATUS_LIBUR,
        self::STATUS_CUTI,
        self::STATUS_IZIN,
        self::STATUS_SAKIT,
    ];

    protected $casts = [
        'id' => 'integer',
        'employee_id' => 'integer',
        'shift_id' => 'integer',
        'schedule_date' => 'date',
    ];

    protected $fillable = [
        'schedule_date',
        'employee_id',
        'shift_id',
        'status',
        'note',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(EmployeeShift::class);
    }
}
