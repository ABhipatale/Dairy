<?php

namespace Database\Factories;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Create inside a tenant context (TenantContext::runAs or an authenticated request);
 * the BelongsToTenant trait stamps tenant_id.
 *
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => (string) fake()->unique()->numberBetween(1, 999999),
            'name' => fake()->name(),
            'mobile' => '98'.fake()->numerify('########'),
            'village' => fake()->city(),
            'opening_balance' => 0,
            'status' => 'active',
        ];
    }
}
