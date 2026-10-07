<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MilkEntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'customer_id' => $this->customer_id,
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->id,
                'code' => $this->customer->code,
                'name' => $this->customer->name,
                'mobile' => $this->customer->mobile,
                'whatsapp' => $this->customer->whatsapp,
            ]),
            'entry_date' => $this->entry_date->toDateString(),
            'session' => $this->session,
            'quantity' => $this->quantity,
            'fat' => $this->fat,
            'snf' => $this->snf,
            'rate' => $this->rate,
            'rate_source' => $this->rate_source,
            'pricing_method' => $this->pricing_method,
            'amount' => $this->amount,
            'notes' => $this->notes,
            'bill_id' => $this->bill_id,
            'locked' => $this->isLocked(),
            'client_uuid' => $this->client_uuid,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
