<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Services\EmployeeScheduleService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

class EmployeeScheduleSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedShifts();
        $this->seedEmployees();

        $this->seedCurrentWeek();
    }

    private function seedShifts(): void
    {
        $shifts = [
            ['name' => 'Pagi', 'start_time' => '09:00', 'end_time' => '17:00', 'sort_order' => 1],
            ['name' => 'Tengah', 'start_time' => '12:00', 'end_time' => '21:00', 'sort_order' => 2],
            ['name' => 'Malam', 'start_time' => '16:00', 'end_time' => '00:00', 'sort_order' => 3],
        ];

        foreach ($shifts as $shift) {
            EmployeeShift::updateOrCreate(
                ['name' => $shift['name']],
                $shift
            );
        }
    }

    private function seedEmployees(): void
    {
        $employees = [
            ['name' => 'Fariska', 'job_type' => 'KASIR', 'rotation_order' => 1],
            ['name' => 'Maila', 'job_type' => 'KASIR', 'rotation_order' => 2],
            ['name' => 'Sella', 'job_type' => 'KASIR', 'rotation_order' => 3],
            ['name' => 'Adil', 'job_type' => 'KEBERSIHAN', 'rotation_order' => 1],
            ['name' => 'Bilal', 'job_type' => 'KEBERSIHAN', 'rotation_order' => 2],
            ['name' => 'Ipan', 'job_type' => 'KEBERSIHAN', 'rotation_order' => 3],
            ['name' => 'Ajik', 'job_type' => 'KEBERSIHAN', 'rotation_order' => 4],
            ['name' => 'Nanang', 'job_type' => 'PARKIR', 'rotation_order' => 1],
            ['name' => 'Doni', 'job_type' => 'PARKIR', 'rotation_order' => 2],
            ['name' => 'Doglas', 'job_type' => 'PARKIR', 'rotation_order' => 3],
        ];

        foreach ($employees as $employee) {
            Employee::updateOrCreate(
                ['name' => $employee['name']],
                [
                    'job_type' => $employee['job_type'],
                    'rotation_order' => $employee['rotation_order'],
                    'is_active' => true,
                ]
            );
        }
    }

    private function seedCurrentWeek(): void
    {
        if (! Employee::query()->where('is_active', true)->exists()) {
            return;
        }

        $start = CarbonImmutable::now()->startOfWeek(CarbonImmutable::MONDAY);

        try {
            app(EmployeeScheduleService::class)->generate($start, $start->addDays(6));
        } catch (\Throwable $e) {
            $this->command?->warn('Gagal generate jadwal minggu berjalan: '.$e->getMessage());
        }
    }
}
