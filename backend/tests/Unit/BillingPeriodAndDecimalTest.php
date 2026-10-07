<?php

namespace Tests\Unit;

use App\Support\BillingPeriod;
use App\Support\Decimal;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class BillingPeriodAndDecimalTest extends TestCase
{
    public static function periods(): array
    {
        return [
            ['2026-10-01', '2026-10-01', '2026-10-10'],
            ['2026-10-10', '2026-10-01', '2026-10-10'],
            ['2026-10-11', '2026-10-11', '2026-10-20'],
            ['2026-10-21', '2026-10-21', '2026-10-31'],
            ['2026-02-25', '2026-02-21', '2026-02-28'],
            ['2028-02-29', '2028-02-21', '2028-02-29'],
            ['2026-04-30', '2026-04-21', '2026-04-30'],
        ];
    }

    #[DataProvider('periods')]
    public function test_period_for_date(string $date, string $start, string $end): void
    {
        $p = BillingPeriod::forDate($date);

        $this->assertSame($start, $p->start->toDateString());
        $this->assertSame($end, $p->end->toDateString());
    }

    public function test_previous_next_and_last_completed(): void
    {
        $p = BillingPeriod::forDate('2026-10-03');
        $this->assertSame('2026-09-21', $p->previous()->start->toDateString());
        $this->assertSame('2026-09-30', $p->previous()->end->toDateString());
        $this->assertSame('2026-10-11', $p->next()->start->toDateString());

        $this->assertSame('2026-09-21', BillingPeriod::lastCompleted('2026-10-07')->start->toDateString());
        $this->assertSame('2026-10-01', BillingPeriod::lastCompleted('2026-10-10')->start->toDateString());
    }

    public function test_decimal_math_is_exact_and_rounds_half_up(): void
    {
        $this->assertSame('286.00', Decimal::mul('5.5', '52'));
        $this->assertSame('0.30', Decimal::add('0.1', '0.2'));
        $this->assertSame('52.70', Decimal::mul('6.2', '8.5'));
        $this->assertSame('1.24', Decimal::round('1.235'));
        $this->assertSame('-1.24', Decimal::round('-1.235'));
        $this->assertSame('0.00', Decimal::div('5', '0'));
        $this->assertSame('99999999.99', Decimal::mul('9999999.999', '10'));
    }
}
