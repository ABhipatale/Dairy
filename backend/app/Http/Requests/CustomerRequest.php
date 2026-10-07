<?php

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Policy is checked in the controller.
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'mobile' => $this->digits('mobile'),
            'whatsapp' => $this->digits('whatsapp'),
            'code' => $this->filled('code') ? trim((string) $this->input('code')) : null,
        ]);
    }

    public function rules(): array
    {
        $tenantId = app(TenantContext::class)->id();
        $id = $this->route('customer')?->id;

        return [
            'code' => [
                'nullable', 'string', 'max:20', 'regex:/^[A-Za-z0-9\-\/]+$/',
                Rule::unique('customers', 'code')->where('tenant_id', $tenantId)->ignore($id),
            ],
            'name' => ['required', 'string', 'max:150'],
            'mobile' => ['nullable', 'digits_between:10,13'],
            'whatsapp' => ['nullable', 'digits_between:10,13'],
            'address' => ['nullable', 'string', 'max:500'],
            'village' => ['nullable', 'string', 'max:120'],
            'opening_balance' => ['nullable', 'numeric', 'between:-9999999,9999999'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    private function digits(string $key): ?string
    {
        $v = preg_replace('/\D+/', '', (string) $this->input($key));

        return $v === '' ? null : $v;
    }
}
