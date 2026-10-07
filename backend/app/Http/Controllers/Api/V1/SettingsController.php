<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\TenantRequest;
use App\Http\Resources\TenantResource;
use App\Services\SettingsService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    /** Groups a company admin may edit (platform is super-admin only). */
    private const TENANT_GROUPS = ['milk', 'billing', 'printer', 'whatsapp', 'general'];

    public function __construct(
        private readonly SettingsService $settings,
        private readonly TenantContext $context,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'company' => new TenantResource($this->context->tenant()),
            'settings' => collect(self::TENANT_GROUPS)->mapWithKeys(fn ($g) => [$g => $this->settings->forClient($g)]),
        ]);
    }

    public function update(Request $request, string $group): JsonResponse
    {
        abort_unless(in_array($group, self::TENANT_GROUPS, true), 404);

        $data = $request->validate($this->rules($group));

        return response()->json(['data' => $this->settings->set($group, $data)]);
    }

    public function updateCompany(TenantRequest $request): JsonResponse
    {
        $tenant = $this->context->tenant();
        $data = collect($request->validated())->except(['logo', 'remove_logo', 'status', 'plan', 'subscription_ends_at'])->all();

        $tenant->fill($data);
        self::storeLogo($request, $tenant);
        $tenant->save();

        return response()->json(['data' => new TenantResource($tenant)]);
    }

    public static function storeLogo(Request $request, \App\Models\Tenant $tenant): void
    {
        if ($request->boolean('remove_logo') && $tenant->logo_path) {
            Storage::disk('public')->delete($tenant->logo_path);
            $tenant->logo_path = null;
        }

        if ($request->hasFile('logo')) {
            if ($tenant->logo_path) {
                Storage::disk('public')->delete($tenant->logo_path);
            }
            $tenant->logo_path = $request->file('logo')->storeAs(
                'logos',
                ($tenant->id ?: 'new').'-'.Str::random(12).'.'.$request->file('logo')->extension(),
                'public',
            );
        }
    }

    private function rules(string $group): array
    {
        return match ($group) {
            'milk' => [
                'fat_enabled' => ['sometimes', 'boolean'],
                'fat_required' => ['sometimes', 'boolean'],
                'allow_rate_override' => ['sometimes', 'boolean'],
                'max_quantity' => ['sometimes', 'numeric', 'between:1,10000'],
                'evening_starts_at' => ['sometimes', 'date_format:H:i'],
            ],
            'billing' => [
                'show_fat_on_bill' => ['sometimes', 'boolean'],
            ],
            'printer' => [
                'paper_size' => ['sometimes', Rule::in(['58mm', '80mm'])],
                'connection_type' => ['sometimes', Rule::in(['browser', 'bluetooth'])],
                'auto_print' => ['sometimes', 'boolean'],
                'print_logo' => ['sometimes', 'boolean'],
                'print_customer_mobile' => ['sometimes', 'boolean'],
                'copies' => ['sometimes', 'integer', 'between:1,3'],
            ],
            'whatsapp' => [
                'enabled' => ['sometimes', 'boolean'],
                'auto_send' => ['sometimes', 'boolean'],
            ],
            'general' => [
                'receipt_language' => ['sometimes', 'nullable', Rule::in(['en', 'mr', 'hi'])],
            ],
        };
    }
}
