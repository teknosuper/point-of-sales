<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Services\OutletResolver;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SupplierController extends Controller
{
    public function __construct(
        private readonly OutletResolver $outletResolver
    ) {}

    public function index(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'has_contact' => $request->input('has_contact', ''),
            'sort' => $request->input('sort', 'name_asc'),
            'per_page' => (int) $request->input('per_page', 10),
        ];

        $allowedPerPage = [10, 25, 50, 100];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 10;
        }

        $suppliers = Supplier::query()
            ->when(
                $outlet,
                fn ($query) => $query->where('outlet_id', $outlet->id),
                fn ($query) => $query->whereNull('outlet_id')
            )
            ->when($filters['search'] !== '', function ($query) use ($filters) {
                $search = $filters['search'];

                $query->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('name', 'like', '%'.$search.'%')
                        ->orWhere('phone', 'like', '%'.$search.'%')
                        ->orWhere('email', 'like', '%'.$search.'%')
                        ->orWhere('address', 'like', '%'.$search.'%');
                });
            })
            ->when($filters['has_contact'] !== '', function ($query) use ($filters) {
                return match ($filters['has_contact']) {
                    'yes' => $query->where(function ($innerQuery) {
                        $innerQuery
                            ->whereNotNull('phone')->where('phone', '!=', '')
                            ->orWhereNotNull('email')->where('email', '!=', '');
                    }),
                    'no' => $query->where(function ($innerQuery) {
                        $innerQuery
                            ->where(function ($contactQuery) {
                                $contactQuery->whereNull('phone')->orWhere('phone', '');
                            })
                            ->where(function ($contactQuery) {
                                $contactQuery->whereNull('email')->orWhere('email', '');
                            });
                    }),
                    default => $query,
                };
            });

        $suppliers = match ($filters['sort']) {
            'latest' => $suppliers->latest(),
            'oldest' => $suppliers->oldest(),
            'name_desc' => $suppliers->orderByDesc('name'),
            default => $suppliers->orderBy('name'),
        };

        $suppliers = $suppliers->paginate($filters['per_page'])->withQueryString();

        return Inertia::render('Dashboard/Suppliers/Index', [
            'suppliers' => $suppliers,
            'filters' => $filters,
            'meta' => [
                'per_page_options' => $allowedPerPage,
            ],
            'workspace' => [
                'active_outlet' => $outlet
                    ? [
                        'id' => $outlet->id,
                        'name' => $outlet->name,
                        'code' => $outlet->code,
                        'outlet_type' => $outlet->outlet_type,
                    ]
                    : null,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string'],
        ]);

        Supplier::create([
            ...$data,
            'outlet_id' => $outlet?->id,
        ]);

        return back()->with('success', 'Supplier berhasil ditambahkan.');
    }

    public function update(Request $request, Supplier $supplier)
    {
        $this->abortIfSupplierOutsideOutlet($request, $supplier);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string'],
        ]);

        $supplier->update($data);

        return back()->with('success', 'Supplier berhasil diperbarui.');
    }

    public function destroy(Supplier $supplier)
    {
        $this->abortIfSupplierOutsideOutlet(request(), $supplier);

        if ($supplier->payables()->exists()) {
            return back()->with('error', 'Supplier memiliki hutang, tidak dapat dihapus.');
        }
        $supplier->delete();

        return back()->with('success', 'Supplier dihapus.');
    }

    private function abortIfSupplierOutsideOutlet(Request $request, Supplier $supplier): void
    {
        $outlet = $this->outletResolver->resolve($request, $request->user());

        if ($outlet && (int) $supplier->outlet_id !== (int) $outlet->id) {
            abort(404);
        }

        if (! $outlet && $supplier->outlet_id !== null) {
            abort(404);
        }
    }
}
