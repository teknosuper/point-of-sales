<?php

use App\Http\Middleware\EnforceAbsoluteSessionLifetime;
use App\Http\Middleware\EnsureActiveCashierShift;
use App\Http\Middleware\EnsureAccessibleOutletContext;
use App\Http\Middleware\EnsureBotGuard;
use App\Http\Middleware\EnsurePublicRegistrationEnabled;
use App\Http\Middleware\EnsureRecentPasswordConfirmation;
use App\Http\Middleware\SecureHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Spatie\Permission\Exceptions\UnauthorizedException;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            SecureHeaders::class,
            EnforceAbsoluteSessionLifetime::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
            'active_shift' => EnsureActiveCashierShift::class,
            'outlet_access' => EnsureAccessibleOutletContext::class,
            'registration.enabled' => EnsurePublicRegistrationEnabled::class,
            'bot.guard' => EnsureBotGuard::class,
            'step_up' => EnsureRecentPasswordConfirmation::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (\Throwable $exception, Request $request) {
            if ($exception instanceof ValidationException) {
                return null;
            }

            if ($exception instanceof AuthenticationException) {
                if ($request->expectsJson()) {
                    return response()->json([
                        'message' => __('Unauthenticated.'),
                    ], Response::HTTP_UNAUTHORIZED);
                }

                return redirect()->guest(route('login'));
            }

            $status = match (true) {
                $exception instanceof UnauthorizedException => Response::HTTP_FORBIDDEN,
                $exception instanceof HttpExceptionInterface => $exception->getStatusCode(),
                default => Response::HTTP_INTERNAL_SERVER_ERROR,
            };

            if ($request->expectsJson()) {
                $message = $exception instanceof UnauthorizedException
                    ? __('Anda tidak memiliki izin untuk mengakses halaman tersebut.')
                    : ($exception->getMessage() ?: Response::$statusTexts[$status] ?? 'Server Error');

                return response()->json([
                    'message' => $message,
                ], $status);
            }

            if ($status === Response::HTTP_FORBIDDEN && $request->user()) {
                $dashboardAccessUrl = route('dashboard.access');

                if ($request->fullUrl() !== $dashboardAccessUrl) {
                    return redirect()
                        ->to($dashboardAccessUrl)
                        ->with('error', __('Anda tidak memiliki izin untuk membuka halaman tersebut.'));
                }
            }

            if ($status === 419) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()
                    ->route('login')
                    ->with('error', __('Sesi Anda telah berakhir. Silakan masuk kembali.'));
            }

            if (! in_array($status, [
                Response::HTTP_UNAUTHORIZED,
                Response::HTTP_FORBIDDEN,
                Response::HTTP_NOT_FOUND,
                419,
                Response::HTTP_TOO_MANY_REQUESTS,
                Response::HTTP_INTERNAL_SERVER_ERROR,
                Response::HTTP_SERVICE_UNAVAILABLE,
            ], true)) {
                return null;
            }

            return Inertia::render('Error', [
                'status' => $status,
                'homeUrl' => $request->user() ? route('dashboard') : url('/'),
                'homeLabel' => $request->user() ? __('Kembali ke Dashboard') : __('Kembali ke Beranda'),
                'errorDetail' => config('app.debug') ? [
                    'message' => $exception->getMessage() ?: (Response::$statusTexts[$status] ?? 'Server Error'),
                    'type' => $exception::class,
                    'file' => $exception->getFile(),
                    'line' => $exception->getLine(),
                ] : null,
            ])->toResponse($request)->setStatusCode($status);
        });
    })->create();
