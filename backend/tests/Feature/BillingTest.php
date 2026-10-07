<?php

namespace Tests\Feature;

use App\Models\Bill;
use App\Models\MilkEntry;
use Tests\TestCase;

class BillingTest extends TestCase
{
    private function seedEntries($customer, array $days, float $qty = 5): void
    {
        foreach ($days as $day) {
            foreach (['morning', 'evening'] as $s) {
                $this->entry(['customer_id' => $customer->id, 'entry_date' => sprintf('2026-09-%02d', $day), 'session' => $s, 'quantity' => $qty])->assertCreated();
            }
        }
    }

    private function setupTenant(float $opening = 0): array
    {
        $tenant = $this->makeTenant();
        $c = $this->customer($tenant, ['opening_balance' => $opening]);
        $this->price($tenant, 'morning', 50);
        $this->price($tenant, 'evening', 50);
        $this->actingAsTenant($tenant);

        return [$tenant, $c];
    }

    public function test_preview_suggests_oldest_unbilled_period_and_saves_nothing(): void
    {
        [, $c] = $this->setupTenant();
        $this->seedEntries($c, [9, 10, 11]);

        $res = $this->postJson('/api/v1/bills/preview', ['customer_id' => $c->id])->assertOk();

        $res->assertJsonPath('period.start', '2026-09-01')
            ->assertJsonPath('period.end', '2026-09-10')
            ->assertJsonPath('preview.entry_count', 4)
            ->assertJsonPath('preview.total_qty', '20.00')
            ->assertJsonPath('preview.total_amount', '1000.00');

        $this->assertSame(0, Bill::query()->count());
    }

    public function test_generate_bill_totals_items_and_bill_number(): void
    {
        [, $c] = $this->setupTenant(opening: 150);
        $this->seedEntries($c, [1, 2, 3], 4.5);   // 6 × 4.5 L × 50 = 1350

        $res = $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-01', 'discount' => 50])->assertCreated();

        $res->assertJsonPath('data.bill_no', 'B-2026-00001')
            ->assertJsonPath('data.total_qty', '27.00')
            ->assertJsonPath('data.total_amount', '1350.00')
            ->assertJsonPath('data.previous_balance', '150.00')
            ->assertJsonPath('data.discount', '50.00')
            ->assertJsonPath('data.net_payable', '1450.00')
            ->assertJsonPath('data.outstanding', '1450.00')
            ->assertJsonPath('data.status', 'generated');

        $this->assertCount(6, $res->json('data.items'));
        $this->assertSame(6, MilkEntry::query()->whereNotNull('bill_id')->count());
    }

