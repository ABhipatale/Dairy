<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\MilkEntry;
use App\Support\TenantContext;
use Mpdf\Mpdf;

/**
 * PDF rendering via mPDF (chosen for proper Devanagari shaping for Marathi/Hindi).
 */
class PdfService
{
    public function __construct(
        private readonly TenantContext $tenants,
        private readonly MessageFormatter $formatter,
        private readonly SettingsService $settings,
    ) {}

    public function bill(Bill $bill): string
    {
        $bill->loadMissing(['customer', 'items', 'payments']);

        return $this->render('pdf.bill', [
            'bill' => $bill,
            'showFat' => (bool) $this->settings->value('billing', 'show_fat_on_bill', true),
        ], ['format' => 'A4', 'margin_top' => 12, 'margin_bottom' => 14, 'margin_left' => 12, 'margin_right' => 12], footer: true);
    }

    /** Compact daily receipt sized for phone sharing (≈ 80 mm wide page). */
    public function entryReceipt(MilkEntry $entry): string
    {
        $entry->loadMissing('customer');
        $lines = $entry->fat !== null ? 9 : 8;

        return $this->render('pdf.receipt', ['entry' => $entry], [
            'format' => [80, 60 + $lines * 7],
            'margin_top' => 4, 'margin_bottom' => 4, 'margin_left' => 4, 'margin_right' => 4,
        ]);
    }

    /**
     * Generic tabular report.
     *
     * @param  array<int, array{key: string, label: string, align?: string}>  $columns
     */
    public function report(string $title, string $subtitle, array $columns, iterable $rows, array $summary = []): string
    {
        return $this->render('pdf.report', compact('title', 'subtitle', 'columns', 'rows', 'summary'), [
            'format' => count($columns) > 7 ? 'A4-L' : 'A4',
            'margin_top' => 12, 'margin_bottom' => 14, 'margin_left' => 10, 'margin_right' => 10,
        ], footer: true);
    }

    private function render(string $view, array $data, array $config, bool $footer = false): string
    {
        $tenant = $this->tenants->tenant();

        return $this->formatter->inLocale(function () use ($view, $data, $config, $footer, $tenant) {
            $tmp = storage_path('app/mpdf');

            if (! is_dir($tmp)) {
                mkdir($tmp, 0775, true);
            }

            $mpdf = new Mpdf(array_merge([
                'mode' => 'utf-8',
                'tempDir' => $tmp,
                'default_font' => 'dejavusans',
                'autoScriptToLang' => true,
                'autoLangToFont' => true,
            ], $config));

            $mpdf->SetTitle($data['title'] ?? $tenant?->name ?? 'Document');
            $mpdf->SetCreator(config('app.name'));

            if ($footer) {
                $mpdf->SetHTMLFooter('<table width="100%" style="font-size:8pt;color:#64748b;border-top:0.3mm solid #e2e8f0;padding-top:2mm"><tr>'
                    .'<td>'.e($tenant?->invoice_footer ?: $tenant?->name).'</td>'
                    .'<td align="right">{PAGENO}/{nbpg}</td></tr></table>');
            }

            $html = view($view, $data + [
                'tenant' => $tenant,
                'logo' => $this->settings->value('printer', 'print_logo', true) ? $tenant?->logoAbsolutePath() : null,
                'fmt' => $this->formatter,
            ])->render();

            $mpdf->WriteHTML($html);

            return $mpdf->Output('', 'S');
        });
    }
}
