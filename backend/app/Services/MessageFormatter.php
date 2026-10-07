<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\MilkEntry;
use App\Models\Tenant;
use App\Support\TenantContext;
use Illuminate\Support\Facades\App;

/**
 * Builds customer-facing texts (WhatsApp messages) in the tenant's receipt language.
 */
class MessageFormatter
{
    public function __construct(
        private readonly TenantContext $tenants,
        private readonly SettingsService $settings,
    ) {}

    public function locale(?Tenant $tenant = null): string
    {
        $tenant ??= $this->tenants->tenant();

        return $this->settings->value('general', 'receipt_language', null, $tenant?->id)
            ?: ($tenant?->default_language ?: 'en');
    }

    public function entryMessage(MilkEntry $entry): string
    {
        $tenant = $this->tenants->tenant();
        $customer = $entry->customer;

        return $this->inLocale(function () use ($entry, $tenant, $customer) {
            $lines = [
                '🥛 *'.mb_strtoupper($tenant->name).'*',
                '',
                '*'.__('receipt.milk_entry').'*',
                '',
                __('receipt.customer').': '.$customer->name.' ('.$customer->code.')',
                __('receipt.date').': '.$entry->entry_date->format('d/m/Y'),
                __('receipt.session').': '.__('common.'.$entry->session),
                '',
                __('receipt.milk').': '.$this->num($entry->quantity).' '.__('receipt.litre_short'),
            ];

            if ($entry->fat !== null) {
                $lines[] = __('receipt.fat').': '.$this->num($entry->fat);
            }

            array_push($lines,
                __('receipt.rate').': '.$this->money($entry->rate).'/'.__('receipt.litre_short'),
                '',
                '*'.__('receipt.amount').': '.$this->money($entry->amount).'*',
                '',
                $tenant->thank_you_message ?: __('receipt.thank_you'),
            );

            return implode("\n", $lines);
        });
    }

    public function billMessage(Bill $bill, ?string $pdfUrl = null): string
    {
        $tenant = $this->tenants->tenant();
        $customer = $bill->customer;

        return $this->inLocale(function () use ($bill, $tenant, $customer, $pdfUrl) {
            $lines = [
                '🥛 *'.mb_strtoupper($tenant->name).'*',
                '',
                '*'.__('receipt.bill_title').'* #'.$bill->bill_no,
                '',
                __('receipt.customer').': '.$customer->name.' ('.$customer->code.')',
                __('receipt.period').': '.$bill->period_start->format('d/m/Y').' – '.$bill->period_end->format('d/m/Y'),
                '',
                __('receipt.total_milk').': '.$this->num($bill->total_qty).' '.__('receipt.litre_short'),
                __('receipt.total_amount').': '.$this->money($bill->total_amount),
            ];

            if ((float) $bill->previous_balance != 0) {
                $lines[] = __('receipt.previous_balance').': '.$this->money($bill->previous_balance);
            }

            if ((float) $bill->discount > 0) {
                $lines[] = __('receipt.discount').': '.$this->money($bill->discount);
            }

            array_push($lines,
                __('receipt.net_payable').': '.$this->money($bill->net_payable),
                __('receipt.paid').': '.$this->money($bill->paid_amount),
                '*'.__('receipt.outstanding').': '.$this->money($bill->outstanding).'*',
            );

            if ($pdfUrl) {
                array_push($lines, '', __('receipt.download_bill').': '.$pdfUrl);
            }

            array_push($lines, '', $tenant->thank_you_message ?: __('receipt.thank_you'));

            return implode("\n", $lines);
        });
    }

    public function inLocale(callable $callback, ?string $locale = null): mixed
    {
        $previous = App::getLocale();
        App::setLocale($locale ?? $this->locale());

        try {
            return $callback();
        } finally {
            App::setLocale($previous);
        }
    }

    public function money(string|float|null $value): string
    {
        $symbol = match ($this->tenants->tenant()?->currency ?? 'INR') {
            'INR' => '₹',
            'USD' => '$',
            'EUR' => '€',
            'GBP' => '£',
            default => ($this->tenants->tenant()?->currency ?? '').' ',
        };

        $n = (float) $value;

        return ($n < 0 ? '-' : '').$symbol.number_format(abs($n), 2);
    }

    public function num(string|float|null $value, int $decimals = 2): string
    {
        return number_format((float) $value, $decimals);
    }
}
