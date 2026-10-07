<?php

namespace App\Services\Pricing;

use App\Models\MilkPrice;
use App\Support\Decimal;

/** Same rate per litre regardless of quality. */
class FixedRateStrategy implements PricingStrategy
{
    public function rate(MilkPrice $price, ?string $fat, ?string $snf = null): string
    {
        return Decimal::round($price->rate ?? '0', 2);
    }
}
