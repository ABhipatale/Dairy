<?php

namespace App\Policies;

class PaymentPolicy extends TenantOwnedPolicy
{
    protected function resource(): string
    {
        return 'payments';
    }
}
