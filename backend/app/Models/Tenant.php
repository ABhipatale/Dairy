<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Tenant extends Model
{
    use Auditable, HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'slug', 'owner_name', 'mobile', 'whatsapp_number', 'email', 'address', 'city', 'state',
        'country', 'pincode', 'gst_number', 'currency', 'timezone', 'default_language',
        'invoice_footer', 'thank_you_message', 'status', 'plan', 'subscription_ends_at',
    ];

    protected function casts(): array
    {
        return ['subscription_ends_at' => 'date'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function isActive(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        return $this->subscription_ends_at === null || ! $this->subscription_ends_at->endOfDay()->isPast();
    }

    public function logoUrl(): ?string
    {
        return $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null;
    }

    public function logoAbsolutePath(): ?string
    {
        return $this->logo_path && Storage::disk('public')->exists($this->logo_path)
            ? Storage::disk('public')->path($this->logo_path)
            : null;
    }

    /** Single-line postal address for receipts and PDFs. */
    public function fullAddress(): string
    {
        return collect([$this->address, $this->city, $this->state, $this->pincode])->filter()->implode(', ');
    }
}
