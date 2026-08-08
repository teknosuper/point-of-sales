<?php

namespace Tests\Feature\Employees;

use App\Models\Employee;
use App\Models\EmployeeSchedule;
use App\Models\EmployeeShift;
use App\Models\PublicScheduleShare;
use App\Models\User;
use App\Services\EmployeeScheduleService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class EmployeeScheduleTest extends TestCase
{
    use RefreshDatabase;

    private const PERMISSIONS = [
        'employees-access',
        'employees-create',
        'employees-update',
        'employees-delete',
        'employee-schedules-access',
        'employee-schedules-generate',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        foreach (self::PERMISSIONS as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    private function createUserWithPermissions(array $permissions): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo($permissions);

        return $user;
    }

    private function createShifts(): array
    {
        return [
            EmployeeShift::create(['name' => 'Pagi', 'start_time' => '09:00', 'end_time' => '17:00', 'sort_order' => 1]),
            EmployeeShift::create(['name' => 'Tengah', 'start_time' => '12:00', 'end_time' => '21:00', 'sort_order' => 2]),
            EmployeeShift::create(['name' => 'Malam', 'start_time' => '16:00', 'end_time' => '00:00', 'sort_order' => 3]),
        ];
    }

    public function test_generation_assigns_one_employee_per_shift_and_gives_day_off_for_extras(): void
    {
        $this->createShifts();

        $employees = [];
        foreach (['Adil', 'Bilal', 'Ipan', 'Ajik'] as $index => $name) {
            $employees[] = Employee::create([
                'name' => $name,
                'job_type' => 'KEBERSIHAN',
                'rotation_order' => $index + 1,
                'is_active' => true,
            ]);
        }

        $result = app(EmployeeScheduleService::class)->generate(
            CarbonImmutable::parse('2026-08-03'),
            CarbonImmutable::parse('2026-08-09')
        );

        $this->assertSame(7, $result['generated_dates']);
        $this->assertSame(28, $result['generated_rows']);
        $this->assertSame(0, $result['skipped_dates']);

        // Hari kerja (Senin): 1 orang libur, 3 orang bekerja (satu per shift).
        $schedulesMon = EmployeeSchedule::whereDate('schedule_date', '2026-08-03')->get();
        $this->assertCount(4, $schedulesMon);
        $this->assertCount(1, $schedulesMon->whereNull('shift_id'));
        $this->assertCount(3, $schedulesMon->whereNotNull('shift_id'));

        // Hari Minggu (terlarang libur): semua bekerja, tidak ada libur.
        $schedulesSun = EmployeeSchedule::whereDate('schedule_date', '2026-08-09')->get();
        $this->assertCount(4, $schedulesSun);
        $this->assertCount(0, $schedulesSun->whereNull('shift_id'));
        $this->assertCount(4, $schedulesSun->whereNotNull('shift_id'));

        // Setiap karyawan mendapat tepat 1 libur dalam pekan, dan tidak pernah
        // dijadwalkan dobel dalam sehari.
        foreach ($employees as $employee) {
            $this->assertSame(
                1,
                EmployeeSchedule::where('employee_id', $employee->id)
                    ->whereBetween('schedule_date', ['2026-08-03', '2026-08-09'])
                    ->whereNull('shift_id')
                    ->count()
            );
        }

        foreach (['2026-08-03', '2026-08-09'] as $date) {
            $this->assertSame(
                4,
                EmployeeSchedule::whereDate('schedule_date', $date)->pluck('employee_id')->unique()->count(),
                'Seorang karyawan tidak boleh dobel dalam sehari.'
            );
        }

        // Rotasi berjalan: karyawan pertama mendapat shift berbeda antar hari.
        $firstEmployee = $employees[0];
        $dayOne = EmployeeSchedule::where('employee_id', $firstEmployee->id)
            ->whereDate('schedule_date', '2026-08-03')
            ->first();
        $dayTwo = EmployeeSchedule::where('employee_id', $firstEmployee->id)
            ->whereDate('schedule_date', '2026-08-04')
            ->first();
        $this->assertNotEquals($dayOne->shift_id, $dayTwo->shift_id);
    }

    public function test_generation_with_exactly_three_employees_covers_all_shifts(): void
    {
        $this->createShifts();

        foreach (['Fariska', 'Maila', 'Sella'] as $index => $name) {
            Employee::create([
                'name' => $name,
                'job_type' => 'KASIR',
                'rotation_order' => $index + 1,
                'is_active' => true,
            ]);
        }

        app(EmployeeScheduleService::class)->generate(
            CarbonImmutable::parse('2026-08-03'),
            CarbonImmutable::parse('2026-08-03')
        );

        $schedules = EmployeeSchedule::whereDate('schedule_date', '2026-08-03')->get();
        $this->assertCount(3, $schedules);
        $this->assertCount(0, $schedules->whereNull('shift_id'));
        $this->assertCount(3, $schedules->whereNotNull('shift_id')->pluck('shift_id')->unique());
    }

    public function test_generation_with_zero_day_off_config_yields_no_libur(): void
    {
        $this->createShifts();

        foreach (['Fariska', 'Maila', 'Sella'] as $index => $name) {
            Employee::create([
                'name' => $name,
                'job_type' => 'KASIR',
                'rotation_order' => $index + 1,
                'is_active' => true,
            ]);
        }

        \App\Models\EmployeeScheduleConfig::query()->delete();
        \App\Models\EmployeeScheduleConfig::create([
            'day_off_per_week' => 0,
            'blocked_weekdays' => [5, 6, 7],
        ]);

        app(EmployeeScheduleService::class)->generate(
            CarbonImmutable::parse('2026-08-03'),
            CarbonImmutable::parse('2026-08-09')
        );

        $this->assertSame(0, EmployeeSchedule::whereNull('shift_id')->count());
    }

    public function test_config_can_be_updated_via_controller(): void
    {
        $this->createShifts();

        $user = $this->createUserWithPermissions(['employee-schedules-generate']);

        $this->actingAs($user)
            ->post(route('employee-schedules.config'), [
                'day_off_per_week' => 2,
                'blocked_weekdays' => [6, 7],
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $config = \App\Models\EmployeeScheduleConfig::rule();
        $this->assertSame(2, $config->day_off_per_week);
        $this->assertSame([6, 7], array_map('intval', $config->blocked_weekdays));
    }

    public function test_night_rules_can_be_updated_via_controller(): void
    {
        $this->createShifts();

        $user = $this->createUserWithPermissions(['employee-schedules-generate']);

        $this->actingAs($user)
            ->post(route('employee-schedules.config'), [
                'day_off_per_week' => 1,
                'blocked_weekdays' => [5, 6, 7],
                'max_night_per_week' => 4,
                'night_after_off' => false,
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $config = \App\Models\EmployeeScheduleConfig::rule();
        $this->assertSame(4, $config->max_night_per_week);
        $this->assertFalse($config->night_after_off);
    }

    public function test_employee_after_libur_is_placed_on_night_shift(): void
    {
        [$shifts, $employees] = $this->createNightFixture();

        $nightShiftId = (int) $shifts->last()->id;

        // Kamis libur → Jumat wajib shift malam.
        EmployeeSchedule::create([
            'schedule_date' => '2026-08-06',
            'employee_id' => $employees[0]->id,
            'shift_id' => null,
            'status' => EmployeeSchedule::STATUS_LIBUR,
        ]);

        app(EmployeeScheduleService::class)->generate(
            CarbonImmutable::parse('2026-08-07'),
            CarbonImmutable::parse('2026-08-07')
        );

        $friday = EmployeeSchedule::whereDate('schedule_date', '2026-08-07')
            ->where('employee_id', $employees[0]->id)
            ->first();

        $this->assertNotNull($friday);
        $this->assertSame(EmployeeSchedule::STATUS_MASUK, $friday->status);
        $this->assertSame($nightShiftId, (int) $friday->shift_id);
    }

    public function test_night_shift_cap_per_week_is_respected(): void
    {
        [$shifts, $employees] = $this->createNightFixture();

        $nightShiftId = (int) $shifts->last()->id;

        \App\Models\EmployeeScheduleConfig::query()->delete();
        \App\Models\EmployeeScheduleConfig::create([
            'day_off_per_week' => 1,
            'blocked_weekdays' => [5, 6, 7],
            'max_night_per_week' => 2,
            'night_after_off' => true,
        ]);

        app(EmployeeScheduleService::class)->generate(
            CarbonImmutable::parse('2026-08-03'),
            CarbonImmutable::parse('2026-08-09')
        );

        // Tidak ada karyawan yang mendapat shift malam lebih dari batas per pekan.
        foreach ($employees as $employee) {
            $nightCount = EmployeeSchedule::where('employee_id', $employee->id)
                ->where('shift_id', $nightShiftId)
                ->whereBetween('schedule_date', ['2026-08-03', '2026-08-09'])
                ->count();

            $this->assertLessThanOrEqual(2, $nightCount, "{$employee->name} melebihi batas shift malam.");
        }
    }

    public function test_extras_fall_to_night_shift_when_employees_exceed_shifts(): void
    {
        [$shifts, $employees] = $this->createNightFixture();

        $nightShiftId = (int) $shifts->last()->id;

        \App\Models\EmployeeScheduleConfig::query()->delete();
        \App\Models\EmployeeScheduleConfig::create([
            'day_off_per_week' => 1,
            'blocked_weekdays' => [5, 6, 7],
            'max_night_per_week' => 7,
            'night_after_off' => false,
        ]);

        app(EmployeeScheduleService::class)->generate(
            CarbonImmutable::parse('2026-08-03'),
            CarbonImmutable::parse('2026-08-09')
        );

        // Minggu (terlarang libur, 4 orang aktif, 3 shift) → 2 orang shift malam.
        $sundayNight = EmployeeSchedule::whereDate('schedule_date', '2026-08-09')
            ->where('shift_id', $nightShiftId)
            ->count();

        $this->assertSame(2, $sundayNight);
    }

    public function test_extras_fall_to_configured_priority_shift(): void
    {
        [$shifts, $employees] = $this->createNightFixture();

        $priorityShiftId = (int) $shifts->first()->id;

        \App\Models\EmployeeScheduleConfig::query()->delete();
        \App\Models\EmployeeScheduleConfig::create([
            'day_off_per_week' => 1,
            'blocked_weekdays' => [5, 6, 7],
            'max_night_per_week' => 7,
            'night_after_off' => false,
            'priority_shift_id' => $priorityShiftId,
        ]);

        app(EmployeeScheduleService::class)->generate(
            CarbonImmutable::parse('2026-08-03'),
            CarbonImmutable::parse('2026-08-09')
        );

        // Minggu (terlarang libur, 4 orang aktif, 3 shift) → 2 orang di shift prioritas.
        $sundayPriority = EmployeeSchedule::whereDate('schedule_date', '2026-08-09')
            ->where('shift_id', $priorityShiftId)
            ->count();

        $this->assertSame(2, $sundayPriority);

        // Default tanpa config → kelebihan jatuh ke shift terakhir (tidak ke shift pertama).
        \App\Models\EmployeeScheduleConfig::query()->delete();
        \App\Models\EmployeeScheduleConfig::create([
            'day_off_per_week' => 1,
            'blocked_weekdays' => [5, 6, 7],
            'max_night_per_week' => 7,
            'night_after_off' => false,
        ]);

        EmployeeSchedule::query()->delete();

        app(EmployeeScheduleService::class)->generate(
            CarbonImmutable::parse('2026-08-03'),
            CarbonImmutable::parse('2026-08-09')
        );

        $sundayFirstDefault = EmployeeSchedule::whereDate('schedule_date', '2026-08-09')
            ->where('shift_id', $priorityShiftId)
            ->count();

        $this->assertLessThan(2, $sundayFirstDefault);
    }

    private function createNightFixture(): array
    {
        $shifts = collect($this->createShifts());

        $employees = [];
        foreach (['Adil', 'Bilal', 'Ipan', 'Ajik'] as $index => $name) {
            $employees[] = Employee::create([
                'name' => $name,
                'job_type' => 'KASIR',
                'rotation_order' => $index + 1,
                'is_active' => true,
            ]);
        }

        return [$shifts, $employees];
    }

    public function test_generation_skips_dates_that_already_have_schedule(): void
    {
        $this->createShifts();

        foreach (['Fariska', 'Maila', 'Sella'] as $index => $name) {
            Employee::create([
                'name' => $name,
                'job_type' => 'KASIR',
                'rotation_order' => $index + 1,
                'is_active' => true,
            ]);
        }

        $service = app(EmployeeScheduleService::class);
        $service->generate(CarbonImmutable::parse('2026-08-03'), CarbonImmutable::parse('2026-08-09'));

        $countAfterFirst = EmployeeSchedule::count();

        $result = $service->generate(
            CarbonImmutable::parse('2026-08-03'),
            CarbonImmutable::parse('2026-08-09')
        );

        $this->assertSame(7, $result['skipped_dates']);
        $this->assertSame($countAfterFirst, EmployeeSchedule::count());
    }

    public function test_generation_fills_partially_filled_date_without_overwriting(): void
    {
        $this->createShifts();

        $employees = [];
        foreach (['Fariska', 'Maila', 'Sella'] as $index => $name) {
            $employees[] = Employee::create([
                'name' => $name,
                'job_type' => 'KASIR',
                'rotation_order' => $index + 1,
                'is_active' => true,
            ]);
        }

        $service = app(EmployeeScheduleService::class);
        $service->generate(CarbonImmutable::parse('2026-08-03'), CarbonImmutable::parse('2026-08-03'));

        // Simulasikan jadwal lama yang hanya terisi satu karyawan.
        EmployeeSchedule::whereDate('schedule_date', '2026-08-03')
            ->where('employee_id', '!=', $employees[0]->id)
            ->delete();

        $kept = EmployeeSchedule::whereDate('schedule_date', '2026-08-03')->first();

        $result = $service->generate(
            CarbonImmutable::parse('2026-08-03'),
            CarbonImmutable::parse('2026-08-03')
        );

        $this->assertSame(1, $result['generated_dates']);
        $this->assertSame(2, $result['generated_rows']);

        $schedules = EmployeeSchedule::whereDate('schedule_date', '2026-08-03')->get();
        $this->assertCount(3, $schedules);
        $this->assertSame(
            3,
            $schedules->pluck('employee_id')->unique()->count(),
            'Generate tidak boleh membuat karyawan dobel dalam sehari.'
        );

        $this->assertDatabaseHas('employee_schedules', [
            'schedule_date' => '2026-08-03',
            'employee_id' => $employees[0]->id,
            'shift_id' => $kept->shift_id,
        ]);
    }

    public function test_authorized_user_can_generate_schedule_via_controller(): void
    {
        $this->createShifts();

        Employee::create([
            'name' => 'Fariska',
            'job_type' => 'KASIR',
            'rotation_order' => 1,
            'is_active' => true,
        ]);

        $user = $this->createUserWithPermissions([
            'employee-schedules-access',
            'employee-schedules-generate',
        ]);

        $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($user)
            ->post(route('employee-schedules.generate'), [
                'start_date' => '2026-08-03',
                'end_date' => '2026-08-05',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('employee_schedules', [
            'schedule_date' => '2026-08-03',
        ]);
    }

    public function test_unauthorized_user_cannot_generate_schedule(): void
    {
        $this->createShifts();

        Employee::create([
            'name' => 'Fariska',
            'job_type' => 'KASIR',
            'rotation_order' => 1,
            'is_active' => true,
        ]);

        $user = $this->createUserWithPermissions(['employee-schedules-access']);

        $this->withSession(['auth.password_confirmed_at' => time()])
            ->actingAs($user)
            ->post(route('employee-schedules.generate'), [
                'start_date' => '2026-08-03',
                'end_date' => '2026-08-05',
            ])
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertSame(0, EmployeeSchedule::count());
    }

    public function test_user_can_set_manual_shift_or_day_off(): void
    {
        $this->createShifts();

        $employee = Employee::create([
            'name' => 'Doni',
            'job_type' => 'PARKIR',
            'rotation_order' => 1,
            'is_active' => true,
        ]);

        $user = $this->createUserWithPermissions(['employee-schedules-generate']);

        $this->actingAs($user)
            ->post(route('employee-schedules.set'), [
                'schedule_date' => '2026-08-03',
                'employee_id' => $employee->id,
                'shift_id' => null,
            ])
            ->assertRedirect();

        $schedule = EmployeeSchedule::where('employee_id', $employee->id)->first();
        $this->assertNotNull($schedule);
        $this->assertNull($schedule->shift_id);

        $this->actingAs($user)
            ->post(route('employee-schedules.set'), [
                'schedule_date' => '2026-08-03',
                'employee_id' => $employee->id,
                'shift_id' => (string) $this->firstShiftId(),
            ])
            ->assertRedirect();

        $schedule->refresh();
        $this->assertSame($this->firstShiftId(), $schedule->shift_id);
    }

    private function firstShiftId(): int
    {
        return (int) EmployeeShift::query()->orderBy('sort_order')->value('id');
    }

    public function test_toggle_share_creates_active_public_link(): void
    {
        $this->createShifts();

        $user = $this->createUserWithPermissions(['employee-schedules-access']);

        $this->actingAs($user)
            ->post(route('employee-schedules.share'), ['enabled' => true])
            ->assertRedirect()
            ->assertSessionHas('success');

        $share = PublicScheduleShare::query()->orderBy('id')->first();
        $this->assertNotNull($share);
        $this->assertTrue($share->is_active);
        $this->assertNotEmpty($share->token);
    }

    public function test_toggle_share_disables_public_link(): void
    {
        $this->createShifts();

        $user = $this->createUserWithPermissions(['employee-schedules-access']);

        $this->actingAs($user)->post(route('employee-schedules.share'), ['enabled' => true]);

        $share = PublicScheduleShare::query()->orderBy('id')->first();

        $this->actingAs($user)
            ->post(route('employee-schedules.share'), ['enabled' => false])
            ->assertRedirect()
            ->assertSessionHas('success');

        $share->refresh();
        $this->assertFalse($share->is_active);
    }

    public function test_public_schedule_page_renders_without_login(): void
    {
        $this->createShifts();

        Employee::create([
            'name' => 'Fariska',
            'job_type' => 'KASIR',
            'rotation_order' => 1,
            'is_active' => true,
        ]);

        $share = PublicScheduleShare::create([
            'token' => (string) \Illuminate\Support\Str::uuid(),
            'is_active' => true,
        ]);

        $this
            ->get(route('public.schedule.show', $share->token))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Public/Schedule')
                ->has('groups')
                ->where('token', $share->token));
    }

    public function test_public_schedule_returns_404_for_inactive_share(): void
    {
        $share = PublicScheduleShare::create([
            'token' => (string) \Illuminate\Support\Str::uuid(),
            'is_active' => false,
        ]);

        $this->get(route('public.schedule.show', $share->token))->assertNotFound();
    }
}
