<?php

namespace App\Services;

use App\Exceptions\BusinessException;
use App\Models\Customer;
use App\Models\MilkEntry;
use App\Services\Pricing\PricingService;
use App\Support\Decimal;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class MilkEntryService
{
    public function __construct(
        private readonly PricingService $pricing,
        private readonly SettingsService $settings,
    ) {}

    /**
     * Create an entry. Idempotent on client_uuid: replaying an offline-queued request
     * returns the original entry instead of creating a duplicate.
     *
     * @return array{0: MilkEntry, 1: bool} [entry, wasReplay]
     */
    public function create(array $data): array
    {
        if (! empty($data['client_uuid'])) {
            $existing = MilkEntry::query()->where('client_uuid', $data['client_uuid'])->first();

            if ($existing) {
                return [$existing, true];
            }
        }

        $customer = Customer::query()->findOrFail($data['customer_id']);

        if ($customer->status !== 'active') {
            throw new BusinessException('customer_inactive');
        }

        $this->assertNoDuplicate($customer->id, $data['entry_date'], $data['session']);

        $entry = new MilkEntry([
            'customer_id' => $customer->id,
            'entry_date' => $data['entry_date'],
            'session' => $data['session'],
            'notes' => $data['notes'] ?? null,
            'client_uuid' => $data['client_uuid'] ?? null,
        ]);

        $this->applyMeasurements($entry, $data);
        $entry->created_by = auth()->id();

        try {
            $entry->save();
        } catch (QueryException $e) {
            // Lost a race with a concurrent save (two devices / double tap).
            if ($this->isUniqueViolation($e)) {
                if (! empty($data['client_uuid']) && ($replay = MilkEntry::query()->where('client_uuid', $data['client_uuid'])->first())) {
                    return [$replay, true];
                }
                $this->assertNoDuplicate($customer->id, $data['entry_date'], $data['session']);
            }
            throw $e;
        }

        return [$entry->load('customer'), false];
    }

    public function update(MilkEntry $entry, array $data): MilkEntry
    {
        if ($entry->isLocked()) {
            throw new BusinessException('entry_locked', 409);
        }

        $dateChanged = isset($data['entry_date']) && $data['entry_date'] !== $entry->entry_date->toDateString();
        $sessionChanged = isset($data['session']) && $data['session'] !== $entry->session;

        if ($dateChanged || $sessionChanged) {
            $this->assertNoDuplicate($entry->customer_id, $data['entry_date'] ?? $entry->entry_date->toDateString(), $data['session'] ?? $entry->session, $entry->id);
            $entry->entry_date = $data['entry_date'] ?? $entry->entry_date;
            $entry->session = $data['session'] ?? $entry->session;
        }

        if (array_key_exists('notes', $data)) {
            $entry->notes = $data['notes'];
        }

        $this->applyMeasurements($entry, array_merge([
            'quantity' => $entry->quantity,
            'fat' => $entry->fat,
            'snf' => $entry->snf,
        ], $data));

        $entry->updated_by = auth()->id();
        $entry->save();

        return $entry->load('customer');
    }

    public function delete(MilkEntry $entry): void
    {
        if ($entry->isLocked()) {
            throw new BusinessException('entry_locked', 409);
        }

        $entry->delete();
    }

    /** Preview calculation for the entry screen (no save). */
    public function calculate(string $date, string $session, string $quantity, ?string $fat, ?string $manualRate = null): array
    {
        $entry = new MilkEntry(['entry_date' => $date, 'session' => $session]);
        $this->applyMeasurements($entry, ['quantity' => $quantity, 'fat' => $fat, 'rate' => $manualRate], strict: false);

        return [
            'rate' => $entry->rate,
            'amount' => $entry->amount,
            'rate_source' => $entry->rate_source,
            'pricing_method' => $entry->pricing_method,
        ];
    }

    /** Sets quantity/fat and snapshots the applied rate and amount onto the entry. */
    private function applyMeasurements(MilkEntry $entry, array $data, bool $strict = true): void
    {
        $milk = $this->settings->get('milk');

        $quantity = Decimal::round($data['quantity'], 2);
        $fat = isset($data['fat']) && $data['fat'] !== '' ? Decimal::round($data['fat'], 2) : null;
        $snf = isset($data['snf']) && $data['snf'] !== '' ? Decimal::round($data['snf'], 2) : null;

        if ($strict && $milk['fat_required'] && $fat === null) {
            throw new BusinessException('fat_required');
        }

        $manualRate = $data['rate'] ?? null;
        $useManual = $manualRate !== null && $manualRate !== '' && $milk['allow_rate_override'];

        if ($useManual) {
            $rate = Decimal::round($manualRate, 2);
            $resolved = $this->pricing->resolve($entry->entry_date, $entry->session, $fat, $snf);
            // Only flag as "manual" when it really differs from the automatic rate.
            $source = $resolved['rate'] !== null && Decimal::cmp($resolved['rate'], $rate) === 0 ? 'auto' : 'manual';
            $method = $resolved['method'];
        } else {
            $resolved = $this->pricing->resolve($entry->entry_date, $entry->session, $fat, $snf);

            if ($resolved['rate'] === null) {
                if ($strict) {
                    throw new BusinessException('no_price_set', 422, [], ['session' => __('common.'.$entry->session)]);
                }
                $resolved['rate'] = '0.00';
            }

            $rate = $resolved['rate'];
            $source = 'auto';
            $method = $resolved['method'];
        }

        $entry->quantity = $quantity;
        $entry->fat = $fat;
        $entry->snf = $snf;
        $entry->rate = $rate;
        $entry->rate_source = $source;
        $entry->pricing_method = $method;
        $entry->amount = Decimal::mul($quantity, $rate, 2);
    }

    private function assertNoDuplicate(int $customerId, string $date, string $session, ?int $ignoreId = null): void
    {
        $existing = MilkEntry::query()
            ->where('customer_id', $customerId)
            ->whereDate('entry_date', $date)
            ->where('session', $session)
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->first(['id']);

        if ($existing) {
            throw new BusinessException('duplicate_entry', 409, ['existing_id' => $existing->id], ['session' => __('common.'.$session)]);
        }
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        return ($e->errorInfo[1] ?? null) === 1062 || $e->getCode() === '23000';
    }

    /** Daily totals helper shared by dashboard and entry screen. */
    public function dayTotals(string $date): array
    {
        $rows = MilkEntry::query()
            ->whereDate('entry_date', $date)
            ->groupBy('session')
            ->get([
                'session',
                DB::raw('COUNT(*) as entries'),
                DB::raw('SUM(quantity) as quantity'),
                DB::raw('SUM(amount) as amount'),
            ])->keyBy('session');

        $pick = fn ($s, $f) => Decimal::round($rows[$s]->{$f} ?? 0, 2);

        return [
            'morning' => ['entries' => (int) ($rows['morning']->entries ?? 0), 'quantity' => $pick('morning', 'quantity'), 'amount' => $pick('morning', 'amount')],
            'evening' => ['entries' => (int) ($rows['evening']->entries ?? 0), 'quantity' => $pick('evening', 'quantity'), 'amount' => $pick('evening', 'amount')],
        ];
    }
}
