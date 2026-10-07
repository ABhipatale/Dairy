<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\MilkEntry;
use App\Models\Role;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenancyTest extends TestCase
{
    public function test_tenant_only_sees_its_own_customers(): void
    {
        $a = $this->makeTenant();
        $b = $this->makeTenant();
        $this->customer($a, ['name' => 'Alpha Farmer']);
        $this->customer($b, ['name' => 'Beta Farmer']);

        $this->actingAsTenant($a);

        $names = collect($this->getJson('/api/v1/customers')->assertOk()->json('data'))->pluck('name');
        $this->assertEquals(['Alpha Farmer'], $names->all());

        $lookup = collect($this->getJson('/api/v1/customers/lookup')->json('data'))->pluck('name');
        $this->assertEquals(['Alpha Farmer'], $lookup->all());
    }

    public function test_tenant_a_cannot_read_or_modify_tenant_b_records(): void
    {
        $a = $this->makeTenant();
        $b = $this->makeTenant();
        $foreign = $this->customer($b);
        $this->price($b, 'both', 50);
        $foreignPrice = $this->inTenant($b, fn () => \App\Models\MilkPrice::query()->first());

        $this->actingAsTenant($a);

        $this->getJson("/api/v1/customers/{$foreign->id}")->assertNotFound();
        $this->putJson("/api/v1/customers/{$foreign->id}", ['name' => 'Hacked'])->assertNotFound();
        $this->deleteJson("/api/v1/customers/{$foreign->id}")->assertNotFound();
        $this->putJson("/api/v1/milk-prices/{$foreignPrice->id}", ['effective_from' => '2026-01-01', 'session' => 'both', 'method' => 'fixed', 'rate' => 1])->assertNotFound();

        $this->assertSame($foreign->name, Customer::withoutGlobalScopes()->find($foreign->id)->name);
    }

    public function test_cannot_create_milk_entry_for_another_tenants_customer(): void
    {
        $a = $this->makeTenant();
        $b = $this->makeTenant();
        $foreign = $this->customer($b);
        $this->price($a, 'both', 50);

        $this->actingAsTenant($a);

        $this->entry(['customer_id' => $foreign->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 5])
            ->assertStatus(422)->assertJsonValidationErrors('customer_id');

        $this->assertSame(0, MilkEntry::withoutGlobalScopes()->count());
    }

    public function test_tenant_id_in_payload_is_ignored(): void
    {
        $a = $this->makeTenant();
        $b = $this->makeTenant();
        $this->actingAsTenant($a);

        $id = $this->postJson('/api/v1/customers', ['name' => 'Sneaky', 'tenant_id' => $b->id])->assertCreated()->json('data.id');

        $this->assertSame($a->id, Customer::withoutGlobalScopes()->find($id)->tenant_id);
    }

    public function test_reports_and_dashboard_are_tenant_specific(): void
    {
        $a = $this->makeTenant();
        $b = $this->makeTenant();
        $ca = $this->customer($a);
        $cb = $this->customer($b);
        $this->price($a, 'both', 50);
        $this->price($b, 'both', 50);

        $this->actingAsTenant($b);
        $this->entry(['customer_id' => $cb->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 100])->assertCreated();

        $this->actingAsTenant($a);
        $this->entry(['customer_id' => $ca->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 4])->assertCreated();

        $this->getJson('/api/v1/reports/daily?date_from=2026-10-07')->assertOk()
            ->assertJsonPath('summary.total_milk', '4.00')
            ->assertJsonPath('summary.total_customers', 1);

        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('today.milk', '4.00');
    }

    public function test_super_admin_resets_the_company_login(): void
    {
        $tenant = $this->makeTenant();
        $login = $this->makeUser($tenant, Role::ADMIN, ['mobile' => '9876543210']);
        $oldToken = $login->createToken('phone')->plainTextToken;

        Sanctum::actingAs(User::factory()->role(Role::SUPER_ADMIN)->create());

        $this->getJson("/api/v1/admin/tenants/{$tenant->id}/login")->assertOk()->assertJsonPath('data.mobile', '9876543210');
        $this->putJson("/api/v1/admin/tenants/{$tenant->id}/login", ['mobile' => '98765 00011', 'password' => 'NewPass123'])
            ->assertOk()->assertJsonPath('data.mobile', '9876500011');

        // Old sessions are signed out; the new credentials work.
        $this->assertSame(0, $login->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/login', ['login' => '9876500011', 'password' => 'NewPass123'])->assertOk();
        $this->assertNotEmpty($oldToken);
    }

    public function test_company_login_cannot_use_super_admin_login_management(): void
    {
        $a = $this->makeTenant();
        $b = $this->makeTenant();
        $this->makeUser($b, Role::ADMIN);
        $this->actingAsTenant($a);

        $this->putJson("/api/v1/admin/tenants/{$b->id}/login", ['password' => 'Hijack123'])->assertForbidden();
    }

    public function test_super_admin_and_tenant_routes_are_separated(): void
    {
        $tenant = $this->makeTenant();
        $this->actingAsTenant($tenant);
        $this->getJson('/api/v1/admin/tenants')->assertForbidden();

        $super = User::factory()->role(Role::SUPER_ADMIN)->create();
        Sanctum::actingAs($super);
        $this->getJson('/api/v1/admin/tenants')->assertOk();
        $this->getJson('/api/v1/customers')->assertForbidden()->assertJsonPath('code', 'tenant_required');
    }

    public function test_deactivated_tenant_is_blocked_immediately(): void
    {
        $tenant = $this->makeTenant();
        $user = $this->actingAsTenant($tenant);
        $this->getJson('/api/v1/customers')->assertOk();

        $tenant->update(['status' => 'suspended']);
        $user->unsetRelation('tenant');

        $this->getJson('/api/v1/customers')->assertForbidden()->assertJsonPath('code', 'tenant_inactive');
    }

    public function test_super_admin_creates_company_with_first_admin(): void
    {
        Sanctum::actingAs(User::factory()->role(Role::SUPER_ADMIN)->create());

        $this->postJson('/api/v1/admin/tenants', [
            'name' => 'Krishna Dairy',
            'default_language' => 'mr',
            'admin_name' => 'Owner',
            'admin_mobile' => '9123456780',
            'admin_password' => 'Secret123',
        ])->assertCreated()->assertJsonPath('data.slug', 'krishna-dairy');

        $admin = User::query()->where('mobile', '9123456780')->first();
        $this->assertNotNull($admin->tenant_id);
        $this->assertSame(Role::ADMIN, $admin->role->name);
    }
}
