<?php

namespace Tests;

use App\Models\Customer;
use App\Models\MilkPrice;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use Database\Seeders\LanguageSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesAndPermissionsSeeder::class, LanguageSeeder::class]);
        $this->travelTo('2026-10-07 09:00:00');
    }

    protected function makeTenant(array $attrs = []): Tenant
    {
        return Tenant::factory()->create($attrs);
    }

    protected function makeUser(Tenant $tenant, string $role = Role::ADMIN, array $attrs = []): User
    {
        $user = User::factory()->role($role)->make($attrs);
        $user->tenant_id = $tenant->id;
        $user->save();

        return $user;
    }

    /** Authenticate as a tenant user (Sanctum token guard). */
    protected function actingAsTenant(Tenant $tenant, string $role = Role::ADMIN): User
    {
        $user = $this->makeUser($tenant, $role);
        Sanctum::actingAs($user);

        return $user;
    }

    /** Run setup code (factories) inside a tenant without leaking context into the request. */
    protected function inTenant(Tenant $tenant, callable $callback): mixed
    {
        return app(TenantContext::class)->runAs($tenant, $callback);
    }

    protected function customer(Tenant $tenant, array $attrs = []): Customer
    {
        return $this->inTenant($tenant, fn () => Customer::factory()->create($attrs));
    }

    protected function price(Tenant $tenant, string $session, float $rate, string $from = '2026-01-01', array $attrs = []): MilkPrice
    {
        return $this->inTenant($tenant, fn () => MilkPrice::query()->create(array_merge([
            'effective_from' => $from, 'session' => $session, 'method' => 'fixed', 'rate' => $rate,
        ], $attrs)));
    }

    protected function entry(array $data): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/v1/milk-entries', $data);
    }
}
