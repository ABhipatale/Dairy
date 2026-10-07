<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    public const SUPER_ADMIN = 'super_admin';

    /** The single login of a dairy company (full access to that company). */
    public const ADMIN = 'admin';

    protected $fillable = ['name', 'label', 'is_system'];

    protected function casts(): array
    {
        return ['is_system' => 'boolean'];
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class);
    }

    public static function idFor(string $name): int
    {
        return (int) static::query()->where('name', $name)->value('id');
    }
}
