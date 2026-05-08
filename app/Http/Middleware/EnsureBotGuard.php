<?php

namespace App\Http\Middleware;

use App\Support\BotGuard;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureBotGuard
{
    public function handle(Request $request, Closure $next, ?string $mode = null): Response
    {
        BotGuard::validate(
            $request,
            skipMinimumDelay: $mode === 'login'
        );

        return $next($request);
    }
}
