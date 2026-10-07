<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Base policy: permission check + tenant ownership. The tenant global scope already
 * hides other tenants' rows; this is the second, independent line of defence.
 */
abstract class TenantOwnedPolicy
{
    /** Permission prefix, e.g. "customers". */
    abstract protected function resource(): string;

    protected function owns(User $user, Model $model): bool
    {
        return $user->tenant_id !== null && (int) $model->getAttribute('tenant_id') === (int) $user->tenant_id;
    }

    public function viewAny(User $user): bool
    {
        return $user->hasPermission($this->resource().'.view');
    }

    public function view(User $user, Model $model): bool
    {
        return $this->owns($user, $model) && $user->hasPermission($this->resource().'.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission($this->resource().'.manage');
    }

    public function update(User $user, Model $model): bool
    {
        return $this->owns($user, $model) && $user->hasPermission($this->resource().'.manage');
    }

    public function delete(User $user, Model $model): bool
    {
        return $this->owns($user, $model) && $user->hasPermission($this->resource().'.manage');
    }
}
