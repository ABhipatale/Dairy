<?php

namespace App\Models\Concerns;

use App\Services\AuditLogger;

/**
 * Writes created/updated/deleted events to audit_logs.
 * Models may define $auditExclude to skip noisy columns.
 */
trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(fn ($model) => app(AuditLogger::class)->model('created', $model, [], $model->auditableAttributes($model->getAttributes())));

        static::updated(function ($model) {
            $changes = $model->auditableAttributes($model->getChanges());
            unset($changes['updated_at']);

            if ($changes === []) {
                return;
            }

            $old = array_intersect_key($model->getOriginal(), $changes);
            app(AuditLogger::class)->model('updated', $model, $old, $changes);
        });

        static::deleted(fn ($model) => app(AuditLogger::class)->model('deleted', $model, $model->auditableAttributes($model->getAttributes()), []));
    }

    protected function auditableAttributes(array $attributes): array
    {
        $exclude = array_merge(['password', 'remember_token'], $this->auditExclude ?? []);

        return array_diff_key($attributes, array_flip($exclude));
    }
}
