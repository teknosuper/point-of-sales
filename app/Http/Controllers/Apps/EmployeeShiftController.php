<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\EmployeeShift;
use Illuminate\Http\Request;

class EmployeeShiftController extends Controller
{
    public function index()
    {
        $shifts = EmployeeShift::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['shifts' => $shifts]);
    }

    public function store(Request $request)
    {
        $validated = $this->validated($request);

        EmployeeShift::create($validated);

        return back()->with('success', 'Shift berhasil ditambahkan.');
    }

    public function update(Request $request, EmployeeShift $employeeShift)
    {
        $validated = $this->validated($request);

        $employeeShift->update($validated);

        return back()->with('success', 'Shift berhasil diperbarui.');
    }

    public function destroy(EmployeeShift $employeeShift)
    {
        if ($employeeShift->schedules()->exists()) {
            return back()->with('error', 'Shift tidak bisa dihapus karena masih dipakai di jadwal. Nonaktifkan saja.');
        }

        $employeeShift->delete();

        return back()->with('success', 'Shift berhasil dihapus.');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ], [
            'name.required' => 'Nama shift wajib diisi.',
            'start_time.required' => 'Jam mulai wajib diisi.',
            'end_time.required' => 'Jam selesai wajib diisi.',
        ]);
    }
}
