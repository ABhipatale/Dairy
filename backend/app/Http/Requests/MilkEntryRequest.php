<?php

namespace App\Http\Requests;

use App\Services\SettingsService;
use App\Support\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MilkEntryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isUpdate = $this->isMethod('put') || $this->isMethod('patch');
        $max = (float) app(SettingsService::class)->value('milk', 'max_quantity', 200);
        $tenantId = app(TenantContext::class)->id();
        $today = now(app(TenantContext::class)->tenant()?->timezone)->toDateString();

        return [
            // Customer must exist IN THIS TENANT — never trust a raw id from the client.
            'customer_id' => [$isUpdate ? 'prohibited' : 'required', 'integer',
                Rule::exists('customers', 'id')->where('tenant_id', $tenantId)->whereNull('deleted_at')],
            'entry_date' => [$isUpdate ? 'sometimes' : 'required', 'date_format:Y-m-d', 'before_or_equal:'.$today, 'after:2000-01-01'],
            'session' => [$isUpdate ? 'sometimes' : 'required', Rule::in(['morning', 'evening'])],
            'quantity' => [$isUpdate ? 'sometimes' : 'required', 'numeric', 'gt:0', 'max:'.$max],
            'fat' => ['nullable', 'numeric', 'between:0,15'],
            'snf' => ['nullable', 'numeric', 'between:0,15'],
            'rate' => ['nullable', 'numeric', 'gt:0', 'max:10000'],
            'notes' => ['nullable', 'string', 'max:255'],
            'client_uuid' => ['nullable', 'uuid'],
        ];
    }
}
