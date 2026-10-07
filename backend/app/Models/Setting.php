<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Key/value settings. tenant_id NULL = global default. Accessed only through SettingsService,
 * which applies tenant filtering explicitly (no global scope, so globals stay readable).
 */
class Setting extends Model
{
    protected $fillable = ['tenant_id', 'key', 'value'];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }
}
