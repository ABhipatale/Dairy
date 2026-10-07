<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class PrintLog extends Model
{
    use BelongsToTenant;

    protected $fillable = ['user_id', 'document_type', 'reference_id', 'connection_type', 'status', 'error'];
}
