<?php

namespace Tests\Feature\Outlets;

use App\Models\KitchenStation;
use App\Models\KitchenStationDevice;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class OutletProvisioningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate([
            'name' => 'outlets-create',
            'guard_name' => 'web',
        ]);
    }

    public function test_store_creates_outlet_with_kitchen_station_and_devices(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('outlets-create');

        $this->withSession($this->recentlyConfirmedSession())
            ->actingAs($user)
            ->post(route('outlets.store'), [
                'code' => 'NEW-OUT',
                'name' => 'New Outlet',
                'outlet_type' => 'main',
            ])
            ->assertRedirect();

        $outlet = Outlet::where('code', 'NEW-OUT')->first();
        $this->assertNotNull($outlet);

        $station = KitchenStation::where('outlet_id', $outlet->id)->first();
        $this->assertNotNull($station);
        $this->assertSame('Dapur New Outlet', $station->name);
        $this->assertSame('kitchen', $station->station_type);
        $this->assertSame('screen', $station->display_mode);
        $this->assertTrue($station->is_active);

        $devices = KitchenStationDevice::where('kitchen_station_id', $station->id)->get();
        $this->assertCount(2, $devices);

        $screen = $devices->firstWhere('device_type', 'screen');
        $this->assertNotNull($screen);
        $this->assertSame('Layar Dapur New Outlet', $screen->name);
        $this->assertSame('browser', $screen->connection_driver);
        $this->assertSame(KitchenStationDevice::PRINT_PROFILE_BROWSER, data_get($screen->meta, 'print_profile'));
        $this->assertSame('manual', data_get($screen->meta, 'dispatch_mode'));

        $printer = $devices->firstWhere('device_type', 'printer');
        $this->assertNotNull($printer);
        $this->assertSame('Printer Dapur New Outlet', $printer->name);
        $this->assertSame('browser', $printer->connection_driver);
        $this->assertSame(KitchenStationDevice::PRINT_PROFILE_RAWBT, data_get($printer->meta, 'print_profile'));
        $this->assertSame('auto', data_get($printer->meta, 'dispatch_mode'));
        $this->assertSame('80mm', data_get($printer->meta, 'paper_width'));
        $this->assertSame('kitchen', data_get($printer->meta, 'template_style'));
        $this->assertSame(1, data_get($printer->meta, 'print_copies'));
    }
}
