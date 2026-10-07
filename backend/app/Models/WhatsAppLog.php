<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppLog extends Model
{
    use BelongsToTenant;

    protected $table = 'whatsapp_logs';

    protected $fillable = [
        'customer_id', 'type', 'reference_type', 'reference_id', 'phone', 'message', 'driver', 'status',
        'provider_message_id', 'error', 'sent_by',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }
}
