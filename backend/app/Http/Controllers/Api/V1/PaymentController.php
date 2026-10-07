<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    public function __construct(private readonly PaymentService $service) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Payment::class);

        $f = $request->validate([
            'customer_id' => ['nullable', 'integer'],
            'method' => ['nullable', Rule::in(Payment::METHODS)],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'between:5,100'],
        ]);

        $query = Payment::query()
            ->with(['customer', 'bill'])
            ->when($f['customer_id'] ?? null, fn ($q, $id) => $q->where('customer_id', $id))
            ->when($f['method'] ?? null, fn ($q, $m) => $q->where('method', $m))
            ->when($f['date_from'] ?? null, fn ($q, $d) => $q->where('payment_date', '>=', $d))
            ->when($f['date_to'] ?? null, fn ($q, $d) => $q->where('payment_date', '<=', $d))
            ->when($f['search'] ?? null, fn ($q, $s) => $q->whereHas('customer', fn ($c) => $c->search($s)))
            ->latest('payment_date')
            ->latest('id');

        $summary = (clone $query)->reorder()->selectRaw('COUNT(*) as count, COALESCE(SUM(amount),0) as total')->first();

        return PaymentResource::collection($query->paginate($f['per_page'] ?? 20)->withQueryString())
            ->additional(['summary' => ['count' => (int) $summary->count, 'total' => number_format((float) $summary->total, 2, '.', '')]]);
    }

    public function store(PaymentRequest $request): JsonResponse
    {
        $this->authorize('create', Payment::class);

        return (new PaymentResource($this->service->record($request->validated())))->response()->setStatusCode(201);
    }

    public function destroy(Payment $payment): JsonResponse
    {
        $this->authorize('delete', $payment);

        $this->service->delete($payment);

        return response()->json(['deleted' => true]);
    }
}
