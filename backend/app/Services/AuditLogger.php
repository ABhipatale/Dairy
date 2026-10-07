<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Tenant;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class AuditLogger
{
    public function __construct(private readonly TenantContext $tenants) {}

    /** Log a model lifecycle event as "<entity>.<event>", e.g. "milk_entry.created". */
    public function model(string $event, Model $model, array $old = [], array $new = []): void
    {
        $entity = Str::snake(class_basename($model));
        $tenantId = $model instanceof Tenant ? $model->getKey() : ($model->getAttribute('tenant_id') ?? $this->tenants->id());

        $this->log("{$entity}.{$event}", $entity, $model->getKey(), $old, $new, $tenantId);
    }

    public function log(
        string $action,
        ?string $entityType = null,
        int|string|null $entityId = null,
        array $old = [],
        array $new = [],
        ?int $tenantId = null,
    ): void {
        $request = app()->runningInConsole() && ! app()->runningUnitTests() ? null : request();

        AuditLog::query()->create([
            'tenant_id' => $tenantId ?? $this->tenants->id(),
            'user_id' => auth()->id(),
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'old_values' => $old ?: null,
            'new_values' => $new ?: null,
            'ip_address' => $request?->ip(),
            'user_agent' => $request ? Str::limit((string) $request->userAgent(), 250, '') : null,
        ]);
    }
}
