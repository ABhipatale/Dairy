<html>
<head>
<style>
    body { font-family: dejavusans; font-size: 9.5pt; color: #0f172a; }
    .muted { color: #64748b; }
    .brand { font-size: 17pt; font-weight: bold; color: #0f172a; }
    .title { font-size: 13pt; font-weight: bold; letter-spacing: 1pt; color: #0369a1; }
    .box { border: 0.3mm solid #e2e8f0; padding: 3mm; }
    table { border-collapse: collapse; }
    .items th { background: #f1f5f9; color: #334155; font-size: 8.5pt; text-transform: uppercase; padding: 2mm; border-bottom: 0.4mm solid #cbd5e1; }
    .items td { padding: 1.6mm 2mm; border-bottom: 0.2mm solid #e2e8f0; }
    .items tr.alt td { background: #f8fafc; }
    .num { text-align: right; }
    .summary td { padding: 1.6mm 2mm; }
    .summary .total td { font-weight: bold; font-size: 11pt; border-top: 0.4mm solid #0f172a; }
    .badge { padding: 1mm 3mm; border-radius: 2mm; font-size: 8pt; font-weight: bold; }
    .badge-paid { background: #dcfce7; color: #166534; }
    .badge-open { background: #fef3c7; color: #92400e; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
</style>
</head>
<body>

<table width="100%">
    <tr>
        <td width="62%" valign="top">
            <table><tr>
                @if($logo)
                    <td valign="top" style="padding-right:3mm"><img src="{{ $logo }}" style="height:18mm" /></td>
                @endif
                <td valign="top">
                    <div class="brand">{{ $tenant->name }}</div>
                    <div class="muted">{{ $tenant->fullAddress() }}</div>
                    <div class="muted">
                        @if($tenant->mobile) {{ __('receipt.mobile') }}: {{ $tenant->mobile }} @endif
                        @if($tenant->whatsapp_number) &nbsp;·&nbsp; WhatsApp: {{ $tenant->whatsapp_number }} @endif
                    </div>
                    @if($tenant->gst_number)<div class="muted">GSTIN: {{ $tenant->gst_number }}</div>@endif
                </td>
            </tr></table>
        </td>
        <td width="38%" valign="top" align="right">
            <div class="title">{{ mb_strtoupper(__('receipt.customer_bill')) }}</div>
            <table style="margin-top:2mm" align="right">
                <tr><td class="muted">{{ __('receipt.bill_no') }}</td><td class="num"><b>{{ $bill->bill_no }}</b></td></tr>
                <tr><td class="muted">{{ __('receipt.bill_date') }}</td><td class="num">{{ $bill->bill_date->format('d/m/Y') }}</td></tr>
                <tr><td class="muted">{{ __('receipt.period') }}</td><td class="num">{{ $bill->period_start->format('d/m/Y') }} – {{ $bill->period_end->format('d/m/Y') }}</td></tr>
                <tr><td class="muted">{{ __('receipt.status') }}</td><td class="num">
                    @php $cls = $bill->status === 'paid' ? 'badge-paid' : ($bill->status === 'cancelled' ? 'badge-cancelled' : 'badge-open'); @endphp
                    <span class="badge {{ $cls }}">{{ __('receipt.status_'.$bill->status) }}</span>
                </td></tr>
            </table>
        </td>
    </tr>
</table>

<div class="box" style="margin-top:5mm">
    <table width="100%"><tr>
        <td valign="top" width="60%">
            <div class="muted" style="font-size:8pt">{{ mb_strtoupper(__('receipt.bill_to')) }}</div>
            <div style="font-size:11pt;font-weight:bold">{{ $bill->customer->name }} <span class="muted" style="font-weight:normal">({{ $bill->customer->code }})</span></div>
            @if($bill->customer->address || $bill->customer->village)
                <div class="muted">{{ collect([$bill->customer->address, $bill->customer->village])->filter()->implode(', ') }}</div>
            @endif
        </td>
        <td valign="top" align="right">
            @if($bill->customer->mobile)<div>{{ __('receipt.mobile') }}: {{ $bill->customer->mobile }}</div>@endif
            <div class="muted">{{ __('receipt.entries') }}: {{ $bill->entry_count }}</div>
        </td>
    </tr></table>
</div>

<table width="100%" class="items" style="margin-top:5mm">
    <thead>
        <tr>
            <th align="left">{{ __('receipt.date') }}</th>
            <th align="left">{{ __('receipt.session') }}</th>
            <th class="num">{{ __('receipt.milk') }} ({{ __('receipt.litre_short') }})</th>
            @if($showFat)<th class="num">{{ __('receipt.fat') }}</th>@endif
            <th class="num">{{ __('receipt.rate') }}</th>
            <th class="num">{{ __('receipt.amount') }}</th>
        </tr>
    </thead>
    <tbody>
        @foreach($bill->items as $i => $item)
            <tr class="{{ $i % 2 ? 'alt' : '' }}">
                <td>{{ $item->entry_date->format('d/m') }}</td>
                <td>{{ __('common.'.$item->session) }}</td>
                <td class="num">{{ $fmt->num($item->quantity) }}</td>
                @if($showFat)<td class="num">{{ $item->fat !== null ? $fmt->num($item->fat) : '–' }}</td>@endif
                <td class="num">{{ $fmt->num($item->rate) }}</td>
                <td class="num">{{ $fmt->num($item->amount) }}</td>
            </tr>
        @endforeach
    </tbody>
</table>

<table width="100%" style="margin-top:5mm">
    <tr>
        <td width="52%" valign="top">
            @if($bill->payments->isNotEmpty())
                <div class="muted" style="font-size:8pt;margin-bottom:1mm">{{ mb_strtoupper(__('receipt.payments')) }}</div>
                <table width="100%" class="items">
                    @foreach($bill->payments as $p)
                        <tr><td>{{ $p->payment_date->format('d/m/Y') }}</td><td>{{ __('receipt.method_'.$p->method) }}</td><td class="num">{{ $fmt->money($p->amount) }}</td></tr>
                    @endforeach
                </table>
            @endif
            @if($bill->notes)
                <div class="muted" style="margin-top:3mm">{{ $bill->notes }}</div>
            @endif
        </td>
        <td width="4%"></td>
        <td width="44%" valign="top">
            <table width="100%" class="summary box">
                <tr><td>{{ __('receipt.total_milk') }}</td><td class="num">{{ $fmt->num($bill->total_qty) }} {{ __('receipt.litre_short') }}</td></tr>
                @if($showFat && $bill->avg_fat)<tr><td>{{ __('receipt.avg_fat') }}</td><td class="num">{{ $fmt->num($bill->avg_fat) }}</td></tr>@endif
                <tr><td>{{ __('receipt.total_amount') }}</td><td class="num">{{ $fmt->money($bill->total_amount) }}</td></tr>
                <tr><td>{{ __('receipt.previous_balance') }}</td><td class="num">{{ $fmt->money($bill->previous_balance) }}</td></tr>
                <tr><td>{{ __('receipt.discount') }}</td><td class="num">- {{ $fmt->money($bill->discount) }}</td></tr>
                <tr class="total"><td>{{ __('receipt.net_payable') }}</td><td class="num">{{ $fmt->money($bill->net_payable) }}</td></tr>
                <tr><td>{{ __('receipt.paid') }}</td><td class="num">{{ $fmt->money($bill->paid_amount) }}</td></tr>
                <tr><td><b>{{ __('receipt.outstanding') }}</b></td><td class="num"><b>{{ $fmt->money($bill->outstanding) }}</b></td></tr>
            </table>
        </td>
    </tr>
</table>

<table width="100%" style="margin-top:16mm">
    <tr>
        <td valign="bottom" class="muted">{{ $tenant->thank_you_message ?: __('receipt.thank_you') }}</td>
        <td align="right" valign="bottom">
            <div style="border-top:0.3mm solid #94a3b8;width:55mm;padding-top:1mm;text-align:center">{{ __('receipt.authorized_signature') }}</div>
        </td>
    </tr>
</table>

</body>
</html>
