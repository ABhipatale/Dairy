<?php

use App\Http\Controllers\Api\V1\Admin\PlatformController;
use App\Http\Controllers\Api\V1\Admin\TenantController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BillController;
use App\Http\Controllers\Api\V1\CommunicationController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\MilkEntryController;
use App\Http\Controllers\Api\V1\MilkPriceController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\PublicBillController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

    // Signed, expiring link used in WhatsApp bill messages.
    Route::get('public/bills/{tenant}/{bill}.pdf', PublicBillController::class)
        ->middleware(['signed', 'throttle:30,1'])
        ->whereNumber(['tenant', 'bill'])
        ->name('public.bills.pdf');

    Route::middleware(['auth:sanctum', 'active_user', 'throttle:api'])->group(function () {

        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::put('auth/profile', [AuthController::class, 'updateProfile']);

        /* ───────── Dairy company (tenant) API ───────── */
        Route::middleware('tenant')->group(function () {

            Route::get('dashboard', [ReportController::class, 'dashboard'])->middleware('can:milk.view');

            // Customers
            Route::get('customers/lookup', [CustomerController::class, 'lookup']);
            Route::get('customers/next-code', [CustomerController::class, 'nextCode']);
            Route::get('customers/villages', [CustomerController::class, 'villages']);
            Route::get('customers/{customer}/entries', [CustomerController::class, 'entries']);
            Route::get('customers/{customer}/bills', [CustomerController::class, 'bills']);
            Route::get('customers/{customer}/payments', [CustomerController::class, 'payments']);
            Route::apiResource('customers', CustomerController::class);

            // Milk collection
            Route::get('milk-entries/day', [MilkEntryController::class, 'day']);
            Route::get('milk-entries/prices', [MilkEntryController::class, 'prices'])->middleware('can:milk.view');
            Route::post('milk-entries/calculate', [MilkEntryController::class, 'calculate']);
            Route::post('milk-entries/sync', [MilkEntryController::class, 'sync']);
            Route::get('milk-entries/{entry}/pdf', [MilkEntryController::class, 'pdf']);
            Route::post('milk-entries/{entry}/whatsapp', [CommunicationController::class, 'whatsappEntry'])->middleware('throttle:whatsapp');
            Route::apiResource('milk-entries', MilkEntryController::class)->parameters(['milk-entries' => 'entry']);

            // Pricing
            Route::get('milk-prices', [MilkPriceController::class, 'index'])->middleware('can:milk.view');
            Route::post('milk-prices', [MilkPriceController::class, 'store']);
            Route::put('milk-prices/{price}', [MilkPriceController::class, 'update']);
            Route::delete('milk-prices/{price}', [MilkPriceController::class, 'destroy']);

            // Billing
            Route::post('bills/preview', [BillController::class, 'preview']);
            Route::post('bills/bulk-generate', [BillController::class, 'bulkGenerate']);
            Route::get('bills/{bill}/pdf', [BillController::class, 'pdf']);
            Route::post('bills/{bill}/cancel', [BillController::class, 'cancel']);
            Route::post('bills/{bill}/mark-sent', [BillController::class, 'markSent']);
            Route::post('bills/{bill}/mark-paid', [BillController::class, 'markPaid']);
            Route::post('bills/{bill}/whatsapp', [CommunicationController::class, 'whatsappBill'])->middleware('throttle:whatsapp');
            Route::apiResource('bills', BillController::class)->except('destroy');

            // Payments
            Route::apiResource('payments', PaymentController::class)->only(['index', 'store', 'destroy']);

            // Reports
            Route::middleware('can:reports.view')->group(function () {
                Route::get('reports/{type}', [ReportController::class, 'show']);
                Route::get('reports/{type}/export', [ReportController::class, 'export']);
            });

            // Printing
            Route::post('print-logs', [CommunicationController::class, 'logPrint']);

            // Settings & administration
            Route::middleware('can:settings.manage')->group(function () {
                Route::get('settings', [SettingsController::class, 'index']);
                Route::post('settings/company', [SettingsController::class, 'updateCompany']); // multipart (logo)
                Route::put('settings/{group}', [SettingsController::class, 'update']);
            });

            Route::get('audit-logs', [CommunicationController::class, 'audit'])->middleware('can:audit.view');
        });

        /* ───────── Super admin API ───────── */
        Route::prefix('admin')->middleware('super_admin')->group(function () {
            Route::get('stats', [PlatformController::class, 'stats']);
            Route::get('tenants/{tenant}/login', [TenantController::class, 'login']);
            Route::put('tenants/{tenant}/login', [TenantController::class, 'updateLogin']);
            Route::post('tenants/{tenant}', [TenantController::class, 'update']); // multipart (logo)
            Route::apiResource('tenants', TenantController::class);
            Route::get('languages', [PlatformController::class, 'languages']);
            Route::put('languages/{language}', [PlatformController::class, 'updateLanguage']);
            Route::get('settings', [PlatformController::class, 'settings']);
            Route::put('settings', [PlatformController::class, 'updateSettings']);
            Route::get('audit-logs', [PlatformController::class, 'audit']);
        });
    });
});
