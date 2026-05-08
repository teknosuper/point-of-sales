<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KitchenStationDevice;
use App\Models\PrintJob;
use App\Services\PrintJobService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrintBridgeController extends Controller
{
    public function __construct(
        private readonly PrintJobService $printJobService
    ) {}

    public function health(Request $request): JsonResponse
    {
        $this->authorizeBridgeToken($request);

        return response()->json([
            'status' => 'ok',
            'service' => 'print-bridge',
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    public function pull(Request $request): JsonResponse
    {
        $this->authorizeBridgeToken($request);

        $validated = $request->validate([
            'device_id' => ['required', 'integer', 'exists:kitchen_station_devices,id'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:20'],
            'agent_name' => ['nullable', 'string', 'max:100'],
        ]);

        $device = KitchenStationDevice::query()
            ->with(['station:id,outlet_id,name,slug,code', 'outlet:id,name,code'])
            ->where('id', $validated['device_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $jobs = $this->printJobService->claimQueuedJobsForDevice($device, (int) ($validated['limit'] ?? 10));

        return response()->json([
            'success' => true,
            'device' => [
                'id' => $device->id,
                'name' => $device->name,
                'device_type' => $device->device_type,
                'connection_driver' => $device->connection_driver,
                'endpoint' => $device->endpoint,
                'paper_width' => data_get($device->meta, 'paper_width'),
                'template_style' => data_get($device->meta, 'template_style'),
                'print_copies' => (int) (data_get($device->meta, 'print_copies', 1)),
                'station' => [
                    'id' => $device->station?->id,
                    'name' => $device->station?->name,
                    'slug' => $device->station?->slug,
                    'code' => $device->station?->code,
                ],
                'outlet' => [
                    'id' => $device->outlet?->id,
                    'name' => $device->outlet?->name,
                    'code' => $device->outlet?->code,
                ],
            ],
            'jobs' => $jobs->map(fn (PrintJob $job) => $this->jobPayload($job))->values(),
            'meta' => [
                'count' => $jobs->count(),
                'agent_name' => $validated['agent_name'] ?? null,
                'pulled_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function markSuccess(Request $request, PrintJob $printJob): JsonResponse
    {
        $this->authorizeBridgeToken($request);

        $validated = $request->validate([
            'device_id' => ['required', 'integer', 'exists:kitchen_station_devices,id'],
            'agent_name' => ['nullable', 'string', 'max:100'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $this->ensureDeviceMatchesJob($printJob, (int) $validated['device_id']);

        $printJob = $this->printJobService->markSuccess($printJob);
        $this->recordKitchenPrintEvent($printJob, 'ticket.print_job_succeeded', [
            'device_id' => $validated['device_id'],
            'agent_name' => $validated['agent_name'] ?? null,
            'note' => $validated['note'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Print job ditandai berhasil.',
            'job' => $this->jobPayload($printJob->fresh(['transaction:id,invoice,customer_name,customer_phone,customer_address', 'kitchenTicket.items:id,kitchen_ticket_id,product_name,qty,notes', 'kitchenTicket.station:id,name,slug,code', 'device:id,kitchen_station_id,name,device_type,connection_driver,endpoint,meta'])),
        ]);
    }

    public function markFailed(Request $request, PrintJob $printJob): JsonResponse
    {
        $this->authorizeBridgeToken($request);

        $validated = $request->validate([
            'device_id' => ['required', 'integer', 'exists:kitchen_station_devices,id'],
            'agent_name' => ['nullable', 'string', 'max:100'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $this->ensureDeviceMatchesJob($printJob, (int) $validated['device_id']);

        $printJob = $this->printJobService->markFailed($printJob, $validated['reason']);
        $this->recordKitchenPrintEvent($printJob, 'ticket.print_job_failed', [
            'device_id' => $validated['device_id'],
            'agent_name' => $validated['agent_name'] ?? null,
            'reason' => $validated['reason'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Print job ditandai gagal.',
            'job' => $this->jobPayload($printJob->fresh(['transaction:id,invoice,customer_name,customer_phone,customer_address', 'kitchenTicket.items:id,kitchen_ticket_id,product_name,qty,notes', 'kitchenTicket.station:id,name,slug,code', 'device:id,kitchen_station_id,name,device_type,connection_driver,endpoint,meta'])),
        ]);
    }

    private function authorizeBridgeToken(Request $request): void
    {
        $token = (string) config('services.print_bridge.token');
        $provided = (string) $request->header('X-Print-Bridge-Token', '');

        abort_if(blank($token), 503, 'Print bridge token belum dikonfigurasi.');
        abort_if(blank($provided) || ! hash_equals($token, $provided), 403, 'Token print bridge tidak valid.');
    }

    private function ensureDeviceMatchesJob(PrintJob $printJob, int $deviceId): void
    {
        abort_if((int) $printJob->kitchen_station_device_id !== $deviceId, 422, 'Print job tidak cocok dengan device ini.');
    }

    private function recordKitchenPrintEvent(PrintJob $printJob, string $event, array $payload = []): void
    {
        if (! $printJob->kitchenTicket) {
            return;
        }

        $device = $printJob->device;

        $printJob->kitchenTicket->events()->create([
            'user_id' => null,
            'event' => $event,
            'payload' => [
                'print_job_id' => $printJob->id,
                'print_job_status' => $printJob->status,
                'device_id' => $device?->id,
                'device_name' => $device?->name,
                'device_type' => $device?->device_type,
                'connection_driver' => $device?->connection_driver,
                'endpoint' => $device?->endpoint,
                ...$payload,
            ],
            'created_at' => now(),
        ]);
    }

    private function jobPayload(PrintJob $job): array
    {
        return [
            'id' => $job->id,
            'job_type' => $job->job_type,
            'status' => $job->status,
            'copies' => $job->copies,
            'queued_at' => optional($job->queued_at)?->toIso8601String(),
            'processing_at' => optional($job->processing_at)?->toIso8601String(),
            'processed_at' => optional($job->processed_at)?->toIso8601String(),
            'failed_at' => optional($job->failed_at)?->toIso8601String(),
            'failure_reason' => $job->failure_reason,
            'payload' => $job->payload ?? [],
            'transaction' => $job->transaction ? [
                'id' => $job->transaction->id,
                'invoice' => $job->transaction->invoice,
                'customer_name' => $job->transaction->customer_name,
                'customer_phone' => $job->transaction->customer_phone,
                'customer_address' => $job->transaction->customer_address,
            ] : null,
            'kitchen_ticket' => $job->kitchenTicket ? [
                'id' => $job->kitchenTicket->id,
                'ticket_number' => $job->kitchenTicket->ticket_number,
                'status' => $job->kitchenTicket->status,
                'notes' => $job->kitchenTicket->notes,
                'station' => [
                    'id' => $job->kitchenTicket->station?->id,
                    'name' => $job->kitchenTicket->station?->name,
                    'slug' => $job->kitchenTicket->station?->slug,
                    'code' => $job->kitchenTicket->station?->code,
                ],
                'items' => $job->kitchenTicket->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_name' => $item->product_name,
                    'qty' => (float) $item->qty,
                    'notes' => $item->notes,
                ])->values(),
            ] : null,
            'device' => $job->device ? [
                'id' => $job->device->id,
                'name' => $job->device->name,
                'device_type' => $job->device->device_type,
                'connection_driver' => $job->device->connection_driver,
                'endpoint' => $job->device->endpoint,
                'paper_width' => data_get($job->device->meta, 'paper_width'),
                'template_style' => data_get($job->device->meta, 'template_style'),
            ] : null,
        ];
    }
}
