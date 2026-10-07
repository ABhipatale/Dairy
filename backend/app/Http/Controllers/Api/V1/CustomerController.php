<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CustomerRequest;
use App\Http\Resources\BillResource;
use App\Http\Resources\CustomerResource;
use App\Http\Resources\MilkEntryResource;
use App\Http\Resources\PaymentResource;
use App\Models\Customer;
use App\Models\MilkEntry;
use App\Services\BillingService;
use App\Services\LedgerService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function __construct(
        private readonly LedgerService $ledger,
        private readonly BillingService $billing,
        private readonly TenantContext $context,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Customer::class);

        $f = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'village' => ['nullable', 'string', 'max:120'],
            'sort' => ['nullable', Rule::in(['name', 'code', 'created_at', 'village'])],
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'between:5,100'],
        ]);

        $sort = $f['sort'] ?? 'name';
        $dir = $f['dir'] ?? 'asc';

        $query = Customer::query()
            ->search($f['search'] ?? null)
            ->when($f['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($f['village'] ?? null, fn ($q, $v) => $q->where('village', $v));

        // Numeric codes sort naturally (2 before 10).
        $sort === 'code'
            ? $query->orderByRaw('LENGTH(code) '.$dir)->orderBy('code', $dir)
            : $query->orderBy($sort, $dir);

        return CustomerResource::collection($query->paginate($f['per_page'] ?? 20)->withQueryString());
    }

    /**
     * Compact list of active customers for the fast entry picker and offline cache.
     * Only the fields the picker needs, so even large dairies stay small.
     */
    public function lookup(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Customer::class);

        $request->validate(['updated_since' => ['nullable', 'date']]);

        $rows = Customer::query()
            ->when($request->input('updated_since'), fn ($q, $since) => $q->withTrashed()->where('updated_at', '>=', $since))
            ->orderByRaw('LENGTH(code), code')
            ->limit(20000)
            ->get(['id', 'code', 'name', 'mobile', 'whatsapp', 'village', 'status', 'deleted_at'])
            ->map(fn ($c) => [
                'id' => $c->id, 'code' => $c->code, 'name' => $c->name, 'mobile' => $c->mobile,
                'whatsapp' => $c->whatsapp, 'village' => $c->village,
                'active' => $c->status === 'active' && $c->deleted_at === null,
            ]);

        return response()->json(['data' => $rows, 'synced_at' => now()->toIso8601String()]);
    }

    public function nextCode(): JsonResponse
    {
        $this->authorize('create', Customer::class);

        return response()->json(['code' => $this->generateCode()]);
    }

    public function store(CustomerRequest $request): JsonResponse
    {
        $this->authorize('create', Customer::class);

        $data = $request->validated();
        $data['code'] ??= $this->generateCode();
        $data['opening_balance'] ??= 0;
        $data['status'] ??= 'active';

        $customer = new Customer($data);
        $customer->created_by = $request->user()->id;
        $customer->save();

        return (new CustomerResource($customer))->response()->setStatusCode(201);
    }

    public function show(Customer $customer): JsonResponse
    {
        $this->authorize('view', $customer);

        $today = now($this->context->tenant()->timezone)->toDateString();
        $from = Carbon::parse($today)->subDays(9)->toDateString();

        $todayEntries = MilkEntry::query()
            ->where('customer_id', $customer->id)
            ->whereDate('entry_date', $today)
            ->get()
            ->keyBy('session');

        $suggested = $this->billing->suggestPeriod($customer, $today);

        return response()->json([
            'data' => new CustomerResource($customer),
            'today' => [
                'morning' => isset($todayEntries['morning']) ? new MilkEntryResource($todayEntries['morning']) : null,
                'evening' => isset($todayEntries['evening']) ? new MilkEntryResource($todayEntries['evening']) : null,
            ],
            'balance' => $this->ledger->balance($customer),
            'unbilled' => $this->ledger->unbilled($customer),
            'last_10_days' => $this->ledger->summary($customer, $from, $today),
            'suggested_period' => $suggested->toArray(),
            'latest_bill' => ($b = $customer->bills()->where('status', '!=', 'cancelled')->latest('period_start')->first())
                ? new BillResource($b) : null,
        ]);
    }

    public function update(CustomerRequest $request, Customer $customer): CustomerResource
    {
        $this->authorize('update', $customer);

        $data = $request->validated();
        $data['code'] ??= $customer->code;
        $data['opening_balance'] ??= $customer->opening_balance;
        $data['status'] ??= $customer->status;

        $customer->fill($data);
        $customer->updated_by = $request->user()->id;
        $customer->save();

        return new CustomerResource($customer);
    }

    /** Customers with history are deactivated, never deleted, so bills stay intact. */
    public function destroy(Customer $customer): JsonResponse
    {
        $this->authorize('delete', $customer);

        $hasHistory = $customer->milkEntries()->exists() || $customer->bills()->exists() || $customer->payments()->exists();

        if ($hasHistory) {
            $customer->update(['status' => 'inactive']);

            return response()->json(['deleted' => false, 'deactivated' => true, 'message' => __('errors.customer_has_records')]);
        }

        $customer->delete();

        return response()->json(['deleted' => true]);
    }

    public function entries(Request $request, Customer $customer): AnonymousResourceCollection
    {
        $this->authorize('view', $customer);

        $f = $request->validate([
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'per_page' => ['nullable', 'integer', 'between:5,100'],
        ]);

        return MilkEntryResource::collection(
            $customer->milkEntries()
                ->when($f['date_from'] ?? null, fn ($q, $d) => $q->where('entry_date', '>=', $d))
                ->when($f['date_to'] ?? null, fn ($q, $d) => $q->where('entry_date', '<=', $d))
                ->orderByDesc('entry_date')
                ->orderByRaw("FIELD(session, 'evening', 'morning')")
                ->paginate($f['per_page'] ?? 20)
        );
    }

    public function bills(Customer $customer): AnonymousResourceCollection
    {
        $this->authorize('view', $customer);

        return BillResource::collection($customer->bills()->latest('period_start')->paginate(20));
    }

    public function payments(Customer $customer): AnonymousResourceCollection
    {
        $this->authorize('view', $customer);

        return PaymentResource::collection($customer->payments()->with('bill')->latest('payment_date')->latest('id')->paginate(20));
    }

    public function villages(): JsonResponse
    {
        $this->authorize('viewAny', Customer::class);

        return response()->json([
            'data' => Customer::query()->whereNotNull('village')->distinct()->orderBy('village')->pluck('village'),
        ]);
    }

    /** Next numeric code: max numeric code + 1 (codes are what operators type). */
    private function generateCode(): string
    {
        $max = Customer::query()->withTrashed()
            ->whereRaw("code REGEXP '^[0-9]+$'")
            ->max(DB::raw('CAST(code AS UNSIGNED)'));

        return (string) (((int) $max) + 1);
    }
}
