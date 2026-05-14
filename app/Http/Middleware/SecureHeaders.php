<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecureHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $isEmbeddedTransactionPrint =
            $request->routeIs('transactions.print') &&
            $request->boolean('embedded');

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set(
            'X-Frame-Options',
            $isEmbeddedTransactionPrint ? 'SAMEORIGIN' : 'DENY'
        );
        $response->headers->set(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=()'
        );

        return $response;
    }
}
