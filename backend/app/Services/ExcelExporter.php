<?php

namespace App\Services;

use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Streams a report as .xlsx without building it in memory. */
class ExcelExporter
{
    public function download(string $filename, string $title, array $columns, iterable $rows, array $summary = []): StreamedResponse
    {
        return response()->streamDownload(function () use ($title, $columns, $rows, $summary) {
            $writer = new Writer;
            $writer->openToFile('php://output');

            $bold = (new Style)->setFontBold();
            $writer->addRow(Row::fromValues([$title], $bold));

            foreach ($summary as $label => $value) {
                $writer->addRow(Row::fromValues([$label, $value]));
            }

            if ($summary) {
                $writer->addRow(Row::fromValues([]));
            }

            $writer->addRow(Row::fromValues(array_column($columns, 'label'), $bold));

            foreach ($rows as $row) {
                $writer->addRow(Row::fromValues(array_map(function ($col) use ($row) {
                    $v = $row[$col['key']] ?? '';

                    return in_array($col['type'] ?? null, ['qty', 'money'], true) && is_numeric($v) ? (float) $v : $v;
                }, $columns)));
            }

            $writer->close();
        }, $filename, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }
}
