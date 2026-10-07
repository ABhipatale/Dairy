<?php

namespace Database\Factories;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Tenant>
 */
class TenantFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->company().' Dairy';

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::random(4),
            'owner_name' => fake()->name(),
            'mobile' => '98'.fake()->numerify('########'),
            'city' => fake()->city(),
            'status' => 'active',
            'timezone' => 'Asia/Kolkata',
            'currency' => 'INR',
            'default_language' => 'en',
        ];
    }
}
