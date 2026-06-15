<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\DiningTable;
use App\Models\Outlet;
use App\Services\AuditLogService;
use App\Services\OutletResolver;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class DiningTableController extends Controller
{
    public function __construct(
        private readonly AuditLogService $auditLogService,
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->resolveOutlet($request);
        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'status' => trim((string) $request->input('status', '')),
            'per_page' => (int) $request->input('per_page', 10),
        ];

        $allowedPerPage = [10, 25, 50, 100];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 10;
        }

        $query = DiningTable::query()
            ->withCount('transactions')
            ->when($outlet, fn ($builder) => $builder->forOutlet($outlet->id))
            ->when($filters['search'] !== '', function ($builder) use ($filters) {
                $search = $filters['search'];

                $builder->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('name', 'like', '%'.$search.'%')
                        ->orWhere('code', 'like', '%'.$search.'%')
                        ->orWhere('notes', 'like', '%'.$search.'%');
                });
            })
            ->when($filters['status'] !== '', fn ($builder) => $builder->where('status', $filters['status']))
            ->orderBy('sort_order')
            ->orderBy('name');

        $diningTables = $query
            ->paginate($filters['per_page'])
            ->withQueryString()
            ->through(fn (DiningTable $table) => $this->tablePayload($table));

        $summaryQuery = DiningTable::query()
            ->when($outlet, fn ($builder) => $builder->forOutlet($outlet->id));

        return Inertia::render('Dashboard/DiningTables/Index', [
            'diningTables' => $diningTables,
            'filters' => $filters,
            'summary' => [
                'total' => (clone $summaryQuery)->count(),
                'active' => (clone $summaryQuery)->where('status', 'active')->count(),
                'inactive' => (clone $summaryQuery)->where('status', 'inactive')->count(),
                'used' => (clone $summaryQuery)->has('transactions')->count(),
            ],
            'meta' => [
                'per_page_options' => $allowedPerPage,
                'statuses' => [
                    ['value' => 'active', 'label' => 'Aktif'],
                    ['value' => 'inactive', 'label' => 'Nonaktif'],
                ],
            ],
        ]);
    }

    public function store(Request $request)
    {
        $outlet = $this->resolveRequiredOutlet($request);
        $validated = $this->validateRequest($request, $outlet);
        $validated['outlet_id'] = $outlet->id;
        $validated['qr_token'] = (string) Str::uuid();
        $validated['sort_order'] = $validated['sort_order'] ?? (
            (int) DiningTable::query()->forOutlet($outlet->id)->max('sort_order') + 1
        );

        $diningTable = DiningTable::create($validated);

        $this->auditLogService->log(
            event: 'dining_table.created',
            module: 'dining_tables',
            auditable: $diningTable,
            description: 'Meja makan ditambahkan.',
            after: $this->tablePayload($diningTable)
        );

        return redirect()
            ->route('dining-tables.index')
            ->with('success', 'Meja berhasil ditambahkan.');
    }

    public function update(Request $request, DiningTable $diningTable)
    {
        $outlet = $this->resolveRequiredOutlet($request);
        abort_unless((int) $diningTable->outlet_id === (int) $outlet->id, 404);

        $before = $this->tablePayload($diningTable);
        $validated = $this->validateRequest($request, $outlet, $diningTable);
        $diningTable->update($validated);

        $this->auditLogService->log(
            event: 'dining_table.updated',
            module: 'dining_tables',
            auditable: $diningTable,
            description: 'Meja makan diperbarui.',
            before: $before,
            after: $this->tablePayload($diningTable->fresh())
        );

        return redirect()
            ->route('dining-tables.index')
            ->with('success', 'Meja berhasil diperbarui.');
    }

    public function destroy(Request $request, DiningTable $diningTable)
    {
        $outlet = $this->resolveRequiredOutlet($request);
        abort_unless((int) $diningTable->outlet_id === (int) $outlet->id, 404);

        if ($diningTable->transactions()->exists()) {
            return redirect()
                ->route('dining-tables.index')
                ->with('error', 'Meja tidak bisa dihapus karena sudah dipakai transaksi.');
        }

        $before = $this->tablePayload($diningTable);
        $diningTable->delete();

        $this->auditLogService->log(
            event: 'dining_table.deleted',
            module: 'dining_tables',
            auditable: ['target_label' => $before['name']],
            description: 'Meja makan dihapus.',
            before: $before
        );

        return redirect()
            ->route('dining-tables.index')
            ->with('success', 'Meja berhasil dihapus.');
    }

    public function print(Request $request, DiningTable $diningTable)
    {
        $outlet = $this->resolveRequiredOutlet($request);
        abort_unless((int) $diningTable->outlet_id === (int) $outlet->id, 404);

        return Inertia::render('Dashboard/DiningTables/Print', [
            'table' => $this->tablePayload($diningTable),
            'outlet' => [
                'id' => (int) $outlet->id,
                'name' => $outlet->name,
            ],
            'printMeta' => [
                'paper_width_mm' => 100,
                'printed_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function printV2(Request $request, DiningTable $diningTable)
    {
        $outlet = $this->resolveRequiredOutlet($request);
        abort_unless((int) $diningTable->outlet_id === (int) $outlet->id, 404);

        return Inertia::render('Dashboard/DiningTables/PrintV2', [
            'table' => $this->tablePayload($diningTable),
            'outlet' => [
                'id' => (int) $outlet->id,
                'name' => $outlet->name,
            ],
            'printMeta' => [
                'paper_width_mm' => 152,
                'printed_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function printImage(Request $request, DiningTable $diningTable): Response
    {
        $outlet = $this->resolveRequiredOutlet($request);
        abort_unless((int) $diningTable->outlet_id === (int) $outlet->id, 404);

        $payload = $this->printV2Payload($diningTable, $outlet);
        $svg = $this->renderPrintV2Svg($payload);

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="dining-table-'.$diningTable->id.'-qr-v2.svg"',
        ]);
    }

    public function printPdf(Request $request, DiningTable $diningTable)
    {
        $outlet = $this->resolveRequiredOutlet($request);
        abort_unless((int) $diningTable->outlet_id === (int) $outlet->id, 404);

        $payload = $this->printV2Payload($diningTable, $outlet);
        $payload['svgDataUrl'] = 'data:image/svg+xml;base64,'.base64_encode(
            $this->renderPrintV2Svg($payload)
        );
        $pdf = Pdf::loadView('pdf.dining_table_qr_v2', $payload)
            ->setPaper([0, 0, 432, 288], 'landscape');

        return $pdf->stream('dining-table-'.$diningTable->id.'-qr-v2.pdf');
    }

    private function validateRequest(Request $request, Outlet $outlet, ?DiningTable $diningTable = null): array
    {
        return $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('dining_tables', 'name')
                    ->where(fn ($query) => $query->where('outlet_id', $outlet->id))
                    ->ignore($diningTable?->id),
            ],
            'code' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('dining_tables', 'code')
                    ->where(fn ($query) => $query->where('outlet_id', $outlet->id))
                    ->ignore($diningTable?->id),
            ],
            'capacity' => ['required', 'integer', 'min:1', 'max:100'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    private function resolveOutlet(Request $request): ?Outlet
    {
        return $this->outletResolver->resolve($request, $request->user());
    }

    private function resolveRequiredOutlet(Request $request): Outlet
    {
        $outlet = $this->resolveOutlet($request);
        abort_unless($outlet, 422, 'Outlet aktif tidak ditemukan.');

        return $outlet;
    }

    private function tablePayload(DiningTable $table): array
    {
        $table = $this->ensureQrToken($table);

        return [
            'id' => $table->id,
            'outlet_id' => (int) $table->outlet_id,
            'name' => $table->name,
            'code' => $table->code,
            'qr_token' => $table->qr_token,
            'self_order_enabled' => (bool) $table->self_order_enabled,
            'order_url' => route('table-order.show', $table->qr_token),
            'capacity' => (int) $table->capacity,
            'status' => $table->status,
            'sort_order' => (int) $table->sort_order,
            'notes' => $table->notes,
            'transactions_count' => (int) ($table->transactions_count ?? 0),
        ];
    }

    private function printV2Payload(DiningTable $diningTable, Outlet $outlet): array
    {
        $table = $this->tablePayload($diningTable);

        return [
            'table' => $table,
            'outlet' => [
                'id' => (int) $outlet->id,
                'name' => $outlet->name,
            ],
            'qrImageDataUrl' => $this->qrImageDataUrl($table['order_url'] ?? ''),
            'steps' => [
                ['num' => 1, 'title' => 'Scan Meja', 'desc' => 'Scan QR code dengan HP untuk buka halaman menu'],
                ['num' => 2, 'title' => 'Masukkan Data Pemesan', 'desc' => 'Isi nama & no HP agar pesanan tercatat'],
                ['num' => 3, 'title' => 'Lakukan Pemesanan', 'desc' => 'Pilih menu, pilih jumlah, lalu tambah ke pesanan'],
                ['num' => 4, 'title' => 'Konfirmasi Pesanan', 'desc' => 'Cek kembali pesanan, lalu kirim ke dapur'],
                ['num' => 5, 'title' => 'Bayar ke Kasir', 'desc' => 'Datang ke kasir, sebutkan nama, lakukan pembayaran'],
                ['num' => 6, 'title' => 'Tunggu Pesanan', 'desc' => 'Duduk santai, pesanan akan diantar ke meja'],
            ],
            'printMeta' => [
                'paper_width_mm' => 152,
                'printed_at' => now()->toIso8601String(),
            ],
        ];
    }

    private function qrImageDataUrl(string $value): string
    {
        $url = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data='.urlencode($value);
        $context = stream_context_create([
            'http' => ['timeout' => 5],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $image = @file_get_contents($url, false, $context);

        if ($image === false) {
            return $url;
        }

        return 'data:image/png;base64,'.base64_encode($image);
    }

    private function renderPrintV2Svg(array $payload): string
    {
        return view('exports.dining_tables.print_v2_svg', $payload)->render();
    }

    private function ensureQrToken(DiningTable $table): DiningTable
    {
        if (filled($table->qr_token)) {
            return $table;
        }

        $table->forceFill([
            'qr_token' => (string) Str::uuid(),
        ])->save();

        return $table->fresh() ?? $table;
    }
}
