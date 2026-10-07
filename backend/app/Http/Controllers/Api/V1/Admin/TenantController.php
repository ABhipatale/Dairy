<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Controller;
use App\Http\Requests\TenantRequest;
use App\Http\Resources\TenantResource;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Super admin: dairy companies (tenants) and each company's single login.
 * Runs without a TenantContext, so tenant-scoped models are queried with explicit tenant_id.
 */
class TenantController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $f = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'suspended'])],
        ]);

        $tenants = Tenant::query()
            ->withCount(['users', 'customers'])
            ->when($f['search'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$s}%")->orWhere('owner_name', 'like', "%{$s}%")
                ->orWhere('mobile', 'like', "%{$s}%")->orWhere('city', 'like', "%{$s}%")))
            ->when($f['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        return TenantResource::collection($tenants);
    }

    public function show(Tenant $tenant): JsonResponse
    {
        $tenant->loadCount(['users', 'customers']);

        $stats = [
            'entries_30d' => DB::table('milk_entries')->where('tenant_id', $tenant->id)->where('entry_date', '>=', now()->subDays(30)->toDateString())->count(),
            'milk_30d' => (float) DB::table('milk_entries')->where('tenant_id', $tenant->id)->where('entry_date', '>=', now()->subDays(30)->toDateString())->sum('quantity'),
            'revenue_30d' => (float) DB::table('milk_entries')->where('tenant_id', $tenant->id)->where('entry_date', '>=', now()->subDays(30)->toDateString())->sum('amount'),
            'bills' => DB::table('bills')->where('tenant_id', $tenant->id)->where('status', '!=', 'cancelled')->count(),
            'last_entry_at' => DB::table('milk_entries')->where('tenant_id', $tenant->id)->max('created_at'),
        ];

        return response()->json(['data' => new TenantResource($tenant), 'stats' => $stats]);
    }

    /** Creates the company and its first admin user in one transaction. */
    public function store(TenantRequest $request): JsonResponse
    {
        $data = $request->validated();

        $tenant = DB::transaction(function () use ($data, $request) {
            $tenant = new Tenant(collect($data)->except(['logo', 'remove_logo', 'admin_name', 'admin_mobile', 'admin_email', 'admin_password'])->all());
            $tenant->slug = $this->uniqueSlug($data['name']);
            $tenant->save();

            if ($request->hasFile('logo')) {
                SettingsController::storeLogo($request, $tenant);
                $tenant->save();
            }

            $admin = new User([
                'name' => $data['admin_name'],
                'mobile' => $data['admin_mobile'],
                'email' => $data['admin_email'] ?? null,
                'password' => $data['admin_password'],
                'role_id' => Role::idFor(Role::ADMIN),
                'language' => $data['default_language'] ?? 'en',
                'is_active' => true,
            ]);
            $admin->tenant_id = $tenant->id;
            $admin->save();

            return $tenant;
        });

        return (new TenantResource($tenant->loadCount(['users', 'customers'])))->response()->setStatusCode(201);
    }

    public function update(TenantRequest $request, Tenant $tenant): TenantResource
    {
        $tenant->fill(collect($request->validated())->except(['logo', 'remove_logo'])->all());
        SettingsController::storeLogo($request, $tenant);
        $tenant->save();

        if ($tenant->wasChanged('status') && $tenant->status !== 'active') {
            // Force everyone in a deactivated company out immediately.
            DB::table('personal_access_tokens')
                ->where('tokenable_type', (new User)->getMorphClass())
                ->whereIn('tokenable_id', User::query()->where('tenant_id', $tenant->id)->select('id'))
                ->delete();
        }

        return new TenantResource($tenant->loadCount(['users', 'customers']));
    }

    /** Soft delete: data is kept and can be restored by support. */
    public function destroy(Tenant $tenant): JsonResponse
    {
        $tenant->update(['status' => 'inactive']);
        $tenant->delete();

        return response()->json(['deleted' => true]);
    }

    /** The company's single login. */
    public function login(Tenant $tenant): UserResource
    {
        return new UserResource($this->companyLogin($tenant)->load('role'));
    }

    /** Super admin resets the company login: mobile/email/name/password, or blocks it. */
    public function updateLogin(Request $request, Tenant $tenant): UserResource
    {
        $user = $this->companyLogin($tenant);

        if ($request->has('mobile')) {
            $request->merge(['mobile' => preg_replace('/\D+/', '', (string) $request->input('mobile'))]);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'mobile' => ['sometimes', 'digits_between:10,13', Rule::unique('users', 'mobile')->ignore($user->id)],
            'email' => ['sometimes', 'nullable', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', Password::min(8)->letters()->numbers()],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $user->update($data);

        // New password or blocked login: sign the company out everywhere.
        if (isset($data['password']) || (isset($data['is_active']) && ! $data['is_active'])) {
            $user->tokens()->delete();
        }

        return new UserResource($user->load('role'));
    }

    private function companyLogin(Tenant $tenant): User
    {
        return $tenant->users()->oldest('id')->firstOrFail();
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'dairy';
        $slug = $base;
        $i = 2;

        while (Tenant::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
