<?php

namespace Tests\Feature;

use App\Models\MilkEntry;
use App\Models\Role;
use Illuminate\Support\Str;
use Tests\TestCase;

class MilkEntryTest extends TestCase
{
    private function setupTenant(string $role = Role::ADMIN): array
    {
        $tenant = $this->makeTenant();
        $customer = $this->customer($tenant, ['name' => 'Ramesh Patil']);
        $this->price($tenant, 'morning', 52);
        $this->price($tenant, 'evening', 54);
        $this->actingAsTenant($tenant, $role);

        return [$tenant, $customer];
    }

    public function test_morning_entry_calculates_amount_from_morning_rate(): void
    {
        [, $c] = $this->setupTenant();

        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 5.5, 'fat' => 6.2])
            ->assertCreated()
            ->assertJsonPath('data.rate', '52.00')
            ->assertJsonPath('data.amount', '286.00')
            ->assertJsonPath('data.fat', '6.20')
            ->assertJsonPath('data.rate_source', 'auto');
    }

    public function test_morning_and_evening_are_separate_entries_with_their_own_rates(): void
    {
        [, $c] = $this->setupTenant();

        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 5.5])->assertCreated();
        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'evening', 'quantity' => 4.5])
            ->assertCreated()
            ->assertJsonPath('data.rate', '54.00')
            ->assertJsonPath('data.amount', '243.00');

        $this->assertSame(2, MilkEntry::query()->count());
    }

    public function test_duplicate_session_entry_is_rejected(): void
    {
        [, $c] = $this->setupTenant();
        $payload = ['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 5];

        $first = $this->entry($payload)->assertCreated()->json('data.id');
        $this->entry($payload)->assertStatus(409)
            ->assertJsonPath('code', 'duplicate_entry')
            ->assertJsonPath('context.existing_id', $first);
    }

    public function test_offline_replay_with_same_client_uuid_is_idempotent(): void
    {
        [, $c] = $this->setupTenant();
        $uuid = (string) Str::uuid();
        $payload = ['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 5, 'client_uuid' => $uuid];

        $id = $this->entry($payload)->assertCreated()->json('data.id');
        $this->entry($payload)->assertOk()->assertJsonPath('data.id', $id)->assertJsonPath('meta.duplicate_replay', true);

        $this->assertSame(1, MilkEntry::query()->count());
    }

    public function test_batch_sync_reports_each_entry_individually(): void
    {
        [, $c] = $this->setupTenant();
        $u1 = (string) Str::uuid();
        $u2 = (string) Str::uuid();
        $u3 = (string) Str::uuid();

        $res = $this->postJson('/api/v1/milk-entries/sync', ['entries' => [
            ['client_uuid' => $u1, 'customer_id' => $c->id, 'entry_date' => '2026-10-06', 'session' => 'morning', 'quantity' => 5],
            ['client_uuid' => $u2, 'customer_id' => $c->id, 'entry_date' => '2026-10-06', 'session' => 'morning', 'quantity' => 6],
            ['client_uuid' => $u3, 'customer_id' => $c->id, 'entry_date' => '2026-10-06', 'session' => 'evening', 'quantity' => -1],
        ]])->assertOk();

        $this->assertEquals(['created', 'rejected', 'rejected'], collect($res->json('results'))->pluck('status')->all());
        $this->assertSame('duplicate_entry', $res->json('results.1.code'));

        // Re-sending the whole batch must not create anything new.
        $this->postJson('/api/v1/milk-entries/sync', ['entries' => [
            ['client_uuid' => $u1, 'customer_id' => $c->id, 'entry_date' => '2026-10-06', 'session' => 'morning', 'quantity' => 5],
        ]])->assertJsonPath('results.0.status', 'duplicate_replay');

        $this->assertSame(1, MilkEntry::query()->count());
    }

    public function test_price_change_does_not_alter_existing_entries(): void
    {
        [$tenant, $c] = $this->setupTenant();

        $id = $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-06', 'session' => 'morning', 'quantity' => 10])
            ->assertCreated()->json('data.id');

        $this->postJson('/api/v1/milk-prices', ['effective_from' => '2026-10-07', 'session' => 'morning', 'method' => 'fixed', 'rate' => 60])->assertCreated();

        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 10])
            ->assertJsonPath('data.amount', '600.00');

        $old = MilkEntry::query()->find($id);
        $this->assertSame('52.00', $old->rate);
        $this->assertSame('520.00', $old->amount);
    }

    public function test_session_specific_price_beats_both_on_same_date(): void
    {
        $tenant = $this->makeTenant();
        $c = $this->customer($tenant);
        $this->price($tenant, 'both', 50, '2026-10-01');
        $this->price($tenant, 'evening', 58, '2026-10-01');
        $this->actingAsTenant($tenant);

        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 1])->assertJsonPath('data.rate', '50.00');
        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'evening', 'quantity' => 1])->assertJsonPath('data.rate', '58.00');
    }

    public function test_fat_based_pricing(): void
    {
        $tenant = $this->makeTenant();
        $c = $this->customer($tenant);
        $this->price($tenant, 'both', 0, '2026-10-01', ['method' => 'fat', 'rate' => null, 'fat_rate' => 8.5, 'min_rate' => 40]);
        $this->actingAsTenant($tenant);

        // 6.2 × 8.50 = 52.70/L → 5 L = 263.50
        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 5, 'fat' => 6.2])
            ->assertJsonPath('data.rate', '52.70')
            ->assertJsonPath('data.amount', '263.50')
            ->assertJsonPath('data.pricing_method', 'fat');

        // 3.0 × 8.50 = 25.50 → floored to min rate 40
        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'evening', 'quantity' => 2, 'fat' => 3.0])
            ->assertJsonPath('data.rate', '40.00');
    }

    public function test_manual_rate_override_is_flagged(): void
    {
        [, $c] = $this->setupTenant();

        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 2, 'rate' => 55])
            ->assertJsonPath('data.rate_source', 'manual')
            ->assertJsonPath('data.amount', '110.00');
    }

    public function test_missing_price_gives_clear_message(): void
    {
        $tenant = $this->makeTenant();
        $c = $this->customer($tenant);
        $this->actingAsTenant($tenant);

        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 2])
            ->assertStatus(422)->assertJsonPath('code', 'no_price_set');
    }

    public function test_validation_rejects_bad_input_and_future_dates(): void
    {
        [, $c] = $this->setupTenant();

        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-08', 'session' => 'night', 'quantity' => 0])
            ->assertStatus(422)->assertJsonValidationErrors(['entry_date', 'session', 'quantity']);
    }

    public function test_inactive_customer_cannot_receive_entries(): void
    {
        $tenant = $this->makeTenant();
        $c = $this->customer($tenant, ['status' => 'inactive']);
        $this->price($tenant, 'both', 50);
        $this->actingAsTenant($tenant);

        $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 2])
            ->assertStatus(422)->assertJsonPath('code', 'customer_inactive');
    }

    public function test_company_login_can_edit_and_delete_entries(): void
    {
        [, $c] = $this->setupTenant();
        $id = $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 2])->json('data.id');

        $this->putJson("/api/v1/milk-entries/{$id}", ['quantity' => 3])->assertOk()->assertJsonPath('data.amount', '156.00');
        $this->deleteJson("/api/v1/milk-entries/{$id}")->assertOk();
    }

    public function test_entries_on_a_bill_are_locked(): void
    {
        [, $c] = $this->setupTenant();
        $id = $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-02', 'session' => 'morning', 'quantity' => 2])->json('data.id');
        $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-10-01'])->assertCreated();

        $this->putJson("/api/v1/milk-entries/{$id}", ['quantity' => 3])->assertStatus(409)->assertJsonPath('code', 'entry_locked');
        $this->deleteJson("/api/v1/milk-entries/{$id}")->assertStatus(409);
    }

    public function test_entry_changes_are_audited(): void
    {
        [, $c] = $this->setupTenant();
        $id = $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 2])->json('data.id');
        $this->putJson("/api/v1/milk-entries/{$id}", ['quantity' => 3]);
        $this->deleteJson("/api/v1/milk-entries/{$id}")->assertOk();

        $actions = collect($this->getJson('/api/v1/audit-logs?entity_type=milk_entry')->json('data'))->pluck('action');
        $this->assertEqualsCanonicalizing(['milk_entry.created', 'milk_entry.updated', 'milk_entry.deleted'], $actions->all());
    }

    public function test_entry_receipt_pdf_and_whatsapp_link(): void
    {
        [, $c] = $this->setupTenant();
        $id = $this->entry(['customer_id' => $c->id, 'entry_date' => '2026-10-07', 'session' => 'morning', 'quantity' => 5.5, 'fat' => 6.2])->json('data.id');

        $pdf = $this->get("/api/v1/milk-entries/{$id}/pdf")->assertOk();
        $this->assertStringStartsWith('%PDF', $pdf->getContent());

        $wa = $this->postJson("/api/v1/milk-entries/{$id}/whatsapp")->assertOk()->assertJsonPath('mode', 'link');
        $this->assertStringStartsWith('https://wa.me/91', $wa->json('url'));
        $this->assertStringContainsString('Ramesh Patil', $wa->json('message'));
        $this->assertStringContainsString('₹286.00', $wa->json('message'));
    }
}
