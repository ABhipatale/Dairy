<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class MilkEntryPolicy extends TenantOwnedPolicy
{
    protected function resource(): string
    {
        return 'milk';
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('milk.create');
    }

    public function update(User $user, Model $model): bool
    {
        return $this->owns($user, $model) && $user->hasPermission('milk.update');
    }

    public function delete(User $user, Model $model): bool
    {
        return $this->owns($user, $model) && $user->hasPermission('milk.delete');
    }
}
