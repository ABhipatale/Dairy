<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MilkEntry extends Model
{
    use Auditable, BelongsToTenant, HasFactory;

    public const SESSIONS = ['morning', 'evening'];

    protected $fillable = [
        'customer_id', 'entry_date', 'session', 'quantity', 'fat', 'snf', 'rate', 'rate_source',
        'pricing_method', 'amount', 'notes', 'client_uuid',
    ];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'quantity' => 'decimal:2',
            'fat' => 'decimal:2',
            'snf' => 'decimal:2',
            'rate' => 'decimal:2',
            'amount' => 'decimal:2',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    /** Entries on a live bill are frozen so printed bills always match the data. */
    public function isLocked(): bool
    {
        return $this->bill_id !== null;
    }
}
