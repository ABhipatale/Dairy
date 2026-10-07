<?php

namespace Database\Factories;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'mobile' => '9'.fake()->unique()->numerify('#########'),
            'email' => fake()->unique()->safeEmail(),
            'password' => 'Password@123',
            'is_active' => true,
            'role_id' => fn () => Role::idFor(Role::ADMIN),
        ];
    }

    public function role(string $role): static
    {
        return $this->state(fn () => ['role_id' => Role::idFor($role)]);
    }
}
