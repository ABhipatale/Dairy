<?php

namespace App\Services\Pricing;

use App\Models\MilkPrice;
use App\Support\Decimal;

/**
 * Fat-based pricing: rate = fat × rate-per-fat-point, never below min_rate.
 * Example: fat 6.2 × ₹8.50 = ₹52.70/L.
 */
class FatRateStrategy implements PricingStrategy
{
    public function rate(MilkPrice $price, ?string $fat, ?string $snf = null): string
    {
        if ($fat === null || Decimal::cmp($fat, '0') <= 0) {
            // No fat reading: fall back to the configured base rate (or minimum).
            return Decimal::round($price->rate ?? $price->min_rate ?? '0', 2);
        }

        $rate = Decimal::mul($fat, $price->fat_rate ?? '0', 2);

        return $price->min_rate !== null ? Decimal::max($rate, $price->min_rate) : $rate;
    }
}
