<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/** Idempotent: safe to re-run after adding permissions to config/dairy.php. */
class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        foreach (config('dairy.permissions') as $name => $meta) {
            Permission::query()->updateOrCreate(['name' => $name], $meta);
        }

        $all = Permission::query()->pluck('id', 'name');

        foreach (config('dairy.roles') as $name => $meta) {
            $role = Role::query()->updateOrCreate(['name' => $name], ['label' => $meta['label'], 'is_system' => true]);
            $ids = $meta['permissions'] === ['*'] ? $all->values() : $all->only($meta['permissions'])->values();
            $role->permissions()->sync($ids);
        }

        // Remove roles/permissions no longer in the catalogue (if no user still has the role).
        Role::query()->whereNotIn('name', array_keys(config('dairy.roles')))
            ->whereNotIn('id', User::withTrashed()->select('role_id'))
            ->delete();
        Permission::query()->whereNotIn('name', array_keys(config('dairy.permissions')))->delete();
    }
}
