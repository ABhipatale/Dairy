<?php

namespace App\Http\Requests;

use App\Models\Payment;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tenantId = app(TenantContext::class)->id();
        $today = now(app(TenantContext::class)->tenant()?->timezone)->toDateString();

        return [
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->where('tenant_id', $tenantId)],
            'bill_id' => ['nullable', 'integer', Rule::exists('bills', 'id')->where('tenant_id', $tenantId)],
            'payment_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.$today],
            'amount' => ['required', 'numeric', 'gt:0', 'max:99999999'],
            'method' => ['required', Rule::in(Payment::METHODS)],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:255'],
        ];
    }
}
