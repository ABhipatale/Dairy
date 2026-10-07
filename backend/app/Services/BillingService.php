<?php

namespace App\Services;

use App\Exceptions\BusinessException;
use App\Models\Bill;
use App\Models\BillItem;
use App\Models\Customer;
use App\Models\MilkEntry;
use App\Models\Payment;
use App\Support\BillingPeriod;
use App\Support\Decimal;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BillingService
{
    public function __construct(
        private readonly LedgerService $ledger,
        private readonly SettingsService $settings,
        private readonly TenantContext $tenants,
    ) {}

    /**
     * Pick the period to bill: the oldest completed period that still has unbilled
     * milk; otherwise the current (running) period.
     */
    public function suggestPeriod(Customer $customer, ?string $today = null): BillingPeriod
    {
        $today ??= now($this->tenants->tenant()?->timezone)->toDateString();
        $current = BillingPeriod::forDate($today);

        $oldestUnbilled = MilkEntry::query()
            ->where('customer_id', $customer->id)
            ->whereNull('bill_id')
            ->where('entry_date', '<', $current->start->toDateString())
            ->min('entry_date');

        return $oldestUnbilled ? BillingPeriod::forDate($oldestUnbilled) : $current;
    }

    /** Compute a bill without saving anything. */
    public function preview(Customer $customer, BillingPeriod $period, string|float $discount = 0): array
    {
        $this->assertNotAlreadyBilled($customer, $period);

        $entries = $this->unbilledEntries($customer, $period)->get();

        return $this->compute($customer, $period, $entries, Decimal::round($discount, 2)) + [
            'items' => $entries->map(fn (MilkEntry $e) => [
                'milk_entry_id' => $e->id,
                'entry_date' => $e->entry_date->toDateString(),
                'session' => $e->session,
                'quantity' => $e->quantity,
                'fat' => $e->fat,
                'rate' => $e->rate,
                'amount' => $e->amount,
            ])->values()->all(),
        ];
    }

    public function generate(Customer $customer, BillingPeriod $period, string|float $discount = 0, ?string $notes = null): Bill
    {
        return DB::transaction(function () use ($customer, $period, $discount, $notes) {
            // Serialise bill generation per customer (two admins clicking at once).
            Customer::query()->whereKey($customer->id)->lockForUpdate()->first();

            $this->assertNotAlreadyBilled($customer, $period);

            $entries = $this->unbilledEntries($customer, $period)->lockForUpdate()->get();

            if ($entries->isEmpty()) {
                throw new BusinessException('no_entries_for_period', 422, [], [
                    'from' => $period->start->format('d/m/Y'),
                    'to' => $period->end->format('d/m/Y'),
                ]);
            }

            $totals = $this->compute($customer, $period, $entries, Decimal::round($discount, 2));

            $bill = new Bill(['notes' => $notes]);
            $bill->forceFill([
                'customer_id' => $customer->id,
                'bill_no' => $this->nextBillNumber(),
                'bill_date' => now($this->tenants->tenant()?->timezone)->toDateString(),
                'period_start' => $period->start->toDateString(),
                'period_end' => $period->end->toDateString(),
                'total_qty' => $totals['total_qty'],
                'avg_fat' => $totals['avg_fat'],
                'entry_count' => $entries->count(),
                'total_amount' => $totals['total_amount'],
                'previous_balance' => $totals['previous_balance'],
                'discount' => $totals['discount'],
                'net_payable' => $totals['net_payable'],
                'paid_amount' => '0.00',
                'outstanding' => $totals['net_payable'],
                'status' => Decimal::cmp($totals['net_payable'], '0') <= 0 ? 'paid' : 'generated',
                'period_lock' => true,
                'generated_by' => auth()->id(),
            ]);
            $bill->save();

            BillItem::query()->insert($entries->map(fn (MilkEntry $e) => [
                'tenant_id' => $bill->tenant_id,
                'bill_id' => $bill->id,
                'milk_entry_id' => $e->id,
                'entry_date' => $e->entry_date->toDateString(),
                'session' => $e->session,
                'quantity' => $e->quantity,
                'fat' => $e->fat,
                'rate' => $e->rate,
                'amount' => $e->amount,
            ])->all());

            MilkEntry::query()->whereIn('id', $entries->pluck('id'))->update(['bill_id' => $bill->id]);

            // Older open bills are now part of previous_balance on this bill.
            Bill::query()
                ->where('customer_id', $customer->id)
                ->whereKeyNot($bill->id)
                ->open()
                ->update(['carried_forward_to_id' => $bill->id]);

            return $bill->load(['customer', 'items']);
        });
    }

    /** Only the customer's latest live bill may be cancelled, so later bills stay consistent. */
    public function cancel(Bill $bill, ?string $reason = null): Bill
    {
        if ($bill->isCancelled()) {
            throw new BusinessException('bill_already_cancelled', 409);
        }

        $this->assertIsLatest($bill);

        return DB::transaction(function () use ($bill, $reason) {
            MilkEntry::query()->where('bill_id', $bill->id)->update(['bill_id' => null]);
            // Payments stay on the customer account (advance) but detach from this bill.
            Payment::query()->where('bill_id', $bill->id)->update(['bill_id' => null]);
            Bill::query()->where('carried_forward_to_id', $bill->id)->update(['carried_forward_to_id' => null]);

            $bill->forceFill([
                'status' => 'cancelled',
                'period_lock' => null,
                'paid_amount' => '0.00',
                'cancelled_at' => now(),
                'cancelled_by' => auth()->id(),
                'cancel_reason' => $reason,
            ])->save();

            return $bill;
        });
    }

    public function updateDiscount(Bill $bill, string|float $discount): Bill
    {
        if ($bill->isCancelled()) {
            throw new BusinessException('bill_already_cancelled', 409);
        }

        $this->assertIsLatest($bill);

        $discount = Decimal::round($discount, 2);
        $bill->discount = $discount;
        $bill->net_payable = Decimal::sub(Decimal::add($bill->previous_balance, $bill->total_amount), $discount);

        return $this->refreshPayments($bill);
    }

    public function markSent(Bill $bill): Bill
    {
        $bill->sent_at = now();

        if ($bill->status === 'generated') {
            $bill->status = 'pending';
        }

        $bill->save();

        return $bill;
    }

    /** Recalculate paid/outstanding/status from linked payments. */
    public function refreshPayments(Bill $bill): Bill
    {
        if ($bill->isCancelled()) {
            return $bill;
        }

        $paid = Decimal::round(Payment::query()->where('bill_id', $bill->id)->sum('amount'), 2);
        $bill->paid_amount = $paid;
        $bill->outstanding = Decimal::sub($bill->net_payable, $paid);

        if (Decimal::cmp($bill->outstanding, '0') <= 0) {
            $bill->status = 'paid';
            $bill->paid_at ??= now();
        } else {
            $bill->paid_at = null;
            $bill->status = Decimal::cmp($paid, '0') > 0
                ? 'partially_paid'
                : ($bill->sent_at ? 'pending' : 'generated');
        }

        $bill->save();

        return $bill;
    }

    public function latestOpenBill(Customer $customer): ?Bill
    {
        return Bill::query()
            ->where('customer_id', $customer->id)
            ->open()
            ->latest('period_start')
            ->first();
    }

    private function compute(Customer $customer, BillingPeriod $period, Collection $entries, string $discount): array
    {
        $qty = '0.00';
        $amount = '0.00';
        $fatWeighted = '0';
        $fatQty = '0';

        foreach ($entries as $e) {
            $qty = Decimal::add($qty, $e->quantity);
            $amount = Decimal::add($amount, $e->amount);

            if ($e->fat !== null) {
                $fatWeighted = Decimal::add($fatWeighted, Decimal::mul($e->fat, $e->quantity, 4), 4);
                $fatQty = Decimal::add($fatQty, $e->quantity, 4);
            }
        }

        $previous = $this->ledger->balance($customer);
        $net = Decimal::sub(Decimal::add($previous, $amount), $discount);

        return [
            'customer_id' => $customer->id,
            'period_start' => $period->start->toDateString(),
            'period_end' => $period->end->toDateString(),
            'entry_count' => $entries->count(),
            'total_qty' => $qty,
            'avg_fat' => Decimal::cmp($fatQty, '0', 4) > 0 ? Decimal::div($fatWeighted, $fatQty, 2) : null,
            'total_amount' => $amount,
            'previous_balance' => $previous,
            'discount' => $discount,
            'net_payable' => $net,
            'paid_amount' => '0.00',
            'outstanding' => $net,
        ];
    }

    private function unbilledEntries(Customer $customer, BillingPeriod $period)
    {
        return MilkEntry::query()
            ->where('customer_id', $customer->id)
            ->whereNull('bill_id')
            ->whereBetween('entry_date', [$period->start->toDateString(), $period->end->toDateString()])
            ->orderBy('entry_date')
            ->orderByRaw("FIELD(session, 'morning', 'evening')");
    }

    private function assertNotAlreadyBilled(Customer $customer, BillingPeriod $period): void
    {
        $existing = Bill::query()
            ->where('customer_id', $customer->id)
            ->whereDate('period_start', $period->start->toDateString())
            ->where('status', '!=', 'cancelled')
            ->first(['id', 'bill_no']);

        if ($existing) {
            throw new BusinessException('bill_exists_for_period', 409, ['bill_id' => $existing->id], ['bill_no' => $existing->bill_no]);
        }
    }

    private function assertIsLatest(Bill $bill): void
    {
        $newer = Bill::query()
            ->where('customer_id', $bill->customer_id)
            ->where('status', '!=', 'cancelled')
            ->where('id', '>', $bill->id)
            ->exists();

        if ($newer) {
            throw new BusinessException('bill_not_latest', 409);
        }
    }

    /** Per-tenant, per-year gap-free sequence: B-2026-00001. Must run inside a transaction. */
    private function nextBillNumber(): string
    {
        $tenantId = $this->tenants->id();
        $year = (int) Carbon::now($this->tenants->tenant()?->timezone)->format('Y');

        DB::table('bill_sequences')->insertOrIgnore(['tenant_id' => $tenantId, 'year' => $year, 'last_number' => 0]);

        $current = DB::table('bill_sequences')
            ->where(['tenant_id' => $tenantId, 'year' => $year])
            ->lockForUpdate()
            ->value('last_number');

        $next = $current + 1;
        DB::table('bill_sequences')->where(['tenant_id' => $tenantId, 'year' => $year])->update(['last_number' => $next]);

        $prefix = $this->settings->value('billing', 'bill_prefix', 'B');

        return sprintf('%s-%d-%05d', $prefix, $year, $next);
    }
}
