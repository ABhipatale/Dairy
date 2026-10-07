<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * 10-day billing cycle: 1–10, 11–20 and 21–end of month.
 */
final class BillingPeriod
{
    public function __construct(
        public readonly CarbonImmutable $start,
        public readonly CarbonImmutable $end,
    ) {}

    public static function forDate(CarbonInterface|string $date): self
    {
        $d = CarbonImmutable::parse($date)->startOfDay();
        $day = $d->day;

        if ($day <= 10) {
            return new self($d->setDay(1), $d->setDay(10));
        }

        if ($day <= 20) {
            return new self($d->setDay(11), $d->setDay(20));
        }

        return new self($d->setDay(21), $d->endOfMonth()->startOfDay());
    }

    /** The most recent period that has fully ended on or before $today. */
    public static function lastCompleted(CarbonInterface|string $today): self
    {
        $current = self::forDate($today);

        return CarbonImmutable::parse($today)->startOfDay()->equalTo($current->end)
            ? $current
            : $current->previous();
    }

    public function previous(): self
    {
        return self::forDate($this->start->subDay());
    }

    public function next(): self
    {
        return self::forDate($this->end->addDay());
    }

    public function contains(CarbonInterface|string $date): bool
    {
        $d = CarbonImmutable::parse($date)->startOfDay();

        return $d->betweenIncluded($this->start, $this->end);
    }

    public function toArray(): array
    {
        return [
            'start' => $this->start->toDateString(),
            'end' => $this->end->toDateString(),
        ];
    }
}
