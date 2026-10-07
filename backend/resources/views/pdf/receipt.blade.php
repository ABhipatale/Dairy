<html>
<head>
<style>
    body { font-family: dejavusans; font-size: 9pt; color: #0f172a; }
    .c { text-align: center; }
    .r { text-align: right; }
    .muted { color: #64748b; }
    hr { border: 0; border-top: 0.3mm dashed #94a3b8; margin: 2mm 0; }
    td { padding: 0.6mm 0; }
</style>
</head>
<body>
    <div class="c" style="font-size:12pt;font-weight:bold">{{ $tenant->name }}</div>
    @if($tenant->mobile)<div class="c muted">{{ $tenant->mobile }}</div>@endif
    <hr>
    <div class="c" style="font-weight:bold">{{ __('receipt.milk_entry') }}</div>
    <hr>
    <table width="100%">
        <tr><td class="muted">{{ __('receipt.customer') }}</td><td class="r"><b>{{ $entry->customer->name }}</b> ({{ $entry->customer->code }})</td></tr>
        <tr><td class="muted">{{ __('receipt.date') }}</td><td class="r">{{ $entry->entry_date->format('d/m/Y') }}</td></tr>
        <tr><td class="muted">{{ __('receipt.session') }}</td><td class="r">{{ __('common.'.$entry->session) }}</td></tr>
        <tr><td class="muted">{{ __('receipt.milk') }}</td><td class="r">{{ $fmt->num($entry->quantity) }} {{ __('receipt.litre_short') }}</td></tr>
        @if($entry->fat !== null)
            <tr><td class="muted">{{ __('receipt.fat') }}</td><td class="r">{{ $fmt->num($entry->fat) }}</td></tr>
        @endif
        <tr><td class="muted">{{ __('receipt.rate') }}</td><td class="r">{{ $fmt->money($entry->rate) }}/{{ __('receipt.litre_short') }}</td></tr>
    </table>
    <hr>
    <table width="100%">
        <tr><td style="font-size:11pt"><b>{{ __('receipt.amount') }}</b></td><td class="r" style="font-size:12pt"><b>{{ $fmt->money($entry->amount) }}</b></td></tr>
    </table>
    <hr>
    <div class="c muted">{{ $tenant->thank_you_message ?: __('receipt.thank_you') }}</div>
</body>
</html>
