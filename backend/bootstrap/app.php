<?php

use App\Exceptions\BusinessException;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\ResolveTenant;
use App\Http\Middleware\SetLocale;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant' => ResolveTenant::class,
            'super_admin' => EnsureSuperAdmin::class,
            'active_user' => EnsureUserIsActive::class,
        ]);
        $middleware->api(prepend: [SetLocale::class]);
        // Tenant must be resolved BEFORE implicit route-model binding, so that
        // /customers/{id} is looked up through the tenant scope (404 for others).
        $middleware->prependToPriorityList(
            before: \Illuminate\Routing\Middleware\SubstituteBindings::class,
            prepend: ResolveTenant::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Every API error has the same shape: { message, code, errors? }.
        // Messages are translated and never expose SQL or stack details.
        $json = fn (string $code, int $status, array $extra = [], ?string $message = null) => response()->json(array_merge([
            'message' => $message ?? __("errors.{$code}"),
            'code' => $code,
        ], $extra), $status);

        $exceptions->render(function (Throwable $e, Request $request) use ($json) {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            return match (true) {
                $e instanceof BusinessException => $json($e->errorCode, $e->getStatusCode(), $e->context ? ['context' => $e->context] : [], $e->userMessage()),
                $e instanceof ValidationException => $json('validation_failed', 422, ['errors' => $e->errors()]),
                $e instanceof AuthenticationException => $json('session_expired', 401),
                $e instanceof AuthorizationException, $e instanceof AccessDeniedHttpException => $json('unauthorized', 403),
                $e instanceof ModelNotFoundException, $e instanceof NotFoundHttpException => $json('not_found', 404),
                $e instanceof ThrottleRequestsException => $json('too_many_requests', 429),
                $e instanceof QueryException => $json(($e->errorInfo[1] ?? null) === 1062 ? 'duplicate_record' : 'database_error', ($e->errorInfo[1] ?? null) === 1062 ? 409 : 500),
                $e instanceof HttpExceptionInterface => $json('request_failed', $e->getStatusCode()),
                default => config('app.debug') ? null : $json('server_error', 500),
            };
        });
    })->create();
