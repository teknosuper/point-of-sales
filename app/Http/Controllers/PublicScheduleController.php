<?php

namespace App\Http\Controllers;

use App\Models\PublicScheduleShare;
use App\Services\EmployeeScheduleService;
use App\Services\OutletResolver;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PublicScheduleController extends Controller
{
    public function show(Request $request, string $token): Response
    {
        $share = PublicScheduleShare::query()
            ->where('token', $token)
            ->where('is_active', true)
            ->first();

        if (! $share) {
            abort(404);
        }

        $view = in_array($request->input('view', 'week'), ['week', 'month'], true)
            ? $request->input('view')
            : 'week';

        if ($view === 'month') {
            $start = $this->resolveMonthStart($request);
            $end = $start->addMonthNoOverflow()->subDay();
        } else {
            $start = $this->resolveWeekStart($request);
            $end = $start->addDays(6);
        }

        $payload = app(EmployeeScheduleService::class)->boardPayload($start, $end);

        $prev = $view === 'month'
            ? $start->copy()->subMonthNoOverflow()->toDateString()
            : $start->copy()->subDays(7)->toDateString();

        $next = $view === 'month'
            ? $start->copy()->addMonthNoOverflow()->toDateString()
            : $start->copy()->addDays(7)->toDateString();

        $profile = app(OutletResolver::class)->profilePayload($request);

        return Inertia::render('Public/Schedule', [
            'groups' => $payload['groups'],
            'shifts' => $payload['shifts'],
            'view' => $view,
            'period' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
                'prev' => $prev,
                'next' => $next,
                'label' => $view === 'month'
                    ? $start->format('F Y')
                    : $start->format('d M Y').' - '.$end->format('d M Y'),
            ],
            'storeName' => $profile['name'] ?? 'GTC KASIR',
            'token' => $share->token,
        ]);
    }

    private function resolveWeekStart(Request $request): CarbonImmutable
    {
        $period = $request->input('period');

        if ($period) {
            try {
                return CarbonImmutable::parse($period)->startOfWeek(CarbonImmutable::MONDAY);
            } catch (\Throwable $e) {
                // fallback ke minggu berjalan
            }
        }

        return CarbonImmutable::now()->startOfWeek(CarbonImmutable::MONDAY);
    }

    private function resolveMonthStart(Request $request): CarbonImmutable
    {
        $period = $request->input('period');

        if ($period) {
            try {
                return CarbonImmutable::parse($period)->startOfMonth();
            } catch (\Throwable $e) {
                // fallback ke bulan berjalan
            }
        }

        return CarbonImmutable::now()->startOfMonth();
    }
}
