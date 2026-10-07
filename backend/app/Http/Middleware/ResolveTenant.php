<?php

namespace App\Http\Middleware;

use App\Exceptions\BusinessException;
use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Binds the authenticated user's tenant to the request. Tenant routes are only
 * reachable by tenant users; a deactivated or expired tenant is blocked.
 */
class ResolveTenant
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->tenant_id) {
            throw new BusinessException('tenant_required', 403);
        }

        $tenant = $user->tenant;

        if (! $tenant) {
            throw new BusinessException('tenant_required', 403);
        }

        if (! $tenant->isActive()) {
            throw new BusinessException('tenant_inactive', 403);
        }

        $this->context->set($tenant);

        return $next($request);
    }
}
