<?php

namespace Tests\Feature;

use App\Models\Role;
use Tests\TestCase;

class AuthTest extends TestCase
{
    public function test_user_can_log_in_with_mobile_and_receives_session_bundle(): void
    {
        $tenant = $this->makeTenant();
        $this->makeUser($tenant, Role::ADMIN, ['mobile' => '9876543210']);

        $res = $this->postJson('/api/v1/auth/login', ['login' => '98765 43210', 'password' => 'Password@123']);

        $res->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'role'], 'permissions', 'tenant', 'settings' => ['milk', 'printer'], 'prices'])
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('is_super_admin', false);

        // The one company login can do everything.
        foreach (['milk.create', 'milk.delete', 'bills.manage', 'payments.manage', 'reports.view', 'settings.manage'] as $perm) {
            $this->assertContains($perm, $res->json('permissions'));
        }
    }

    public function test_wrong_password_returns_friendly_error_without_revealing_account(): void
    {
        $tenant = $this->makeTenant();
        $this->makeUser($tenant, Role::ADMIN, ['mobile' => '9876543210']);

        $this->postJson('/api/v1/auth/login', ['login' => '9876543210', 'password' => 'nope'])
            ->assertStatus(422)->assertJsonPath('code', 'invalid_credentials');

        $this->postJson('/api/v1/auth/login', ['login' => '9999999999', 'password' => 'nope'])
            ->assertStatus(422)->assertJsonPath('code', 'invalid_credentials');
    }

    public function test_inactive_user_and_inactive_tenant_cannot_log_in(): void
    {
        $tenant = $this->makeTenant();
        $this->makeUser($tenant, Role::ADMIN, ['mobile' => '9000000001', 'is_active' => false]);
        $this->postJson('/api/v1/auth/login', ['login' => '9000000001', 'password' => 'Password@123'])
            ->assertStatus(403)->assertJsonPath('code', 'account_inactive');

        $closed = $this->makeTenant(['status' => 'inactive']);
        $this->makeUser($closed, Role::ADMIN, ['mobile' => '9000000002']);
        $this->postJson('/api/v1/auth/login', ['login' => '9000000002', 'password' => 'Password@123'])
            ->assertStatus(403)->assertJsonPath('code', 'tenant_inactive');
    }

    public function test_logout_revokes_the_token(): void
    {
        $tenant = $this->makeTenant();
        $this->makeUser($tenant, Role::ADMIN, ['mobile' => '9876543210']);
        $token = $this->postJson('/api/v1/auth/login', ['login' => '9876543210', 'password' => 'Password@123'])->json('token');

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();
        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertStatus(401)->assertJsonPath('code', 'session_expired');
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/customers')->assertStatus(401);
        $this->getJson('/api/v1/admin/tenants')->assertStatus(401);
    }

    public function test_company_login_manages_everything_and_cannot_add_staff_logins(): void
    {
        $tenant = $this->makeTenant();
        $this->actingAsTenant($tenant);

        $this->getJson('/api/v1/settings')->assertOk();
        $this->getJson('/api/v1/reports/daily')->assertOk();
        $this->getJson('/api/v1/payments')->assertOk();
        $this->getJson('/api/v1/audit-logs')->assertOk();

        // One login per company: there is no staff-user API.
        $this->getJson('/api/v1/users')->assertNotFound();
        $this->postJson('/api/v1/users', ['name' => 'x', 'mobile' => '9111111111', 'password' => 'Secret123'])->assertNotFound();
    }

    public function test_login_is_rate_limited(): void
    {
        foreach (range(1, 5) as $_) {
            $this->postJson('/api/v1/auth/login', ['login' => '9111111111', 'password' => 'x']);
        }

        $this->postJson('/api/v1/auth/login', ['login' => '9111111111', 'password' => 'x'])
            ->assertStatus(429)->assertJsonPath('code', 'too_many_requests');
    }
}
