<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Services\CrmAutomationService;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CrmReminderController extends Controller
{
    public function __construct(
        private readonly CrmAutomationService $crmAutomationService,
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $outletId = $this->outletResolver->resolve($request, $request->user())?->id;
        $filters = [
            'type' => $request->input('type'),
            'status' => $request->input('status'),
        ];

        $campaigns = $this->crmAutomationService->reminderCampaignsQuery($outletId)
            ->when($filters['type'], fn ($query, $type) => $query->where('type', $type))
            ->when($filters['status'], fn ($query, $status) => $query->where('status', $status))
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('Dashboard/CrmReminders/Index', [
            'campaigns' => $campaigns,
            'filters' => $filters,
        ]);
    }
}
