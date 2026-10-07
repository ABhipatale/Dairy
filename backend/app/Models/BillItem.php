<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class BillItem extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = ['milk_entry_id', 'entry_date', 'session', 'quantity', 'fat', 'rate', 'amount'];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'quantity' => 'decimal:2',
            'fat' => 'decimal:2',
            'rate' => 'decimal:2',
            'amount' => 'decimal:2',
        ];
    }
}
