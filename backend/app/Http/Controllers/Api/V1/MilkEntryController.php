<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Http\Requests\MilkEntryRequest;
use App\Http\Resources\MilkEntryResource;
use App\Models\MilkEntry;
use App\Services\MilkEntryService;
use App\Services\PdfService;
use App\Services\Pricing\PricingService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class MilkEntryController extends Controller
{
    public function __construct(
        private readonly MilkEntryService $service,
        private readonly TenantContext $context,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', MilkEntry::class);

        $f = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
            'session' => ['nullable', Rule::in(MilkEntry::SESSIONS)],
            'customer_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:100'],
            'billed' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'between:5,200'],
        ]);

        $query = MilkEntry::query()
            ->with(['customer', 'creator'])
            ->when($f['date'] ?? null, fn ($q, $d) => $q->whereDate('entry_date', $d))
            ->when($f['date_from'] ?? null, fn ($q, $d) => $q->where('entry_date', '>=', $d))
            ->when($f['date_to'] ?? null, fn ($q, $d) => $q->where('entry_date', '<=', $d))
            ->when($f['session'] ?? null, fn ($q, $s) => $q->where('session', $s))
            ->when($f['customer_id'] ?? null, fn ($q, $id) => $q->where('customer_id', $id))
            ->when(isset($f['billed']), fn ($q) => $f['billed'] ? $q->whereNotNull('bill_id') : $q->whereNull('bill_id'))
            ->when($f['search'] ?? null, fn ($q, $s) => $q->whereHas('customer', fn ($c) => $c->search($s)))
            ->orderByDesc('entry_date')
            ->orderByDesc('id');

        return MilkEntryResource::collection($query->paginate($f['per_page'] ?? 30)->withQueryString());
    }

    /** Today's (or a date's) entries plus session totals, for the collection screen. */
    public function day(Request $request): JsonResponse
    {
        $this->authorize('viewAny', MilkEntry::class);

        $f = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'session' => ['nullable', Rule::in(MilkEntry::SESSIONS)],
        ]);

        $date = $f['date'] ?? now($this->context->tenant()->timezone)->toDateString();

        $entries = MilkEntry::query()
            ->with('customer')
            ->whereDate('entry_date', $date)
            ->when($f['session'] ?? null, fn ($q, $s) => $q->where('session', $s))
            ->latest('id')
            ->limit(500)
            ->get();

        return response()->json([
            'date' => $date,
            'totals' => $this->service->dayTotals($date),
            'data' => MilkEntryResource::collection($entries),
        ]);
    }

    public function store(MilkEntryRequest $request): JsonResponse
    {
        $this->authorize('create', MilkEntry::class);

        [$entry, $replay] = $this->service->create($request->validated());

        return (new MilkEntryResource($entry->loadMissing('customer')))
            ->additional(['meta' => ['duplicate_replay' => $replay]])
            ->response()
            ->setStatusCode($replay ? 200 : 201);
    }

    /**
     * Offline sync: many queued entries in one request. Each result is reported
     * individually so one bad entry never blocks the rest of the queue.
     */
    public function sync(Request $request): JsonResponse
    {
        $this->authorize('create', MilkEntry::class);

        $request->validate([
            'entries' => ['required', 'array', 'max:200'],
            'entries.*.client_uuid' => ['required', 'uuid'],
        ]);

        $results = [];

        foreach ($request->input('entries') as $payload) {
            $uuid = $payload['client_uuid'];

            try {
                $data = validator($payload, (new MilkEntryRequest)->rules())->validate();
                [$entry, $replay] = $this->service->create($data);
                $results[] = ['client_uuid' => $uuid, 'status' => $replay ? 'duplicate_replay' : 'created', 'entry' => new MilkEntryResource($entry->loadMissing('customer'))];
            } catch (BusinessException $e) {
                $results[] = ['client_uuid' => $uuid, 'status' => 'rejected', 'code' => $e->errorCode, 'message' => $e->userMessage(), 'context' => $e->context];
            } catch (\Illuminate\Validation\ValidationException $e) {
                $results[] = ['client_uuid' => $uuid, 'status' => 'rejected', 'code' => 'validation_failed', 'message' => collect($e->errors())->flatten()->first()];
            }
        }

        return response()->json(['results' => $results]);
    }

    public function show(MilkEntry $entry): MilkEntryResource
    {
        $this->authorize('view', $entry);

        return new MilkEntryResource($entry->load(['customer', 'creator']));
    }

    public function update(MilkEntryRequest $request, MilkEntry $entry): MilkEntryResource
    {
        $this->authorize('update', $entry);

        return new MilkEntryResource($this->service->update($entry, $request->validated()));
    }

    public function destroy(MilkEntry $entry): JsonResponse
    {
        $this->authorize('delete', $entry);

        $this->service->delete($entry);

        return response()->json(['deleted' => true]);
    }

    /** Live rate/amount preview while the operator types. */
    public function calculate(Request $request): JsonResponse
    {
        $this->authorize('create', MilkEntry::class);

        $f = $request->validate([
            'entry_date' => ['required', 'date_format:Y-m-d'],
            'session' => ['required', Rule::in(MilkEntry::SESSIONS)],
            'quantity' => ['required', 'numeric', 'gte:0', 'max:10000'],
            'fat' => ['nullable', 'numeric', 'between:0,15'],
            'rate' => ['nullable', 'numeric', 'gte:0'],
        ]);

        return response()->json($this->service->calculate(
            $f['entry_date'], $f['session'], (string) $f['quantity'], isset($f['fat']) ? (string) $f['fat'] : null, isset($f['rate']) ? (string) $f['rate'] : null,
        ));
    }

    public function prices(PricingService $pricing, Request $request): JsonResponse
    {
        $date = $request->validate(['date' => ['nullable', 'date_format:Y-m-d']])['date']
            ?? now($this->context->tenant()->timezone)->toDateString();

        return response()->json(['date' => $date, 'prices' => $pricing->current($date)]);
    }

    public function pdf(MilkEntry $entry, PdfService $pdf): Response
    {
        $this->authorize('view', $entry);

        try {
            $content = $pdf->entryReceipt($entry);
        } catch (\Throwable $e) {
            report($e);
            throw new BusinessException('pdf_failed', 500);
        }

        $name = 'receipt-'.$entry->entry_date->format('Ymd').'-'.$entry->session.'-'.$entry->id.'.pdf';

        return response($content, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$name.'"',
        ]);
    }
}
