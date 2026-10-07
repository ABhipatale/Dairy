<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Customer;
use App\Models\MilkEntry;
use App\Models\Payment;
use App\Support\Decimal;
use Illuminate\Support\Facades\DB;

/**
 * Customer account. Single source of truth:
 *   balance = opening_balance + Σ(bill total − discount, non-cancelled) − Σ(payments)
 * Unbilled milk is reported separately until it is billed.
 */
class LedgerService
{
    public function balance(Customer $customer, ?int $excludeBillId = null): string
    {
        $billed = Bill::query()
            ->where('customer_id', $customer->id)
            ->where('status', '!=', 'cancelled')
            ->when($excludeBillId, fn ($q) => $q->whereKeyNot($excludeBillId))
            ->sum(DB::raw('total_amount - discount'));

        $paid = Payment::query()->where('customer_id', $customer->id)->sum('amount');

        return Decimal::sub(Decimal::add($customer->opening_balance, $billed), $paid);
    }

    public function unbilled(Customer $customer): array
    {
        $row = MilkEntry::query()
            ->where('customer_id', $customer->id)
            ->whereNull('bill_id')
            ->selectRaw('COUNT(*) as entries, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(amount),0) as amount')
            ->first();

        return [
            'entries' => (int) $row->entries,
            'quantity' => Decimal::round($row->quantity, 2),
            'amount' => Decimal::round($row->amount, 2),
        ];
    }

    /** Totals over a date range (customer profile "last 10 days" etc.). */
    public function summary(Customer $customer, string $from, string $to): array
    {
        $milk = MilkEntry::query()
            ->where('customer_id', $customer->id)
            ->whereBetween('entry_date', [$from, $to])
            ->selectRaw('COUNT(*) as entries, COALESCE(SUM(quantity),0) as quantity, COALESCE(SUM(amount),0) as amount')
            ->first();

        $paid = Payment::query()
            ->where('customer_id', $customer->id)
            ->whereBetween('payment_date', [$from, $to])
            ->sum('amount');

        $balance = $this->balance($customer);
        $unbilled = $this->unbilled($customer);

        return [
            'from' => $from,
            'to' => $to,
            'entries' => (int) $milk->entries,
            'total_milk' => Decimal::round($milk->quantity, 2),
            'total_amount' => Decimal::round($milk->amount, 2),
            'paid_amount' => Decimal::round($paid, 2),
            'balance' => $balance,
            'unbilled_amount' => $unbilled['amount'],
            // What the customer account stands at including milk not billed yet.
            'pending_amount' => Decimal::add($balance, $unbilled['amount']),
        ];
    }
}
