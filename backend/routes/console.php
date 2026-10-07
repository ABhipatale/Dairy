<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

/*
| Housekeeping (needs one cron entry: * * * * * php artisan schedule:run).
*/
Schedule::command('sanctum:prune-expired --hours=24')->daily();   // expired login tokens
Schedule::command('queue:prune-failed --hours=720')->daily();     // failed jobs older than 30 days
Schedule::command('model:prune')->daily();

/*
| First-time production setup: create the platform super admin with your own password.
|   php artisan dairy:super-admin
*/
Artisan::command('dairy:super-admin {--mobile=} {--name=Platform Admin} {--password= : Non-interactive use only (visible in shell history)}', function () {
    $mobile = preg_replace('/\D+/', '', (string) ($this->option('mobile') ?: $this->ask('Mobile number')));
    $password = $this->option('password') ?: $this->secret('Password (min 8, letters + numbers)');

    if (strlen($mobile) < 10 || strlen((string) $password) < 8 || ! preg_match('/[A-Za-z]/', $password) || ! preg_match('/\d/', $password)) {
        $this->error('Mobile must have 10+ digits; password 8+ characters with letters and numbers.');

        return 1;
    }

    $user = User::query()->updateOrCreate(
        ['mobile' => $mobile],
        ['name' => $this->option('name'), 'password' => $password, 'role_id' => Role::idFor(Role::SUPER_ADMIN), 'is_active' => true],
    );
    $user->forceFill(['tenant_id' => null])->save();

    $this->info("Super admin ready: {$mobile}");
})->purpose('Create or reset the platform super admin');
