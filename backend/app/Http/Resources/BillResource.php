<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BillResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'bill_no' => $this->bill_no,
            'bill_date' => $this->bill_date->toDateString(),
            'period_start' => $this->period_start->toDateString(),
            'period_end' => $this->period_end->toDateString(),
            'customer_id' => $this->customer_id,
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->id,
                'code' => $this->customer->code,
                'name' => $this->customer->name,
                'mobile' => $this->customer->mobile,
                'whatsapp' => $this->customer->whatsapp,
                'address' => $this->customer->address,
                'village' => $this->customer->village,
            ]),
            'entry_count' => $this->entry_count,
            'total_qty' => $this->total_qty,
            'avg_fat' => $this->avg_fat,
            'total_amount' => $this->total_amount,
            'previous_balance' => $this->previous_balance,
            'discount' => $this->discount,
            'net_payable' => $this->net_payable,
            'paid_amount' => $this->paid_amount,
            'outstanding' => $this->outstanding,
            'status' => $this->status,
            'carried_forward_to_id' => $this->carried_forward_to_id,
            'sent_at' => $this->sent_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'notes' => $this->notes,
            'cancel_reason' => $this->cancel_reason,
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($i) => [
                'id' => $i->id,
                'entry_date' => $i->entry_date->toDateString(),
                'session' => $i->session,
                'quantity' => $i->quantity,
                'fat' => $i->fat,
                'rate' => $i->rate,
                'amount' => $i->amount,
            ])),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
