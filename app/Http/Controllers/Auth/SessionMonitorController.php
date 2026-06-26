<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\SessionMonitorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

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

    public function destroyOtherSessions(Request $request): JsonResponse
    {
        $deletedCount = $this->sessionMonitorService->logoutOtherSessions(
            $request->user(),
            $request->session()->getId()
        );

        return response()->json([
            'message' => $deletedCount > 0
                ? 'Session lain berhasil dikeluarkan.'
                : 'Tidak ada session lain yang perlu dikeluarkan.',
            'deleted_count' => $deletedCount,
            'sessionMonitor' => $this->sessionMonitorService->snapshotForUser(
                $request->user(),
                $request
            ),
        ]);
    }

    public function destroySession(Request $request, string $sessionId): JsonResponse
    {
        if (blank($sessionId)) {
            throw ValidationException::withMessages([
                'session_id' => 'Session tujuan tidak valid.',
            ]);
        }

        $deleted = $this->sessionMonitorService->logoutSpecificSession(
            $request->user(),
            $request->session()->getId(),
            $sessionId
        );

        return response()->json([
            'message' => $deleted
                ? 'Session berhasil dikeluarkan.'
                : 'Session tidak ditemukan atau sudah tidak aktif.',
            'deleted' => $deleted,
            'sessionMonitor' => $this->sessionMonitorService->snapshotForUser(
                $request->user(),
                $request
            ),
        ]);
    }
}