    public function test_period_cannot_be_billed_twice_but_can_after_cancel(): void
    {
        [, $c] = $this->setupTenant();
        $this->seedEntries($c, [1]);

        $id = $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-01'])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-01'])
            ->assertStatus(409)->assertJsonPath('code', 'bill_exists_for_period');

        $this->postJson("/api/v1/bills/{$id}/cancel", ['reason' => 'wrong'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertSame(0, MilkEntry::query()->whereNotNull('bill_id')->count());

        $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-01'])
            ->assertCreated()->assertJsonPath('data.bill_no', 'B-2026-00002');
    }

    public function test_empty_period_gives_friendly_error(): void
    {
        [, $c] = $this->setupTenant();

        $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-01'])
            ->assertStatus(422)->assertJsonPath('code', 'no_entries_for_period');
    }

    public function test_partial_then_full_payment_updates_status_and_outstanding(): void
    {
        [, $c] = $this->setupTenant();
        $this->seedEntries($c, [1]);   // 2 × 5 × 50 = 500
        $billId = $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-01'])->json('data.id');

        // No bill_id given: applied to the latest open bill automatically.
        $this->postJson('/api/v1/payments', ['customer_id' => $c->id, 'payment_date' => '2026-10-05', 'amount' => 200, 'method' => 'upi'])
            ->assertCreated()->assertJsonPath('data.bill_id', $billId);

        $this->getJson("/api/v1/bills/{$billId}")
            ->assertJsonPath('data.status', 'partially_paid')
            ->assertJsonPath('data.paid_amount', '200.00')
            ->assertJsonPath('data.outstanding', '300.00');

        $this->postJson("/api/v1/bills/{$billId}/mark-paid", ['method' => 'cash'])
            ->assertOk()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.outstanding', '0.00');
    }

    public function test_unpaid_balance_carries_forward_without_double_counting(): void
    {
        [, $c] = $this->setupTenant();
        $this->seedEntries($c, [1]);       // period 1: 500
        $this->seedEntries($c, [11]);      // period 2: 500

        $b1 = $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-01'])->json('data.id');
        $this->postJson('/api/v1/payments', ['customer_id' => $c->id, 'bill_id' => $b1, 'payment_date' => '2026-09-12', 'amount' => 300, 'method' => 'cash'])->assertCreated();

        $b2 = $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-11'])
            ->assertCreated()
            ->assertJsonPath('data.previous_balance', '200.00')
            ->assertJsonPath('data.net_payable', '700.00')
            ->json('data.id');

        $this->assertSame($b2, Bill::query()->find($b1)->carried_forward_to_id);

        // Only the live bill counts as pending: 700, not 700 + 200.
        $this->getJson('/api/v1/dashboard')->assertJsonPath('pending_payments', '700.00');
        $this->getJson("/api/v1/customers/{$c->id}")->assertJsonPath('balance', '700.00');

        // Paying the old bill goes to the bill that now carries its balance.
        $this->postJson('/api/v1/payments', ['customer_id' => $c->id, 'bill_id' => $b1, 'payment_date' => '2026-10-01', 'amount' => 700, 'method' => 'cash'])
            ->assertJsonPath('data.bill_id', $b2);
        $this->getJson("/api/v1/bills/{$b2}")->assertJsonPath('data.status', 'paid');

        // Older bill can no longer be cancelled.
        $this->postJson("/api/v1/bills/{$b1}/cancel")->assertStatus(409)->assertJsonPath('code', 'bill_not_latest');
    }

    public function test_advance_payment_reduces_next_bill(): void
    {
        [, $c] = $this->setupTenant();
        $this->postJson('/api/v1/payments', ['customer_id' => $c->id, 'payment_date' => '2026-09-01', 'amount' => 100, 'method' => 'cash'])
            ->assertCreated()->assertJsonPath('data.bill_id', null);

        $this->seedEntries($c, [2]);
        $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-01'])
            ->assertJsonPath('data.previous_balance', '-100.00')
            ->assertJsonPath('data.net_payable', '400.00');
    }

    public function test_discount_can_be_changed_on_latest_bill(): void
    {
        [, $c] = $this->setupTenant();
        $this->seedEntries($c, [1]);
        $id = $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-01'])->json('data.id');

        $this->putJson("/api/v1/bills/{$id}", ['discount' => 25])
            ->assertOk()->assertJsonPath('data.net_payable', '475.00')->assertJsonPath('data.outstanding', '475.00');
    }

    public function test_bill_pdf_whatsapp_and_signed_public_link(): void
    {
        [, $c] = $this->setupTenant();
        $this->seedEntries($c, [1]);
        $id = $this->postJson('/api/v1/bills', ['customer_id' => $c->id, 'period_start' => '2026-09-01'])->json('data.id');

        $this->assertStringStartsWith('%PDF', $this->get("/api/v1/bills/{$id}/pdf")->assertOk()->getContent());

        $wa = $this->postJson("/api/v1/bills/{$id}/whatsapp")->assertOk();
        $this->assertStringContainsString('500.00', $wa->json('message'));
        $this->getJson("/api/v1/bills/{$id}")->assertJsonPath('data.status', 'pending');

        preg_match('#https?://\S+\.pdf\?\S+#', $wa->json('message'), $m);
        $this->assertNotEmpty($m, 'bill message should contain the signed PDF link');

        $this->app['auth']->forgetGuards();
        $this->get($m[0])->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->get(str_replace("/{$id}.pdf", '/'.($id + 1).'.pdf', $m[0]))->assertForbidden();
    }

    public function test_bulk_generate_for_period(): void
    {
        [$tenant, $c] = $this->setupTenant();
        $c2 = $this->customer($tenant);
        $this->seedEntries($c, [3]);
        $this->entry(['customer_id' => $c2->id, 'entry_date' => '2026-09-04', 'session' => 'morning', 'quantity' => 3]);

        $this->postJson('/api/v1/bills/bulk-generate', ['period_start' => '2026-09-01'])
            ->assertOk()->assertJsonPath('created', 2);
    }
}
