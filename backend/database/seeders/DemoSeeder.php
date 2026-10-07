<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\MilkEntry;
use App\Models\MilkPrice;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Services\BillingService;
use App\Services\PaymentService;
use App\Support\BillingPeriod;
use App\Support\Decimal;
use App\Support\TenantContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Two demo dairies (to exercise tenant isolation) with ~40 days of realistic entries,
 * bills for completed periods and some payments.
 */
class DemoSeeder extends Seeder
{
    private const NAMES = [
        'Ramesh Patil', 'Suresh Jadhav', 'Ganesh Pawar', 'Mahesh Shinde', 'Sunil Kale', 'Anil Deshmukh',
        'Vijay More', 'Santosh Gaikwad', 'Prakash Bhosale', 'Dattatray Kulkarni', 'Sanjay Chavan', 'Rajesh Salunkhe',
        'Ashok Mane', 'Balasaheb Thorat', 'Vitthal Shelke', 'Shankar Sawant', 'Pandurang Kadam', 'Laxman Gavade',
        'Nitin Wagh', 'Sachin Nikam', 'Kavita Jagtap', 'Sunita Ghorpade', 'Meera Lokhande', 'Anita Kshirsagar',
    ];

    private const VILLAGES = ['Shirur', 'Karegaon', 'Ranjangaon', 'Nhavare', 'Talegaon'];

    public function run(): void
    {
        $context = app(TenantContext::class);

        $this->seedTenant($context, [
            'name' => 'Shree Dairy', 'slug' => 'shree-dairy', 'owner_name' => 'Dnyaneshwar Patil',
            'mobile' => '9822000001', 'whatsapp_number' => '9822000001', 'email' => 'owner@shreedairy.test',
            'address' => 'Main Road, Near Bus Stand', 'city' => 'Shirur', 'state' => 'Maharashtra', 'pincode' => '412210',
            'default_language' => 'mr', 'thank_you_message' => 'Thank you! / धन्यवाद!',
            'invoice_footer' => 'Shree Dairy · Pure milk, honest measure',
        ], adminMobile: '9876543210', customerCount: 24, fat: true);

        $this->seedTenant($context, [
            'name' => 'Gokul Milk Centre', 'slug' => 'gokul-milk', 'owner_name' => 'Ravi Sharma',
            'mobile' => '9811000002', 'email' => 'owner@gokulmilk.test', 'city' => 'Indore', 'state' => 'Madhya Pradesh',
            'default_language' => 'hi',
        ], adminMobile: '9876500000', customerCount: 6, fat: false);
    }

    private function seedTenant(TenantContext $context, array $data, string $adminMobile, int $customerCount, bool $fat): void
    {
        if (Tenant::query()->where('slug', $data['slug'])->exists()) {
            return;
        }

        $tenant = Tenant::query()->create($data);

        $context->runAs($tenant, function () use ($tenant, $adminMobile, $customerCount, $fat) {
            $admin = $this->user($tenant, $tenant->name, $adminMobile, Role::ADMIN);
            auth()->setUser($admin);

            $start = Carbon::today()->subDays(40);

            MilkPrice::query()->create(['effective_from' => $start, 'session' => 'morning', 'method' => 'fixed', 'rate' => 52]);
            MilkPrice::query()->create(['effective_from' => $start, 'session' => 'evening', 'method' => 'fixed', 'rate' => 54]);
            // A price change mid-way (old entries keep their old rate).
            MilkPrice::query()->create(['effective_from' => Carbon::today()->subDays(12), 'session' => 'both', 'method' => 'fixed', 'rate' => 55]);

            mt_srand(crc32($tenant->slug));
            $customers = collect(range(1, $customerCount))->map(fn ($i) => Customer::query()->create([
                'code' => (string) $i,
                'name' => self::NAMES[($i - 1) % count(self::NAMES)],
                'mobile' => '98'.str_pad((string) (mt_rand(10000000, 99999999)), 8, '0'),
                'village' => self::VILLAGES[$i % count(self::VILLAGES)],
                'opening_balance' => $i % 7 === 0 ? 500 : 0,
                'status' => $i === $customerCount ? 'inactive' : 'active',
            ]));

            $rows = [];
            $now = now();

            foreach ($customers->where('status', 'active') as $customer) {
                $base = mt_rand(30, 90) / 10;

                for ($d = 40; $d >= 0; $d--) {
                    $date = Carbon::today()->subDays($d);

                    foreach (['morning', 'evening'] as $session) {
                        if ($d === 0 && $session === 'evening') {
                            continue;
                        }

                        if (mt_rand(1, 100) <= 4) {
                            continue; // occasional missed delivery
                        }

                        $qty = Decimal::round($base + (mt_rand(-8, 8) / 10) - ($session === 'evening' ? 0.6 : 0), 2);
                        $rate = $date->gte(Carbon::today()->subDays(12)) ? '55.00' : ($session === 'morning' ? '52.00' : '54.00');

                        $rows[] = [
                            'tenant_id' => $tenant->id,
                            'customer_id' => $customer->id,
                            'entry_date' => $date->toDateString(),
                            'session' => $session,
                            'quantity' => $qty,
                            'fat' => $fat ? Decimal::round(mt_rand(55, 72) / 10, 2) : null,
                            'rate' => $rate,
                            'rate_source' => 'auto',
                            'pricing_method' => 'fixed',
                            'amount' => Decimal::mul($qty, $rate),
                            'created_by' => $admin->id,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                    }
                }
            }

            foreach (array_chunk($rows, 500) as $chunk) {
                MilkEntry::query()->insert($chunk);
            }

            // Bill completed periods, pay most bills fully and a few partially.
            $billing = app(BillingService::class);
            $payments = app(PaymentService::class);
            $period = BillingPeriod::forDate($start);
            $lastCompleted = BillingPeriod::lastCompleted(Carbon::today());

            while ($period->end->lte($lastCompleted->end)) {
                foreach ($customers->where('status', 'active') as $customer) {
                    try {
                        $bill = $billing->generate($customer, $period);
                    } catch (\Throwable) {
                        continue;
                    }

                    $isLatest = $period->start->equalTo($lastCompleted->start);
                    $roll = mt_rand(1, 10);

                    if (! $isLatest || $roll <= 5) {
                        $amount = $roll <= 2 ? Decimal::round((float) $bill->outstanding / 2, 0) : $bill->outstanding;

                        if (Decimal::cmp($amount, '0') > 0) {
                            $payments->record([
                                'customer_id' => $customer->id,
                                'bill_id' => $bill->id,
                                'payment_date' => $period->end->addDays(2)->min(Carbon::today())->toDateString(),
                                'amount' => $amount,
                                'method' => ['cash', 'upi', 'bank_transfer'][mt_rand(0, 2)],
                            ]);
                        }
                    }
                }

                $period = $period->next();
            }

            auth()->forgetUser();
        });
    }

    private function user(Tenant $tenant, string $name, string $mobile, string $role): User
    {
        $user = new User([
            'name' => $name,
            'mobile' => $mobile,
            'password' => 'Password@123',
            'role_id' => Role::idFor($role),
            'is_active' => true,
        ]);
        $user->tenant_id = $tenant->id;
        $user->save();

        return $user;
    }
}
