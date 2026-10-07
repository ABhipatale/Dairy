<?php

namespace App\Models\Concerns;

use App\Models\Tenant;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Row-level tenant isolation. While a tenant is active in TenantContext every query
 * is constrained to it and new rows are stamped with it. tenant_id is never
 * mass-assignable, so request payloads can't move rows between tenants.
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', function (Builder $builder) {
            $context = app(TenantContext::class);

            if ($context->has()) {
                $builder->where($builder->qualifyColumn('tenant_id'), $context->id());
            }
        });

        static::creating(function ($model) {
            $context = app(TenantContext::class);

            if ($context->has()) {
                // Always force the current tenant, even if something set another value.
                $model->tenant_id = $context->id();
            }

            if (empty($model->tenant_id)) {
                throw new \LogicException('Cannot create '.static::class.' without a tenant.');
            }
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
