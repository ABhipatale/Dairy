<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Http\Resources\TenantResource;
use App\Http\Resources\UserResource;
use App\Models\Language;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Pricing\PricingService;
use App\Services\SettingsService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function __construct(
        private readonly SettingsService $settings,
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login' => ['required', 'string', 'max:150'],
            'password' => ['required', 'string', 'max:255'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $login = trim($data['login']);
        $field = str_contains($login, '@') ? 'email' : 'mobile';
        $value = $field === 'mobile' ? preg_replace('/\D+/', '', $login) : strtolower($login);

        $user = User::query()->with(['role', 'tenant'])->where($field, $value)->first();

        // Same error for unknown user and wrong password (no account enumeration).
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw new BusinessException('invalid_credentials', 422);
        }

        if (! $user->is_active) {
            throw new BusinessException('account_inactive', 403);
        }

        if ($user->tenant_id && ! $user->tenant?->isActive()) {
            throw new BusinessException('tenant_inactive', 403);
        }

        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        $expiry = (int) config('sanctum.expiration');
        $token = $user->createToken(
            $data['device_name'] ?? 'pwa',
            ['*'],
            $expiry ? now()->addMinutes($expiry) : null,
        )->plainTextToken;

        $this->audit->log('auth.login', 'user', $user->id, [], [], $user->tenant_id);

        return response()->json(['token' => $token] + $this->session($user));
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->session($request->user()->load(['role', 'tenant'])));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'language' => ['sometimes', 'nullable', Rule::in(['en', 'mr', 'hi'])],
            'current_password' => ['required_with:password', 'current_password'],
            'password' => ['sometimes', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        unset($data['current_password']);
        $user->update($data);

        if (isset($data['password'])) {
            // Sign out other devices after a password change.
            $user->tokens()->where('id', '!=', $user->currentAccessToken()?->id)->delete();
        }

        return response()->json($this->session($user->fresh(['role', 'tenant'])));
    }

    /** Everything the PWA needs after login, in one round trip. */
    private function session(User $user): array
    {
        $tenant = $user->tenant;

        $payload = [
            'user' => new UserResource($user),
            'permissions' => $user->isSuperAdmin() ? ['*'] : $user->permissionNames(),
            'is_super_admin' => $user->isSuperAdmin(),
            'languages' => Language::query()->where('is_active', true)->orderBy('sort_order')->get(['code', 'name', 'native_name', 'is_default']),
            'platform' => $this->settings->forClient('platform', null),
        ];

        if ($tenant) {
            $this->context->set($tenant);
            $payload['tenant'] = new TenantResource($tenant);
            $payload['settings'] = collect(['milk', 'billing', 'printer', 'general'])
                ->mapWithKeys(fn ($g) => [$g => $this->settings->forClient($g, $tenant->id)])
                ->put('whatsapp', array_intersect_key($this->settings->forClient('whatsapp', $tenant->id), array_flip(['enabled', 'country_code', 'auto_send'])))
                ->all();
            $payload['prices'] = app(PricingService::class)->current(now($tenant->timezone)->toDateString());
            $payload['server_date'] = now($tenant->timezone)->toDateString();
        }

        return $payload;
    }
}
