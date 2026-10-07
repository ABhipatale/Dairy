<?php

namespace App\Services;

use App\Exceptions\BusinessException;
use App\Models\Bill;
use App\Models\Customer;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function __construct(private readonly BillingService $billing) {}

    /**
     * Record a payment. Without an explicit bill it is applied to the customer's
     * latest open bill; with no open bill it stays on the account as an advance.
     */
    public function record(array $data): Payment
    {
        return DB::transaction(function () use ($data) {
            $customer = Customer::query()->findOrFail($data['customer_id']);
            $bill = null;

            if (! empty($data['bill_id'])) {
                $bill = Bill::query()->whereKey($data['bill_id'])->lockForUpdate()->firstOrFail();

                if ($bill->customer_id !== $customer->id) {
                    throw new BusinessException('bill_customer_mismatch');
                }

                if ($bill->isCancelled()) {
                    throw new BusinessException('bill_already_cancelled', 409);
                }

                // Paying an old bill that was rolled into a newer one goes to the newer one.
                if ($bill->carried_forward_to_id) {
                    $bill = Bill::query()->whereKey($bill->carried_forward_to_id)->lockForUpdate()->first() ?? $bill;
                }
            } else {
                $bill = $this->billing->latestOpenBill($customer);
            }

            $payment = new Payment([
                'customer_id' => $customer->id,
                'bill_id' => $bill?->id,
                'payment_date' => $data['payment_date'],
                'amount' => $data['amount'],
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);
            $payment->created_by = auth()->id();
            $payment->save();

            if ($bill) {
                $this->billing->refreshPayments($bill);
            }

            return $payment->load(['customer', 'bill']);
        });
    }

    public function delete(Payment $payment): void
    {
        DB::transaction(function () use ($payment) {
            $bill = $payment->bill;
            $payment->delete();

            if ($bill) {
                $this->billing->refreshPayments($bill);
            }
        });
    }
}
