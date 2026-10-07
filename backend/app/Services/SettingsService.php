<?php

namespace App\Services;

use App\Models\Setting;
use App\Support\TenantContext;
use Illuminate\Support\Facades\Cache;

/**
 * Grouped settings with defaults. A group's value = defaults ← global override ← tenant override.
 * Only keys listed in DEFAULTS exist; anything else stored in the database is ignored.
 */
class SettingsService
{
    public const DEFAULTS = [
        'milk' => [
            'fat_enabled' => true,
            'fat_required' => false,
            'allow_rate_override' => true,
            'max_quantity' => 200,
            'evening_starts_at' => '13:00',
        ],
        'billing' => [
            'bill_prefix' => 'B',
            'show_fat_on_bill' => true,
        ],
        'printer' => [
            'paper_size' => '58mm',
            'connection_type' => 'browser',   // browser | bluetooth
            'auto_print' => false,
            'print_logo' => true,
            'print_customer_mobile' => true,
            'copies' => 1,
        ],
        'whatsapp' => [
            'enabled' => true,
            'auto_send' => false,
            'country_code' => '91',
        ],
        'general' => [
            'date_format' => 'DD/MM/YYYY',
            'receipt_language' => null,
        ],
        'platform' => [
            'app_name' => 'Dtico Dairy',
            'support_mobile' => '',
            'support_email' => '',
        ],
    ];

    public function __construct(private readonly TenantContext $tenants) {}

    public function groups(): array
    {
        return array_keys(self::DEFAULTS);
    }

    /** Effective values for a group. */
    public function get(string $group, ?int $tenantId = null): array
    {
        $tenantId ??= $this->tenants->id();

        return Cache::remember($this->cacheKey($group, $tenantId), 600, function () use ($group, $tenantId) {
            $defaults = self::DEFAULTS[$group] ?? [];
            $values = array_replace($defaults, array_intersect_key($this->stored($group, null), $defaults));

            if ($tenantId) {
                $values = array_replace($values, array_intersect_key($this->stored($group, $tenantId), $defaults));
            }

            return $values;
        });
    }

    public function value(string $group, string $key, mixed $default = null, ?int $tenantId = null): mixed
    {
        return $this->get($group, $tenantId)[$key] ?? $default;
    }

    /** Values sent to the browser (nothing secret is stored, so same as get()). */
    public function forClient(string $group, ?int $tenantId = null): array
    {
        return $this->get($group, $tenantId);
    }

    /** Persist only known keys of a group. */
    public function set(string $group, array $input, ?int $tenantId = null, bool $global = false): array
    {
        $tenantId = $global ? null : ($tenantId ?? $this->tenants->id());
        $defaults = self::DEFAULTS[$group] ?? [];
        $allowed = array_intersect_key($input, $defaults);
        $merged = array_replace(array_intersect_key($this->stored($group, $tenantId), $defaults), $allowed);

        Setting::query()->updateOrCreate(
            ['tenant_id' => $tenantId, 'key' => $group],
            ['value' => $merged],
        );

        $this->forget($group, $tenantId);

        app(AuditLogger::class)->log('settings.updated', 'settings', null, [], ['group' => $group, 'keys' => array_keys($allowed)], $tenantId);

        return $this->get($group, $tenantId);
    }

    private function stored(string $group, ?int $tenantId): array
    {
        return Setting::query()
            ->where('key', $group)
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId), fn ($q) => $q->whereNull('tenant_id'))
            ->value('value') ?? [];
    }

    private function forget(string $group, ?int $tenantId): void
    {
        if ($tenantId === null) {
            // A global change affects every tenant's effective value: bump the key version.
            Cache::forever('settings:version', $this->version() + 1);

            return;
        }

        Cache::forget($this->cacheKey($group, $tenantId));
    }

    private function version(): int
    {
        return (int) Cache::get('settings:version', 1);
    }

    private function cacheKey(string $group, ?int $tenantId): string
    {
        return 'settings:v'.$this->version().":{$group}:".($tenantId ?? 'global');
    }
}
