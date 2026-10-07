<html>
<head>
<style>
    body { font-family: dejavusans; font-size: 9pt; color: #0f172a; }
    .muted { color: #64748b; }
    table { border-collapse: collapse; }
    .grid th { background: #f1f5f9; font-size: 8pt; text-transform: uppercase; color: #334155; padding: 2mm; border-bottom: 0.4mm solid #cbd5e1; }
    .grid td { padding: 1.5mm 2mm; border-bottom: 0.2mm solid #e2e8f0; }
    .grid tr.alt td { background: #f8fafc; }
    .stat { border: 0.3mm solid #e2e8f0; padding: 2.5mm; }
    .stat .v { font-size: 12pt; font-weight: bold; }
</style>
</head>
<body>
    <table width="100%">
        <tr>
            <td>
                <div style="font-size:15pt;font-weight:bold">{{ $tenant->name }}</div>
                <div class="muted">{{ $tenant->fullAddress() }}</div>
            </td>
            <td align="right" valign="top">
                <div style="font-size:12pt;font-weight:bold;color:#0369a1">{{ $title }}</div>
                <div class="muted">{{ $subtitle }}</div>
                <div class="muted" style="font-size:7.5pt">{{ __('receipt.generated_on') }}: {{ now($tenant->timezone)->format('d/m/Y H:i') }}</div>
            </td>
        </tr>
    </table>

    @if($summary)
        <table width="100%" style="margin-top:4mm" cellspacing="2">
            <tr>
                @foreach($summary as $label => $value)
                    <td class="stat"><div class="muted" style="font-size:7.5pt">{{ $label }}</div><div class="v">{{ $value }}</div></td>
                @endforeach
            </tr>
        </table>
    @endif

    <table width="100%" class="grid" style="margin-top:4mm">
        <thead>
            <tr>
                @foreach($columns as $col)
                    <th align="{{ $col['align'] ?? 'left' }}">{{ $col['label'] }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse($rows as $i => $row)
                <tr class="{{ $i % 2 ? 'alt' : '' }}">
                    @foreach($columns as $col)
                        <td align="{{ $col['align'] ?? 'left' }}">{{ $row[$col['key']] ?? '' }}</td>
                    @endforeach
                </tr>
            @empty
                <tr><td colspan="{{ count($columns) }}" align="center" class="muted">{{ __('receipt.no_data') }}</td></tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
