<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
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
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string'],
        ]);

        Supplier::create($data);

        return back()->with('success', 'Supplier berhasil ditambahkan.');
    }

    public function update(Request $request, Supplier $supplier)
    {
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
        if ($supplier->payables()->exists()) {
            return back()->with('error', 'Supplier memiliki hutang, tidak dapat dihapus.');
        }
        $supplier->delete();

        return back()->with('success', 'Supplier dihapus.');
    }
}
