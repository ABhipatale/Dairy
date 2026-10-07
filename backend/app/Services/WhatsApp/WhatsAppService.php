<?php

namespace App\Services\WhatsApp;

use App\Exceptions\BusinessException;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\MilkEntry;
use App\Models\WhatsAppLog;
use App\Services\MessageFormatter;
use App\Services\SettingsService;
use Illuminate\Support\Facades\URL;

/**
 * WhatsApp without any API or account setup: we build the message and a
 * https://wa.me/<phone>?text=… link; the app opens WhatsApp with the message
 * ready and the operator taps Send.
 */
class WhatsAppService
{
    public function __construct(
        private readonly SettingsService $settings,
        private readonly MessageFormatter $formatter,
    ) {}

    public function sendEntry(MilkEntry $entry): array
    {
        $entry->loadMissing('customer');

        return $this->link($entry->customer, 'entry_receipt', $entry, $this->formatter->entryMessage($entry));
    }

    /** Bill message includes a link to the bill PDF so the customer can open/download it. */
    public function sendBill(Bill $bill): array
    {
        $bill->loadMissing('customer');

        return $this->link($bill->customer, 'bill', $bill, $this->formatter->billMessage($bill, $this->billPdfUrl($bill)));
    }

    /** Public, expiring, signed link to the bill PDF. */
    public function billPdfUrl(Bill $bill): string
    {
        return URL::temporarySignedRoute('public.bills.pdf', now()->addDays(15), ['bill' => $bill->id, 'tenant' => $bill->tenant_id]);
    }

    public function normalizePhone(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);

        if ($digits === '' || strlen($digits) < 8) {
            return null;
        }

        $digits = ltrim($digits, '0');
        $country = preg_replace('/\D+/', '', (string) $this->settings->value('whatsapp', 'country_code', '91'));

        return strlen($digits) <= 10 ? $country.$digits : $digits;
    }

    private function link(Customer $customer, string $type, $reference, string $message): array
    {
        if (! $this->settings->value('whatsapp', 'enabled', true)) {
            throw new BusinessException('whatsapp_disabled');
        }

        $phone = $this->normalizePhone($customer->whatsappPhone());

        if (! $phone) {
            throw new BusinessException('customer_no_phone');
        }

        WhatsAppLog::query()->create([
            'customer_id' => $customer->id,
            'type' => $type,
            'reference_type' => $reference->getMorphClass(),
            'reference_id' => $reference->getKey(),
            'phone' => $phone,
            'message' => $message,
            'driver' => 'link',
            'status' => 'opened',
            'sent_by' => auth()->id(),
        ]);

        return [
            'mode' => 'link',
            'phone' => $phone,
            'message' => $message,
            'url' => 'https://wa.me/'.$phone.'?text='.rawurlencode($message),
        ];
    }
}
