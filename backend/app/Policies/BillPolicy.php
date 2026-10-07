<?php

namespace App\Policies;

class BillPolicy extends TenantOwnedPolicy
{
    protected function resource(): string
    {
        return 'bills';
    }
}
