<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/** Company profile: used by super admin (full) and company admin (own profile, limited). */
class TenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isAdminRoute = $this->is('api/v1/admin/*');
        $creating = $isAdminRoute && $this->isMethod('post');

        $rules = [
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:150'],
            'owner_name' => ['nullable', 'string', 'max:150'],
            'mobile' => ['nullable', 'string', 'max:20'],
            'whatsapp_number' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'pincode' => ['nullable', 'string', 'max:12'],
            'gst_number' => ['nullable', 'string', 'max:20', 'regex:/^[0-9A-Z]{15}$/'],
            'currency' => ['nullable', 'string', 'size:3'],
            'timezone' => ['nullable', 'timezone'],
            'default_language' => ['nullable', Rule::in(['en', 'mr', 'hi'])],
            'invoice_footer' => ['nullable', 'string', 'max:500'],
            'thank_you_message' => ['nullable', 'string', 'max:255'],
            'logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:1024'],
            'remove_logo' => ['sometimes', 'boolean'],
        ];

        if ($isAdminRoute) {
            $rules += [
                'status' => ['sometimes', Rule::in(['active', 'inactive', 'suspended'])],
                'plan' => ['nullable', 'string', 'max:50'],
                'subscription_ends_at' => ['nullable', 'date'],
            ];
        }

        if ($creating) {
            // First admin user created together with the company.
            $rules += [
                'admin_name' => ['required', 'string', 'max:150'],
                'admin_mobile' => ['required', 'digits_between:10,13', 'unique:users,mobile'],
                'admin_email' => ['nullable', 'email', 'unique:users,email'],
                'admin_password' => ['required', Password::min(8)->letters()->numbers()],
            ];
        }

        return $rules;
    }
}
