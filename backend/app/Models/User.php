<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Users are NOT globally tenant-scoped (login must find them before a tenant is known).
 * Tenant-facing queries use the forCurrentTenant() scope explicitly.
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use Auditable, HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = ['name', 'mobile', 'email', 'password', 'language', 'is_active', 'role_id'];

    protected $hidden = ['password', 'remember_token'];

    protected array $auditExclude = ['last_login_at'];

    /** @var array<string, bool>|null */
    private ?array $permissionCache = null;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function scopeForCurrentTenant($query)
    {
        return $query->where('tenant_id', app(\App\Support\TenantContext::class)->id());
    }

    public function isSuperAdmin(): bool
    {
        return $this->tenant_id === null && $this->role?->name === Role::SUPER_ADMIN;
    }

    public function permissionNames(): array
    {
        if ($this->permissionCache === null) {
            $names = $this->role?->permissions()->pluck('name')->all() ?? [];
            $this->permissionCache = array_fill_keys($names, true);
        }

        return array_keys($this->permissionCache);
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        $this->permissionNames();

        return isset($this->permissionCache[$permission]);
    }
}
