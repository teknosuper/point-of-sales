<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuditLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ConfirmablePasswordController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    public function show(): Response
    {
        return Inertia::render('Auth/ConfirmPassword', [
            'challenge' => session('security.step_up_context'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (! Auth::guard('web')->validate([
            'email' => $request->user()->email,
            'password' => $request->password,
        ])) {
            throw ValidationException::withMessages([
                'password' => __('auth.password'),
            ]);
        }

        $request->session()->put('auth.password_confirmed_at', time());
        $intendedUrl = (string) $request->session()->pull('url.intended', route('dashboard.access'));
        $request->session()->forget('security.step_up_context');

        return redirect()->to($intendedUrl);
    }
}
