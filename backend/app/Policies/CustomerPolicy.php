<?php

namespace App\Policies;

class CustomerPolicy extends TenantOwnedPolicy
{
    protected function resource(): string
    {
        return 'customers';
    }
}
