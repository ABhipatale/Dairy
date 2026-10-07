<?php

namespace Tests\Feature;

use Tests\TestCase;

class ReportTest extends TestCase
{
    private function setupData(): array
    {
        $tenant = $this->makeTenant();
        $a = $this->customer($tenant, ['name' => 'A Farmer']);
        $b = $this->customer($tenant, ['name' => 'B Farmer']);
        $this->price($tenant, 'morning', 50);
        $this->price($tenant, 'evening', 60);
        $this->actingAsTenant($tenant);

        $rows = [
            [$a, '2026-10-01', 'morning', 5], [$a, '2026-10-01', 'evening', 4],
            [$b, '2026-10-01', 'morning', 10],
            [$a, '2026-10-02', 'morning', 6],
            [$b, '2026-09-15', 'morning', 2],
        ];

        foreach ($rows as [$c, $d, $s, $q]) {
            $this->entry(['customer_id' => $c->id, 'entry_date' => $d, 'session' => $s, 'quantity' => $q])->assertCreated();
        }

        return [$a, $b];
    }

    public function test_daily_report_totals_and_customer_rows(): void
    {
        $this->setupData();

        $res = $this->getJson('/api/v1/reports/daily?date_from=2026-10-01')->assertOk();

        $res->assertJsonPath('summary.total_customers', 2)
            ->assertJsonPath('summary.morning_milk', '15.00')
            ->assertJsonPath('summary.evening_milk', '4.00')
            ->assertJsonPath('summary.total_milk', '19.00')
            ->assertJsonPath('summary.morning_revenue', '750.00')
            ->assertJsonPath('summary.evening_revenue', '240.00')
            ->assertJsonPath('summary.total_revenue', '990.00')
            ->assertJsonPath('data', null);

        $this->assertCount(2, $res->json('rows.data'));
        $this->assertSame('9.00', $res->json('rows.data.0.total_qty'));
    }

    public function test_daily_report_session_and_customer_filters(): void
    {
        [$a] = $this->setupData();

        $this->getJson("/api/v1/reports/daily?date_from=2026-10-01&date_to=2026-10-02&session=morning&customer_id={$a->id}")
            ->assertJsonPath('summary.total_milk', '11.00');
    }

    public function test_ten_day_report_with_bill_status(): void
    {
        [$a] = $this->setupData();
        $this->postJson('/api/v1/bills', ['customer_id' => $a->id, 'period_start' => '2026-10-01'])->assertCreated();

        $res = $this->getJson('/api/v1/reports/ten_day?date_from=2026-10-05')->assertOk()
            ->assertJsonPath('period.start', '2026-10-01')
            ->assertJsonPath('summary.total_milk', '25.00')
            ->assertJsonPath('summary.unbilled_customers', 1);

        $statuses = collect($res->json('rows.data'))->pluck('bill_status', 'name');
        $this->assertSame('generated', $statuses['A Farmer']);
        $this->assertSame('unbilled', $statuses['B Farmer']);

        $this->getJson('/api/v1/reports/ten_day?date_from=2026-10-05&payment_status=unbilled')
            ->assertJsonPath('summary.total_customers', 1);
    }

    public function test_monthly_and_yearly_reports(): void
    {
        $this->setupData();

        $this->getJson('/api/v1/reports/monthly?month=2026-10')->assertOk()
            ->assertJsonPath('summary.total_milk', '25.00')
            ->assertJsonPath('summary.total_customers', 2)
            ->assertJsonCount(2, 'rows');

        $year = $this->getJson('/api/v1/reports/yearly?year=2026')->assertOk()
            ->assertJsonPath('summary.total_milk', '27.00')
            ->assertJsonPath('summary.new_customers', 2);

        $this->assertCount(12, $year->json('rows'));
        $this->assertSame('2.00', $year->json('rows.8.total_qty')); // September
    }

    public function test_exports_produce_pdf_and_xlsx(): void
    {
        $this->setupData();

        $pdf = $this->get('/api/v1/reports/monthly/export?month=2026-10&format=pdf')->assertOk();
        $this->assertStringStartsWith('%PDF', $pdf->getContent());

        $xlsx = $this->get('/api/v1/reports/daily/export?date_from=2026-10-01&format=xlsx')->assertOk();
        $this->assertStringStartsWith('PK', $xlsx->streamedContent());
    }

    public function test_unknown_report_type_is_404(): void
    {
        $this->setupData();
        $this->getJson('/api/v1/reports/hourly')->assertNotFound();
    }
}
