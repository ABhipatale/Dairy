<?php

return [

    /*
    | Permission catalogue. Each dairy company has exactly ONE login (role "admin")
    | with full access; the super admin bypasses all checks (Gate::before).
    | Kept as permissions so finer roles can be added later without code changes.
    */
    'permissions' => [
        'customers.view' => ['group' => 'customers', 'label' => 'View customers'],
        'customers.manage' => ['group' => 'customers', 'label' => 'Add / edit customers'],
        'milk.view' => ['group' => 'milk', 'label' => 'View milk entries'],
        'milk.create' => ['group' => 'milk', 'label' => 'Add milk entries'],
        'milk.update' => ['group' => 'milk', 'label' => 'Edit milk entries'],
        'milk.delete' => ['group' => 'milk', 'label' => 'Delete milk entries'],
        'bills.view' => ['group' => 'billing', 'label' => 'View bills'],
        'bills.manage' => ['group' => 'billing', 'label' => 'Generate / cancel bills'],
        'payments.view' => ['group' => 'billing', 'label' => 'View payments'],
        'payments.manage' => ['group' => 'billing', 'label' => 'Record payments'],
        'reports.view' => ['group' => 'reports', 'label' => 'View reports'],
        'settings.manage' => ['group' => 'settings', 'label' => 'Manage settings & pricing'],
        'audit.view' => ['group' => 'settings', 'label' => 'View audit log'],
    ],

    'roles' => [
        'super_admin' => ['label' => 'Super Admin', 'permissions' => ['*']],
        'admin' => ['label' => 'Company Admin', 'permissions' => ['*']],
    ],


    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),
];
