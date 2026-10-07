<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use Auditable, BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = [
        'code', 'name', 'mobile', 'whatsapp', 'address', 'village', 'opening_balance', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return ['opening_balance' => 'decimal:2'];
    }

    public function milkEntries(): HasMany
    {
        return $this->hasMany(MilkEntry::class);
    }

    public function bills(): HasMany
    {
        return $this->hasMany(Bill::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** Phone number used for WhatsApp: dedicated WhatsApp number first, mobile as fallback. */
    public function whatsappPhone(): ?string
    {
        return $this->whatsapp ?: $this->mobile;
    }

    /**
     * Free-text search across code, name, mobile and village. A pure number also
     * matches the customer code exactly, which is what operators type most often.
     */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        $term = trim((string) $term);

        if ($term === '') {
            return $query;
        }

        $like = '%'.addcslashes($term, '%_\\').'%';

        return $query->where(function (Builder $q) use ($term, $like) {
            $q->where('code', $term)
                ->orWhere('name', 'like', $like)
                ->orWhere('mobile', 'like', $like)
                ->orWhere('whatsapp', 'like', $like)
                ->orWhere('village', 'like', $like)
                ->orWhere('code', 'like', $like);
        });
    }
}
