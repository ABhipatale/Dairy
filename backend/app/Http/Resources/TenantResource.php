<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TenantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'owner_name' => $this->owner_name,
            'mobile' => $this->mobile,
            'whatsapp_number' => $this->whatsapp_number,
            'email' => $this->email,
            'address' => $this->address,
            'city' => $this->city,
            'state' => $this->state,
            'country' => $this->country,
            'pincode' => $this->pincode,
            'logo_url' => $this->logoUrl(),
            'gst_number' => $this->gst_number,
            'currency' => $this->currency,
            'timezone' => $this->timezone,
            'default_language' => $this->default_language,
            'invoice_footer' => $this->invoice_footer,
            'thank_you_message' => $this->thank_you_message,
            'status' => $this->status,
            'plan' => $this->plan,
            'subscription_ends_at' => $this->subscription_ends_at?->toDateString(),
            'users_count' => $this->whenCounted('users'),
            'customers_count' => $this->whenCounted('customers'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
