<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Bill;
use App\Models\MilkEntry;
use App\Models\PrintLog;
use App\Services\BillingService;
use App\Services\WhatsApp\WhatsAppService;
use App\Support\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** WhatsApp links, print logging and the audit trail. */
class CommunicationController extends Controller
{
    public function __construct(
        private readonly WhatsAppService $whatsapp,
        private readonly TenantContext $context,
    ) {}

    public function whatsappEntry(MilkEntry $entry): JsonResponse
    {
        $this->authorize('view', $entry);

        return response()->json($this->whatsapp->sendEntry($entry));
    }

    public function whatsappBill(Bill $bill, BillingService $billing): JsonResponse
    {
        $this->authorize('view', $bill);

        $result = $this->whatsapp->sendBill($bill);
        $billing->markSent($bill);

        return response()->json($result);
    }

    /** The browser prints locally; we record the outcome for traceability. */
    public function logPrint(Request $request): JsonResponse
    {
        $data = $request->validate([
            'document_type' => ['required', Rule::in(['entry_receipt', 'bill', 'report', 'test'])],
            'reference_id' => ['nullable', 'integer'],
            'connection_type' => ['required', Rule::in(['browser', 'bluetooth'])],
            'status' => ['required', Rule::in(['success', 'failed'])],
            'error' => ['nullable', 'string', 'max:500'],
        ]);

        PrintLog::query()->create($data + ['user_id' => $request->user()->id]);

        return response()->json(['ok' => true], 201);
    }

    public function audit(Request $request): JsonResponse
    {
        $f = $request->validate([
            'action' => ['nullable', 'string', 'max:60'],
            'entity_type' => ['nullable', 'string', 'max:60'],
            'user_id' => ['nullable', 'integer'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        // Explicit tenant filter: audit_logs has no global scope (see AuditLog).
        $logs = AuditLog::query()
            ->where('tenant_id', $this->context->id())
            ->with('user:id,name')
            ->when($f['action'] ?? null, fn ($q, $a) => $q->where('action', 'like', addcslashes($a, '%_\\').'%'))
            ->when($f['entity_type'] ?? null, fn ($q, $t) => $q->where('entity_type', $t))
            ->when($f['user_id'] ?? null, fn ($q, $u) => $q->where('user_id', $u))
            ->when($f['date_from'] ?? null, fn ($q, $d) => $q->where('created_at', '>=', $d.' 00:00:00'))
            ->when($f['date_to'] ?? null, fn ($q, $d) => $q->where('created_at', '<=', $d.' 23:59:59'))
            ->latest('id')
            ->paginate(30);

        return response()->json($logs);
    }
}
