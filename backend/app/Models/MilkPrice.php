<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class MilkPrice extends Model
{
    use Auditable, BelongsToTenant;

    protected $fillable = ['effective_from', 'session', 'method', 'rate', 'fat_rate', 'min_rate', 'notes'];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'rate' => 'decimal:2',
            'fat_rate' => 'decimal:4',
            'min_rate' => 'decimal:2',
        ];
    }
}
