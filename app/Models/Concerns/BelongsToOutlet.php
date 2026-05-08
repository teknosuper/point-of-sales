<?php

namespace App\Models\Concerns;

use App\Models\Outlet;

trait BelongsToOutlet
{
    public function outlet()
    {
        return $this->belongsTo(Outlet::class);
    }

    public function scopeForOutlet($query, int $outletId)
    {
        return $query->where($this->getTable().'.outlet_id', $outletId);
    }
}
