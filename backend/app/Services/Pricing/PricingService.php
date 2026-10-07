<?php

namespace App\Services\Pricing;

use App\Models\MilkPrice;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Resolves the applicable price for a date + session and computes the rate.
 * To add a new pricing method (e.g. SNF chart) implement PricingStrategy
 * and register it in STRATEGIES.
 */
class PricingService
{
    private const STRATEGIES = [
        'fixed' => FixedRateStrategy::class,
        'fat' => FatRateStrategy::class,
    ];

    /** Latest price effective on $date; a session-specific rule beats a "both" rule of the same date. */
    public function priceFor(CarbonInterface|string $date, string $session): ?MilkPrice
    {
        $date = Carbon::parse($date)->toDateString();

        return MilkPrice::query()
            ->whereIn('session', [$session, 'both'])
            ->whereDate('effective_from', '<=', $date)
            ->orderByDesc('effective_from')
            ->orderByRaw("CASE WHEN session = 'both' THEN 1 ELSE 0 END")
            ->first();
    }

    /**
     * @return array{rate: string|null, method: string, price_id: int|null}
     */
    public function resolve(CarbonInterface|string $date, string $session, ?string $fat = null, ?string $snf = null): array
    {
        $price = $this->priceFor($date, $session);

        if (! $price) {
            return ['rate' => null, 'method' => 'fixed', 'price_id' => null];
        }

        return [
            'rate' => $this->strategy($price->method)->rate($price, $fat, $snf),
            'method' => $price->method,
            'price_id' => $price->id,
        ];
    }

    public function strategy(string $method): PricingStrategy
    {
        $class = self::STRATEGIES[$method] ?? throw new \InvalidArgumentException("Unknown pricing method [{$method}]");

        return app($class);
    }

    /** Today's effective prices for both sessions (for the entry screen and offline cache). */
    public function current(CarbonInterface|string $date): array
    {
        return collect(['morning', 'evening'])->mapWithKeys(function ($session) use ($date) {
            $price = $this->priceFor($date, $session);

            return [$session => $price ? [
                'id' => $price->id,
                'method' => $price->method,
                'rate' => $price->rate,
                'fat_rate' => $price->fat_rate,
                'min_rate' => $price->min_rate,
                'effective_from' => $price->effective_from->toDateString(),
                'session' => $price->session,
            ] : null];
        })->all();
    }
}
