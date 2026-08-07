<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use Illuminate\Http\Request;
use Inertia\Inertia;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $filters = [
            'search' => trim((string) $request->input('search', '')),
            'job_type' => trim((string) $request->input('job_type', '')),
            'is_active' => $request->input('is_active', ''),
            'per_page' => (int) $request->input('per_page', 10),
        ];

        $allowedPerPage = [10, 25, 50, 100];
        if (! in_array($filters['per_page'], $allowedPerPage, true)) {
            $filters['per_page'] = 10;
        }

        $employees = Employee::query()
            ->when($filters['search'] !== '', function ($query) use ($filters) {
                $query->where(function ($inner) use ($filters) {
                    $inner->where('name', 'like', '%'.$filters['search'].'%')
                        ->orWhere('phone', 'like', '%'.$filters['search'].'%')
                        ->orWhere('notes', 'like', '%'.$filters['search'].'%');
                });
            })
            ->when($filters['job_type'] !== '', function ($query) use ($filters) {
                $query->where('job_type', $filters['job_type']);
            })
            ->when($filters['is_active'] !== '', function ($query) use ($filters) {
                $query->where('is_active', $filters['is_active'] === 'yes');
            })
            ->orderBy('job_type')
            ->orderBy('rotation_order')
            ->orderBy('name')
            ->paginate($filters['per_page'])
            ->withQueryString();

        return Inertia::render('Dashboard/Employees/Index', [
            'employees' => $employees,
            'filters' => $filters,
            'jobTypes' => Employee::query()->distinct()->orderBy('job_type')->pluck('job_type')->all(),
            'meta' => ['per_page_options' => $allowedPerPage],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validated($request);

        Employee::create($validated);

        return back()->with('success', 'Karyawan berhasil ditambahkan.');
    }

    public function update(Request $request, Employee $employee)
    {
        $validated = $this->validated($request);

        $employee->update($validated);

        return back()->with('success', 'Data karyawan berhasil diperbarui.');
    }

    public function destroy(Employee $employee)
    {
        $employee->delete();

        return back()->with('success', 'Karyawan berhasil dihapus.');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'job_type' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'notes' => ['nullable', 'string', 'max:255'],
            'rotation_order' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ], [
            'name.required' => 'Nama karyawan wajib diisi.',
            'job_type.required' => 'Jenis pekerjaan wajib diisi.',
        ]);
    }
}
