<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Api\V1\BillController;
use App\Models\Bill;
use App\Models\Tenant;
use App\Services\PdfService;
use App\Support\TenantContext;
use Illuminate\Http\Response;

/**
 * Bill PDF via an expiring signed URL (sent on WhatsApp). The signature covers both
 * bill and tenant id, so the link can't be altered to reach another bill.
 */
class PublicBillController extends Controller
{
    public function __invoke(int $tenant, int $bill, TenantContext $context, PdfService $pdf): Response
    {
        $tenantModel = Tenant::query()->findOrFail($tenant);
        abort_unless($tenantModel->isActive(), 404);

        $context->set($tenantModel);
        $billModel = Bill::query()->findOrFail($bill); // tenant-scoped lookup

        abort_if($billModel->isCancelled(), 404);

        return BillController::pdfResponse($billModel, $pdf);
    }
}
