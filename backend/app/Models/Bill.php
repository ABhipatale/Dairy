<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bill extends Model
{
    use Auditable, BelongsToTenant;

    public const STATUSES = ['draft', 'generated', 'pending', 'partially_paid', 'paid', 'cancelled'];

    /** Statuses that still expect money. */
    public const OPEN_STATUSES = ['generated', 'pending', 'partially_paid'];

    protected $fillable = ['discount', 'notes'];

    protected function casts(): array
    {
        return [
            'bill_date' => 'date',
            'period_start' => 'date',
            'period_end' => 'date',
            'total_qty' => 'decimal:2',
            'avg_fat' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'previous_balance' => 'decimal:2',
            'discount' => 'decimal:2',
            'net_payable' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'outstanding' => 'decimal:2',
            'sent_at' => 'datetime',
            'paid_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function items(): HasMany
    {
        return $this->hasMany(BillItem::class)->orderBy('entry_date')->orderByRaw("FIELD(session, 'morning', 'evening')");
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function carriedForwardTo(): BelongsTo
    {
        return $this->belongsTo(Bill::class, 'carried_forward_to_id');
    }

    public function generator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by')->withTrashed();
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    /** Bills whose outstanding amount is still owed on this bill (not rolled into a newer one). */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN_STATUSES)->whereNull('carried_forward_to_id');
    }
}
