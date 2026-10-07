<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use App\Models\Customer;
use App\Services\BillingService;
use App\Services\PaymentService;
use App\Services\PdfService;
use App\Support\BillingPeriod;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class BillController extends Controller
{
    public function __construct(
        private readonly BillingService $billing,
        private readonly TenantContext $context,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Bill::class);

        $f = $request->validate([
            'status' => ['nullable', Rule::in([...Bill::STATUSES, 'open'])],
            'customer_id' => ['nullable', 'integer'],
            'period_start' => ['nullable', 'date_format:Y-m-d'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'between:5,100'],
        ]);

        $query = Bill::query()
            ->with('customer')
            ->when($f['status'] ?? null, fn ($q, $s) => $s === 'open' ? $q->open()->where('outstanding', '>', 0) : $q->where('status', $s))
            ->when($f['customer_id'] ?? null, fn ($q, $id) => $q->where('customer_id', $id))
            ->when($f['period_start'] ?? null, fn ($q, $d) => $q->whereDate('period_start', $d))
            ->when($f['date_from'] ?? null, fn ($q, $d) => $q->where('bill_date', '>=', $d))
            ->when($f['date_to'] ?? null, fn ($q, $d) => $q->where('bill_date', '<=', $d))
            ->when($f['search'] ?? null, fn ($q, $s) => $q->where(fn ($w) => $w
                ->where('bill_no', 'like', '%'.addcslashes($s, '%_\\').'%')
                ->orWhereHas('customer', fn ($c) => $c->search($s))))
            ->latest('period_start')
            ->latest('id');

        return BillResource::collection($query->paginate($f['per_page'] ?? 20)->withQueryString());
    }

    public function show(Bill $bill): BillResource
    {
        $this->authorize('view', $bill);

        return new BillResource($bill->load(['customer', 'items', 'payments']));
    }

    /** Suggested period + computed preview (nothing is saved). */
    public function preview(Request $request): JsonResponse
    {
        $this->authorize('create', Bill::class);

        [$customer, $period, $data] = $this->input($request);

        return response()->json([
            'period' => $period->toArray(),
            'previous_period' => $period->previous()->toArray(),
            'next_period' => $period->next()->toArray(),
            'preview' => $this->billing->preview($customer, $period, $data['discount'] ?? 0),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Bill::class);

        [$customer, $period, $data] = $this->input($request);

        $bill = $this->billing->generate($customer, $period, $data['discount'] ?? 0, $data['notes'] ?? null);

        return (new BillResource($bill->load('payments')))->response()->setStatusCode(201);
    }

    /**
     * Generate bills for every customer with unbilled milk in a period.
     * Errors for single customers are collected, not fatal.
     */
    public function bulkGenerate(Request $request): JsonResponse
    {
        $this->authorize('create', Bill::class);

        $data = $request->validate(['period_start' => ['required', 'date_format:Y-m-d']]);
        $period = BillingPeriod::forDate($data['period_start']);

        $customerIds = \App\Models\MilkEntry::query()
            ->whereNull('bill_id')
            ->whereBetween('entry_date', [$period->start->toDateString(), $period->end->toDateString()])
            ->distinct()
            ->limit(5000)
            ->pluck('customer_id');

        $created = 0;
        $skipped = [];

        foreach (Customer::query()->whereIn('id', $customerIds)->cursor() as $customer) {
            try {
                $this->billing->generate($customer, $period);
                $created++;
            } catch (BusinessException $e) {
                $skipped[] = ['customer' => $customer->name, 'reason' => $e->userMessage()];
            }
        }

        return response()->json(['created' => $created, 'skipped' => $skipped, 'period' => $period->toArray()]);
    }

    public function update(Request $request, Bill $bill): BillResource
    {
        $this->authorize('update', $bill);

        $data = $request->validate([
            'discount' => ['sometimes', 'numeric', 'gte:0', 'max:9999999'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        if (array_key_exists('notes', $data)) {
            $bill->notes = $data['notes'];
            $bill->save();
        }

        if (array_key_exists('discount', $data)) {
            $bill = $this->billing->updateDiscount($bill, $data['discount']);
        }

        return new BillResource($bill->load(['customer', 'items', 'payments']));
    }

    public function cancel(Request $request, Bill $bill): BillResource
    {
        $this->authorize('delete', $bill);

        $data = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);

        return new BillResource($this->billing->cancel($bill, $data['reason'] ?? null)->load('customer'));
    }

    public function markSent(Bill $bill): BillResource
    {
        $this->authorize('view', $bill);

        return new BillResource($this->billing->markSent($bill)->load('customer'));
    }

    /** "Mark as Paid": records a payment for the full outstanding amount. */
    public function markPaid(Request $request, Bill $bill, PaymentService $payments): BillResource
    {
        $this->authorize('create', \App\Models\Payment::class);

        $data = $request->validate([
            'method' => ['required', Rule::in(\App\Models\Payment::METHODS)],
            'payment_date' => ['nullable', 'date_format:Y-m-d'],
            'reference' => ['nullable', 'string', 'max:100'],
        ]);

        if ((float) $bill->outstanding > 0) {
            $payments->record([
                'customer_id' => $bill->customer_id,
                'bill_id' => $bill->id,
                'amount' => $bill->outstanding,
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'payment_date' => $data['payment_date'] ?? now($this->context->tenant()->timezone)->toDateString(),
            ]);
        }

        return new BillResource($bill->fresh(['customer', 'items', 'payments']));
    }

    public function pdf(Bill $bill, PdfService $pdf): Response
    {
        $this->authorize('view', $bill);

        return $this->pdfResponse($bill, $pdf, request()->boolean('download'));
    }

    public static function pdfResponse(Bill $bill, PdfService $pdf, bool $download = false): Response
    {
        try {
            $content = $pdf->bill($bill);
        } catch (\Throwable $e) {
            report($e);
            throw new BusinessException('pdf_failed', 500);
        }

        return response($content, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => ($download ? 'attachment' : 'inline').'; filename="'.$bill->bill_no.'.pdf"',
        ]);
    }

    /** @return array{0: Customer, 1: BillingPeriod, 2: array} */
    private function input(Request $request): array
    {
        $data = $request->validate([
            'customer_id' => ['required', 'integer', Rule::exists('customers', 'id')->where('tenant_id', $this->context->id())],
            'period_start' => ['nullable', 'date_format:Y-m-d'],
            'discount' => ['nullable', 'numeric', 'gte:0', 'max:9999999'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $customer = Customer::query()->findOrFail($data['customer_id']);
        $period = isset($data['period_start'])
            ? BillingPeriod::forDate($data['period_start'])
            : $this->billing->suggestPeriod($customer);

        return [$customer, $period, $data];
    }
}
