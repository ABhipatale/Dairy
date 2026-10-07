<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use App\Services\ExcelExporter;
use App\Services\MessageFormatter;
use App\Services\PdfService;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reports) {}

    public function dashboard(DashboardService $dashboard): JsonResponse
    {
        return response()->json($dashboard->overview());
    }

    public function show(Request $request, string $type): JsonResponse
    {
        $f = $this->filters($request, $type);

        return response()->json($this->reports->build($type, $f, true, (int) ($f['per_page'] ?? 25)));
    }

    public function export(Request $request, string $type, PdfService $pdf, ExcelExporter $excel, MessageFormatter $fmt): Response
    {
        $f = $this->filters($request, $type);
        $format = $request->validate(['format' => ['required', Rule::in(['pdf', 'xlsx'])]])['format'];

        $report = $this->reports->build($type, $f, false);
        $summary = collect($report['summary'])->mapWithKeys(fn ($v, $k) => [__('reports.sum_'.$k) => $v])->all();
        $filename = Str::slug($report['title'].' '.$report['subtitle']);

        if ($format === 'xlsx') {
            return $excel->download("{$filename}.xlsx", $report['title'].' — '.$report['subtitle'], $report['columns'], $report['rows'], $summary);
        }

        // PDF: format money/qty columns for print and translate statuses.
        $rows = collect($report['rows'])->map(function ($row) use ($report, $fmt) {
            foreach ($report['columns'] as $col) {
                $v = $row[$col['key']] ?? null;
                $row[$col['key']] = match ($col['type'] ?? null) {
                    'money' => $v === null ? '' : $fmt->money($v),
                    'qty' => $v === null ? '–' : $fmt->num($v),
                    'status' => $v === 'unbilled' ? '–' : __('receipt.status_'.$v),
                    default => $v,
                };
            }

            return $row;
        });

        $content = $pdf->report($report['title'], $report['subtitle'], $report['columns'], $rows, $summary);

        return response($content, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'.pdf"',
        ]);
    }

    private function filters(Request $request, string $type): array
    {
        abort_unless(in_array($type, ReportService::TYPES, true), 404);

        return $request->validate([
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'month' => ['nullable', 'date_format:Y-m'],
            'year' => ['nullable', 'integer', 'between:2000,2100'],
            'customer_id' => ['nullable', 'integer'],
            'session' => ['nullable', Rule::in(['morning', 'evening'])],
            'payment_status' => ['nullable', Rule::in(['generated', 'pending', 'partially_paid', 'paid', 'unbilled'])],
            'per_page' => ['nullable', 'integer', 'between:10,200'],
        ]);
    }
}
