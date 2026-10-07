<?php

namespace App\Services\Pricing;

use App\Models\MilkPrice;

interface PricingStrategy
{
    /** Rate per litre (string decimal, 2 dp) for the given price rule and milk quality. */
    public function rate(MilkPrice $price, ?string $fat, ?string $snf = null): string;
}
