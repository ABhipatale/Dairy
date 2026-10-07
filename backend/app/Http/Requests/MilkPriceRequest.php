<?php

namespace App\Http\Requests;

use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MilkPriceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('settings.manage');
    }

    public function rules(): array
    {
        $tenantId = app(TenantContext::class)->id();
        $id = $this->route('price')?->id;

        return [
            'effective_from' => ['required', 'date_format:Y-m-d',
                Rule::unique('milk_prices')->where('tenant_id', $tenantId)->where('session', $this->input('session'))->ignore($id)],
            'session' => ['required', Rule::in(['morning', 'evening', 'both'])],
            'method' => ['required', Rule::in(['fixed', 'fat'])],
            'rate' => ['required_if:method,fixed', 'nullable', 'numeric', 'gt:0', 'max:10000'],
            'fat_rate' => ['required_if:method,fat', 'nullable', 'numeric', 'gt:0', 'max:1000'],
            'min_rate' => ['nullable', 'numeric', 'gte:0', 'max:10000'],
            'notes' => ['nullable', 'string', 'max:255'],
        ];
    }
}
