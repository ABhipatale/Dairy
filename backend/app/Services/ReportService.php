<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Customer;
use App\Models\MilkEntry;
use App\Models\Payment;
use App\Support\BillingPeriod;
use App\Support\Decimal;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * All reports aggregate in SQL; only one page of rows reaches the browser.
 * Each report returns: title, subtitle, summary, columns, rows, chart.
 * Exports call the same builder with $paginate = false.
 */
class ReportService
{
    public const TYPES = ['daily', 'ten_day', 'monthly', 'yearly'];

    public function __construct(private readonly MessageFormatter $fmt) {}

    public function build(string $type, array $f, bool $paginate = true, int $perPage = 25): array
    {
        return match ($type) {
            'daily' => $this->daily($f, $paginate, $perPage),
            'ten_day' => $this->tenDay($f, $paginate, $perPage),
            'monthly' => $this->monthly($f),
            'yearly' => $this->yearly($f),
        };
    }

    /** Customer-wise milk for a date (or range), split by session. */
    private function daily(array $f, bool $paginate, int $perPage): array
    {
        $from = $f['date_from'] ?? now()->toDateString();
        $to = $f['date_to'] ?? $from;

        $base = $this->entries($f, $from, $to);

        $sum = (clone $base)->selectRaw("
            COUNT(DISTINCT customer_id) as customers,
            COALESCE(SUM(CASE WHEN session='morning' THEN quantity END),0) as morning_qty,
            COALESCE(SUM(CASE WHEN session='evening' THEN quantity END),0) as evening_qty,
            COALESCE(SUM(CASE WHEN session='morning' THEN amount END),0) as morning_amount,
            COALESCE(SUM(CASE WHEN session='evening' THEN amount END),0) as evening_amount
        ")->first();

        $rows = (clone $base)
            ->join('customers', 'customers.id', '=', 'milk_entries.customer_id')
            ->groupBy('milk_entries.customer_id', 'customers.code', 'customers.name')
            ->orderBy('customers.name')
            ->select([
                'milk_entries.customer_id',
                'customers.code',
                'customers.name',
                DB::raw("COALESCE(SUM(CASE WHEN session='morning' THEN quantity END),0) as morning_qty"),
                DB::raw("COALESCE(SUM(CASE WHEN session='evening' THEN quantity END),0) as evening_qty"),
                DB::raw('SUM(quantity) as total_qty'),
                DB::raw('ROUND(SUM(fat*quantity)/NULLIF(SUM(CASE WHEN fat IS NOT NULL THEN quantity END),0),2) as avg_fat'),
                DB::raw('SUM(amount) as amount'),
            ]);

        $rows = $this->rows($rows, $paginate, $perPage, fn ($r) => [
            'customer_id' => $r->customer_id,
            'code' => $r->code,
            'name' => $r->name,
            'morning_qty' => $this->q($r->morning_qty),
            'evening_qty' => $this->q($r->evening_qty),
            'total_qty' => $this->q($r->total_qty),
            'avg_fat' => $r->avg_fat !== null ? $this->q($r->avg_fat) : null,
            'amount' => $this->q($r->amount),
        ]);

        return [
            'type' => 'daily',
            'title' => __('reports.daily'),
            'subtitle' => $this->range($from, $to),
            'summary' => [
                'total_customers' => (int) $sum->customers,
                'morning_milk' => $this->q($sum->morning_qty),
                'evening_milk' => $this->q($sum->evening_qty),
                'total_milk' => Decimal::add($sum->morning_qty, $sum->evening_qty),
                'morning_revenue' => $this->q($sum->morning_amount),
                'evening_revenue' => $this->q($sum->evening_amount),
                'total_revenue' => Decimal::add($sum->morning_amount, $sum->evening_amount),
            ],
            'columns' => [
                ['key' => 'code', 'label' => __('reports.col_code')],
                ['key' => 'name', 'label' => __('reports.col_customer')],
                ['key' => 'morning_qty', 'label' => __('reports.col_morning'), 'align' => 'right', 'type' => 'qty'],
                ['key' => 'evening_qty', 'label' => __('reports.col_evening'), 'align' => 'right', 'type' => 'qty'],
                ['key' => 'total_qty', 'label' => __('reports.col_total_milk'), 'align' => 'right', 'type' => 'qty'],
                ['key' => 'avg_fat', 'label' => __('reports.col_fat'), 'align' => 'right', 'type' => 'qty'],
                ['key' => 'amount', 'label' => __('reports.col_amount'), 'align' => 'right', 'type' => 'money'],
            ],
            'rows' => $rows,
            'chart' => null,
        ];
    }

    /** Customer-wise view of one 10-day period incl. bill and payment status. */
    private function tenDay(array $f, bool $paginate, int $perPage): array
    {
        $period = BillingPeriod::forDate($f['date_from'] ?? now()->toDateString());
        $from = $period->start->toDateString();
        $to = $period->end->toDateString();

        $milk = $this->entries($f, $from, $to)
            ->groupBy('customer_id')
            ->select(['customer_id', DB::raw('SUM(quantity) as total_qty'), DB::raw('SUM(amount) as amount')]);

        $query = DB::query()
            ->fromSub($milk, 'm')
            ->join('customers', 'customers.id', '=', 'm.customer_id')
            ->leftJoin('bills', function ($j) use ($from) {
                $j->on('bills.customer_id', '=', 'm.customer_id')
                    ->where('bills.period_start', $from)
                    ->where('bills.status', '!=', 'cancelled');
            })
            ->when($f['payment_status'] ?? null, function ($q, $status) {
                $status === 'unbilled' ? $q->whereNull('bills.id') : $q->where('bills.status', $status);
            })
            ->orderBy('customers.name')
            ->select([
                'm.customer_id', 'customers.code', 'customers.name', 'm.total_qty', 'm.amount',
                'bills.id as bill_id', 'bills.bill_no', 'bills.status as bill_status',
                'bills.net_payable', 'bills.paid_amount', 'bills.outstanding',
            ]);

        $totals = DB::query()->fromSub(clone $query, 't')->selectRaw('
            COUNT(*) as customers, COALESCE(SUM(total_qty),0) as qty, COALESCE(SUM(amount),0) as amount,
            COALESCE(SUM(paid_amount),0) as paid, COALESCE(SUM(outstanding),0) as outstanding,
            SUM(CASE WHEN bill_id IS NULL THEN 1 ELSE 0 END) as unbilled
        ')->first();

        $rows = $this->rows($query, $paginate, $perPage, fn ($r) => [
            'customer_id' => $r->customer_id,
            'code' => $r->code,
            'name' => $r->name,
            'total_qty' => $this->q($r->total_qty),
            'amount' => $this->q($r->amount),
            'bill_id' => $r->bill_id,
            'bill_no' => $r->bill_no,
            'bill_status' => $r->bill_status ?? 'unbilled',
            'paid_amount' => $this->q($r->paid_amount ?? 0),
            'outstanding' => $this->q($r->outstanding ?? 0),
        ]);

        return [
            'type' => 'ten_day',
            'title' => __('reports.ten_day'),
            'subtitle' => $this->range($from, $to),
            'period' => $period->toArray(),
            'summary' => [
                'total_customers' => (int) $totals->customers,
                'total_milk' => $this->q($totals->qty),
                'total_revenue' => $this->q($totals->amount),
                'total_paid' => $this->q($totals->paid),
                'total_outstanding' => $this->q($totals->outstanding),
                'unbilled_customers' => (int) $totals->unbilled,
            ],
            'columns' => [
                ['key' => 'code', 'label' => __('reports.col_code')],
                ['key' => 'name', 'label' => __('reports.col_customer')],
                ['key' => 'total_qty', 'label' => __('reports.col_total_milk'), 'align' => 'right', 'type' => 'qty'],
                ['key' => 'amount', 'label' => __('reports.col_amount'), 'align' => 'right', 'type' => 'money'],
                ['key' => 'bill_no', 'label' => __('reports.col_bill_no')],
                ['key' => 'bill_status', 'label' => __('reports.col_status'), 'type' => 'status'],
                ['key' => 'paid_amount', 'label' => __('reports.col_paid'), 'align' => 'right', 'type' => 'money'],
                ['key' => 'outstanding', 'label' => __('reports.col_outstanding'), 'align' => 'right', 'type' => 'money'],
            ],
            'rows' => $rows,
            'chart' => null,
        ];
    }

    /** Day-by-day totals for a month. */
    private function monthly(array $f): array
    {
        $month = Carbon::parse(($f['month'] ?? null) ?: ($f['date_from'] ?? now()->toDateString()))->startOfMonth();
        $from = $month->toDateString();
        $to = $month->copy()->endOfMonth()->toDateString();

        $days = $this->entries($f, $from, $to)
            ->groupBy('entry_date')
            ->orderBy('entry_date')
            ->get([
                'entry_date',
                DB::raw("COALESCE(SUM(CASE WHEN session='morning' THEN quantity END),0) as morning_qty"),
                DB::raw("COALESCE(SUM(CASE WHEN session='evening' THEN quantity END),0) as evening_qty"),
                DB::raw('SUM(quantity) as total_qty'),
                DB::raw('SUM(amount) as amount'),
                DB::raw('COUNT(DISTINCT customer_id) as customers'),
            ]);

        $customers = (int) $this->entries($f, $from, $to)->distinct()->count('customer_id');
        $paid = $this->payments($f, $from, $to)->sum('amount');

        $rows = $days->map(fn ($r) => [
            'date' => Carbon::parse($r->entry_date)->toDateString(),
            'label' => Carbon::parse($r->entry_date)->format('d/m/Y'),
            'customers' => (int) $r->customers,
            'morning_qty' => $this->q($r->morning_qty),
            'evening_qty' => $this->q($r->evening_qty),
            'total_qty' => $this->q($r->total_qty),
            'amount' => $this->q($r->amount),
        ]);

        return [
            'type' => 'monthly',
            'title' => __('reports.monthly'),
            'subtitle' => $month->translatedFormat('F Y'),
            'summary' => [
                'total_milk' => $this->q($days->sum('total_qty')),
                'total_revenue' => $this->q($days->sum('amount')),
                'total_customers' => $customers,
                'total_paid' => $this->q($paid),
                'total_pending' => $this->pending($f),
                'morning_milk' => $this->q($days->sum('morning_qty')),
                'evening_milk' => $this->q($days->sum('evening_qty')),
            ],
            'columns' => [
                ['key' => 'label', 'label' => __('reports.col_date')],
                ['key' => 'customers', 'label' => __('reports.col_customers'), 'align' => 'right'],
                ['key' => 'morning_qty', 'label' => __('reports.col_morning'), 'align' => 'right', 'type' => 'qty'],
                ['key' => 'evening_qty', 'label' => __('reports.col_evening'), 'align' => 'right', 'type' => 'qty'],
                ['key' => 'total_qty', 'label' => __('reports.col_total_milk'), 'align' => 'right', 'type' => 'qty'],
                ['key' => 'amount', 'label' => __('reports.col_amount'), 'align' => 'right', 'type' => 'money'],
            ],
            'rows' => $rows->values(),
            'chart' => $rows->map(fn ($r) => [
                'label' => Carbon::parse($r['date'])->format('d'),
                'morning' => (float) $r['morning_qty'],
                'evening' => (float) $r['evening_qty'],
                'amount' => (float) $r['amount'],
            ])->values(),
        ];
    }

    /** Month-by-month totals for a year incl. payments and customer growth. */
    private function yearly(array $f): array
    {
        $year = (int) ($f['year'] ?? Carbon::parse($f['date_from'] ?? now())->year);
        $from = "{$year}-01-01";
        $to = "{$year}-12-31";

        $milk = $this->entries($f, $from, $to)
            ->groupBy(DB::raw('MONTH(entry_date)'))
            ->get([
                DB::raw('MONTH(entry_date) as m'),
                DB::raw('SUM(quantity) as qty'),
                DB::raw('SUM(amount) as amount'),
                DB::raw("COALESCE(SUM(CASE WHEN session='morning' THEN quantity END),0) as morning_qty"),
                DB::raw("COALESCE(SUM(CASE WHEN session='evening' THEN quantity END),0) as evening_qty"),
            ])->keyBy('m');

        $payments = $this->payments($f, $from, $to)
            ->groupBy(DB::raw('MONTH(payment_date)'))
            ->get([DB::raw('MONTH(payment_date) as m'), DB::raw('SUM(amount) as amount')])
            ->keyBy('m');

        $growth = Customer::query()
            ->whereBetween('created_at', ["{$from} 00:00:00", "{$to} 23:59:59"])
            ->groupBy(DB::raw('MONTH(created_at)'))
            ->get([DB::raw('MONTH(created_at) as m'), DB::raw('COUNT(*) as c')])
            ->keyBy('m');

        $rows = collect(range(1, 12))->map(fn ($m) => [
            'month' => $m,
            'label' => Carbon::create($year, $m, 1)->translatedFormat('M Y'),
            'morning_qty' => $this->q($milk[$m]->morning_qty ?? 0),
            'evening_qty' => $this->q($milk[$m]->evening_qty ?? 0),
            'total_qty' => $this->q($milk[$m]->qty ?? 0),
            'amount' => $this->q($milk[$m]->amount ?? 0),
            'payments' => $this->q($payments[$m]->amount ?? 0),
            'new_customers' => (int) ($growth[$m]->c ?? 0),
        ]);

        return [
            'type' => 'yearly',
            'title' => __('reports.yearly'),
            'subtitle' => (string) $year,
            'summary' => [
                'total_milk' => $this->q($rows->sum('total_qty')),
                'total_revenue' => $this->q($rows->sum('amount')),
                'total_paid' => $this->q($rows->sum('payments')),
                'total_pending' => $this->pending($f),
                'new_customers' => $rows->sum('new_customers'),
            ],
            'columns' => [
                ['key' => 'label', 'label' => __('reports.col_month')],
                ['key' => 'total_qty', 'label' => __('reports.col_total_milk'), 'align' => 'right', 'type' => 'qty'],
                ['key' => 'amount', 'label' => __('reports.col_amount'), 'align' => 'right', 'type' => 'money'],
                ['key' => 'payments', 'label' => __('reports.col_paid'), 'align' => 'right', 'type' => 'money'],
                ['key' => 'new_customers', 'label' => __('reports.col_new_customers'), 'align' => 'right'],
            ],
            'rows' => $rows->values(),
            'chart' => $rows->map(fn ($r) => [
                'label' => Carbon::create($year, $r['month'], 1)->translatedFormat('M'),
                'milk' => (float) $r['total_qty'],
                'amount' => (float) $r['amount'],
                'payments' => (float) $r['payments'],
            ])->values(),
        ];
    }

    /** Money still owed on live bills (carried-forward bills excluded, so no double counting). */
    public function pending(array $f = []): string
    {
        return $this->q(Bill::query()
            ->open()
            ->where('outstanding', '>', 0)
            ->when($f['customer_id'] ?? null, fn ($q, $id) => $q->where('customer_id', $id))
            ->sum('outstanding'));
    }

    private function entries(array $f, string $from, string $to): Builder
    {
        return MilkEntry::query()
            ->whereBetween('entry_date', [$from, $to])
            ->when($f['customer_id'] ?? null, fn ($q, $id) => $q->where('milk_entries.customer_id', $id))
            ->when($f['session'] ?? null, fn ($q, $s) => $q->where('session', $s));
    }

    private function payments(array $f, string $from, string $to): Builder
    {
        return Payment::query()
            ->whereBetween('payment_date', [$from, $to])
            ->when($f['customer_id'] ?? null, fn ($q, $id) => $q->where('customer_id', $id));
    }

    private function rows($query, bool $paginate, int $perPage, callable $map): LengthAwarePaginator|Collection
    {
        if ($paginate) {
            return $query->paginate($perPage)->through($map);
        }

        // Exports: stream through a lazy cursor so memory stays flat.
        return $query->cursor()->map($map)->collect();
    }

    private function range(string $from, string $to): string
    {
        $a = Carbon::parse($from)->format('d/m/Y');
        $b = Carbon::parse($to)->format('d/m/Y');

        return $a === $b ? $a : "{$a} – {$b}";
    }

    private function q($v): string
    {
        return Decimal::round($v ?? 0, 2);
    }
}
