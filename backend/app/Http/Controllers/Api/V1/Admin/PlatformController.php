<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Language;
use App\Models\Tenant;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Super admin: system statistics, languages and global settings. */
class PlatformController extends Controller
{
    public function stats(): JsonResponse
    {
        $since = now()->subDays(30)->toDateString();

        $topTenants = DB::table('milk_entries')
            ->join('tenants', 'tenants.id', '=', 'milk_entries.tenant_id')
            ->where('entry_date', '>=', $since)
            ->groupBy('tenants.id', 'tenants.name')
            ->orderByDesc(DB::raw('SUM(quantity)'))
            ->limit(5)
            ->get(['tenants.id', 'tenants.name', DB::raw('SUM(quantity) as milk'), DB::raw('SUM(amount) as revenue')]);

        return response()->json([
            'tenants' => [
                'total' => Tenant::query()->count(),
                'active' => Tenant::query()->where('status', 'active')->count(),
                'inactive' => Tenant::query()->where('status', '!=', 'active')->count(),
                'expiring_soon' => Tenant::query()->whereBetween('subscription_ends_at', [now()->toDateString(), now()->addDays(15)->toDateString()])->count(),
            ],
            'users' => DB::table('users')->whereNotNull('tenant_id')->whereNull('deleted_at')->count(),
            'customers' => DB::table('customers')->whereNull('deleted_at')->count(),
            'entries_30d' => DB::table('milk_entries')->where('entry_date', '>=', $since)->count(),
            'milk_30d' => (float) DB::table('milk_entries')->where('entry_date', '>=', $since)->sum('quantity'),
            'revenue_30d' => (float) DB::table('milk_entries')->where('entry_date', '>=', $since)->sum('amount'),
            'top_tenants' => $topTenants,
            'recent_tenants' => Tenant::query()->latest('id')->limit(5)->get(['id', 'name', 'city', 'status', 'created_at']),
        ]);
    }

    public function languages(): JsonResponse
    {
        return response()->json(['data' => Language::query()->orderBy('sort_order')->get()]);
    }

    public function updateLanguage(Request $request, Language $language): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:50'],
            'native_name' => ['sometimes', 'string', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'between:0,1000'],
        ]);

        DB::transaction(function () use ($language, $data) {
            if (! empty($data['is_default'])) {
                Language::query()->update(['is_default' => false]);
                $data['is_active'] = true;
            }

            $language->update($data);
        });

        return response()->json(['data' => $language->fresh()]);
    }

    public function settings(SettingsService $settings): JsonResponse
    {
        return response()->json(['data' => $settings->forClient('platform', null)]);
    }

    public function updateSettings(Request $request, SettingsService $settings): JsonResponse
    {
        $data = $request->validate([
            'app_name' => ['sometimes', 'string', 'max:60'],
            'support_mobile' => ['sometimes', 'nullable', 'string', 'max:20'],
            'support_email' => ['sometimes', 'nullable', 'email'],
        ]);

        return response()->json(['data' => $settings->set('platform', $data, null, global: true)]);
    }

    public function audit(Request $request): JsonResponse
    {
        return response()->json(
            AuditLog::query()
                ->with('user:id,name')
                ->when($request->integer('tenant_id'), fn ($q, $t) => $q->where('tenant_id', $t))
                ->latest('id')
                ->paginate(30)
        );
    }
}
