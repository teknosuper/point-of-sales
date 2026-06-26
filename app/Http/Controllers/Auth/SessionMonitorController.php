<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\SessionMonitorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SessionMonitorController extends Controller
{
    public function __construct(
        private readonly SessionMonitorService $sessionMonitorService
    ) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'sessionMonitor' => $this->sessionMonitorService->snapshotForUser(
                $request->user(),
                $request
            ),
        ]);
    }
}
