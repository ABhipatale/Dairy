<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\Customer;
use App\Models\MilkEntry;
use App\Support\BillingPeriod;
use App\Support\Decimal;
use App\Support\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function __construct(
        private readonly TenantContext $tenants,
        private readonly MilkEntryService $entries,
        private readonly ReportService $reports,
    ) {}

    public function overview(): array
    {
        $tz = $this->tenants->tenant()?->timezone ?? config('app.timezone');
        $today = Carbon::now($tz)->toDateString();

        // Short cache: the dashboard is opened constantly, entries change every few seconds.
        return Cache::remember("dashboard:{$this->tenants->id()}:{$today}", 30, function () use ($today) {
            $day = $this->entries->dayTotals($today);
            $period = BillingPeriod::forDate($today);
            $monthStart = Carbon::parse($today)->startOfMonth()->toDateString();

            $todayCustomers = MilkEntry::query()->whereDate('entry_date', $today)->distinct()->count('customer_id');

            $monthRevenue = MilkEntry::query()->whereBetween('entry_date', [$monthStart, $today])->sum('amount');

            $trendFrom = Carbon::parse($today)->subDays(13)->toDateString();
            $trend = MilkEntry::query()
                ->whereBetween('entry_date', [$trendFrom, $today])
                ->groupBy('entry_date')
                ->get([
                    'entry_date',
                    DB::raw("COALESCE(SUM(CASE WHEN session='morning' THEN quantity END),0) as morning"),
                    DB::raw("COALESCE(SUM(CASE WHEN session='evening' THEN quantity END),0) as evening"),
                    DB::raw('SUM(amount) as amount'),
                ])->keyBy(fn ($r) => Carbon::parse($r->entry_date)->toDateString());

            $trendSeries = collect(range(13, 0))->map(function ($i) use ($today, $trend) {
                $d = Carbon::parse($today)->subDays($i)->toDateString();
                $r = $trend[$d] ?? null;

                return [
                    'date' => $d,
                    'morning' => (float) ($r->morning ?? 0),
                    'evening' => (float) ($r->evening ?? 0),
                    'amount' => (float) ($r->amount ?? 0),
                ];
            })->values();

            $monthsFrom = Carbon::parse($today)->startOfMonth()->subMonths(5)->toDateString();
            $monthly = MilkEntry::query()
                ->whereBetween('entry_date', [$monthsFrom, $today])
                ->groupBy(DB::raw("DATE_FORMAT(entry_date, '%Y-%m')"))
                ->get([DB::raw("DATE_FORMAT(entry_date, '%Y-%m') as ym"), DB::raw('SUM(quantity) as qty'), DB::raw('SUM(amount) as amount')])
                ->keyBy('ym');

            $monthlySeries = collect(range(5, 0))->map(function ($i) use ($today, $monthly) {
                $ym = Carbon::parse($today)->startOfMonth()->subMonths($i)->format('Y-m');

                return [
                    'month' => $ym,
                    'quantity' => (float) ($monthly[$ym]->qty ?? 0),
                    'amount' => (float) ($monthly[$ym]->amount ?? 0),
                ];
            })->values();

            $periodBills = Bill::query()
                ->whereDate('period_start', $period->start->toDateString())
                ->where('status', '!=', 'cancelled')
                ->count();

            $lastPeriod = BillingPeriod::lastCompleted($today);
            $toBill = MilkEntry::query()
                ->whereNull('bill_id')
                ->where('entry_date', '<=', $lastPeriod->end->toDateString())
                ->distinct()
                ->count('customer_id');

            return [
                'date' => $today,
                'today' => [
                    'milk' => Decimal::add($day['morning']['quantity'], $day['evening']['quantity']),
                    'revenue' => Decimal::add($day['morning']['amount'], $day['evening']['amount']),
                    'customers' => $todayCustomers,
                    'morning' => $day['morning'],
                    'evening' => $day['evening'],
                ],
                'active_customers' => Customer::query()->where('status', 'active')->count(),
                'pending_payments' => $this->reports->pending(),
                'open_bills' => Bill::query()->open()->where('outstanding', '>', 0)->count(),
                'period' => $period->toArray() + ['bills' => $periodBills],
                'customers_to_bill' => $toBill,
                'month_revenue' => Decimal::round($monthRevenue, 2),
                'trend' => $trendSeries,
                'monthly' => $monthlySeries,
            ];
        });
    }
}
