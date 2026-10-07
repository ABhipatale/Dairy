<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([RolesAndPermissionsSeeder::class, LanguageSeeder::class]);

        // Production: no default password. Create the super admin with `php artisan dairy:super-admin`.
        if (app()->isProduction()) {
            return;
        }

        User::query()->firstOrCreate(['mobile' => '9000000000'], [
            'name' => 'Platform Admin',
            'email' => 'superadmin@dtico.test',
            'password' => 'Admin@123',
            'role_id' => Role::idFor(Role::SUPER_ADMIN),
            'is_active' => true,
        ]);

        $this->call(DemoSeeder::class);
    }
}
