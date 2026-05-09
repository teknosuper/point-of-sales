<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\KitchenStation;
use App\Services\AuditLogService;
use App\Support\BotGuard;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService
    ) {}

    /**
     * Display the login view.
     */
    public function create(Request $request): Response
    {
        $stationHint = null;
        $kioskMode = $request->boolean('kiosk');

        if ($request->routeIs('kitchen.login') && $request->filled('station')) {
            $station = KitchenStation::query()
                ->with('outlet:id,name,code')
                ->where('slug', (string) $request->query('station'))
                ->where('is_active', true)
                ->first();

            if ($station) {
                $stationHint = [
                    'slug' => $station->slug,
                    'name' => $station->name,
                    'outlet_name' => $station->outlet?->name,
                    'outlet_code' => $station->outlet?->code,
                ];
            }
        }

        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'canRegister' => config('security.auth.public_registration'),
            'status' => session('status'),
            'botGuard' => BotGuard::payload(),
            'workspaceMode' => $request->routeIs('kitchen.login') ? 'kitchen' : 'standard',
            'stationHint' => $stationHint,
            'kioskMode' => $kioskMode,
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();
        $request->session()->put('security.session_started_at', now()->timestamp);

        $user = $request->user();

        $this->auditLogService->log(
            event: 'auth.login_succeeded',
            module: 'auth',
            auditable: $user,
            description: 'Login berhasil.',
            meta: [
                'severity' => 'info',
                'route' => $request->route()?->getName(),
                'remember' => $request->boolean('remember'),
            ],
        );

        if ($user?->preferred_workspace === 'kitchen' && $user->can('dashboard-access')) {
            $defaultDestination = $this->resolveKitchenDestination($user);
        } else {
            $routePriority = [
            'transactions-access' => 'transactions.index',
            'receivables-access' => 'receivables.index',
            'payables-access' => 'payables.index',
            'customers-access' => 'customers.index',
            'suppliers-access' => 'suppliers.index',
            'reports-access' => 'reports.sales.index',
            'dashboard-access' => 'dashboard',
            ];

            $defaultRoute = 'dashboard.access';
            foreach ($routePriority as $permission => $routeName) {
                if ($user && $user->can($permission)) {
                    $defaultRoute = $routeName;
                    break;
                }
            }

            $defaultDestination = route($defaultRoute, absolute: false);
        }

        $intendedUrl = (string) $request->session()->get('url.intended', '');
        $loginUrl = route('login', absolute: false);

        if (
            filled($intendedUrl)
            && ! Str::contains($intendedUrl, $loginUrl)
            && ! Str::contains($intendedUrl, '/logout')
        ) {
            return redirect()->intended($defaultDestination);
        }

        $request->session()->forget('url.intended');

        return redirect()->to($defaultDestination);
    }

    private function resolveKitchenDestination($user): string
    {
        if (! $user?->preferred_kitchen_station_id) {
            return route('kitchen.index', absolute: false);
        }

        $station = KitchenStation::query()
            ->select('id', 'slug', 'outlet_id')
            ->find($user->preferred_kitchen_station_id);

        if (! $station || ! $user->hasAccessToOutlet((int) $station->outlet_id)) {
            return route('kitchen.index', absolute: false);
        }

        session([
            'active_outlet_id' => (int) $station->outlet_id,
        ]);

        return route('kitchen.show', ['stationSlug' => $station->slug], absolute: false);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $this->auditLogService->log(
            event: 'auth.logout',
            module: 'auth',
            auditable: $request->user(),
            description: 'Logout berhasil.',
            meta: [
                'severity' => 'info',
                'route' => $request->route()?->getName(),
            ],
        );

        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        $request->session()->forget('url.intended');
        $request->session()->forget('security.session_started_at');

        return redirect()->route('login');
    }
}
