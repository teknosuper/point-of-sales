<?php

namespace Tests\Feature\Transactions;

use App\Models\Cart;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\DiningTable;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class TakeawayRequiredModifierTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Permission::firstOrCreate(['name' => 'transactions-access', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'cashier-shifts-access', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'cashier-shifts-open', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'cashier-shifts-close', 'guard_name' => 'web']);
    }

    public function test_take_away_requires_bungkus_group_but_dine_in_does_not(): void
    {
        $cashier = $this->createCashier();
        $outlet = $this->createOutlet();
        $cashier->outlets()->attach($outlet, ['is_primary' => true]);
        $this->openShiftFor($cashier, $outlet);
        $table = $this->createTable($outlet);

        $customer = Customer::create([
            'name' => 'Bungkus Customer',
            'no_telp' => 62812345,
            'address' => 'Jl. Topping',
        ]);
        $product = $this->createProductWithScopedGroups();

        Cart::create([
            'cashier_id' => $cashier->id,
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => $product->sell_price,
        ]);

        // Take-away tanpa memilih bungkus -> ditolak.
        $this->actingAs($cashier)
            ->from(route('transactions.index'))
            ->post(route('transactions.store'), [
                'customer_id' => $customer->id,
                'order_type' => 'take_away',
                'discount' => 0,
                'grand_total' => $product->sell_price,
                'cash' => $product->sell_price,
                'change' => 0,
            ])
            ->assertRedirect(route('transactions.index'));

        $this->assertDatabaseCount('transactions', 0);

        // Dine-in tanpa bungkus -> boleh lolos karena grup bungkus hanya berlaku take-away.
        $this->actingAs($cashier)
            ->post(route('transactions.store'), [
                'customer_id' => $customer->id,
                'order_type' => 'dine_in',
                'table_id' => $table->id,
                'discount' => 0,
                'grand_total' => $product->sell_price,
                'cash' => $product->sell_price,
                'change' => 0,
            ])
            ->assertRedirect();

        $this->assertDatabaseCount('transactions', 1);
        $this->assertSame('dine_in', Transaction::latest('id')->first()->order_type);
    }

    public function test_take_away_with_bungkus_modifier_is_accepted(): void
    {
        $cashier = $this->createCashier();
        $outlet = $this->createOutlet();
        $cashier->outlets()->attach($outlet, ['is_primary' => true]);
        $this->openShiftFor($cashier, $outlet);

        $customer = Customer::create([
            'name' => 'Bungkus OK',
            'no_telp' => 62812345,
            'address' => 'Jl. Topping',
        ]);
        $product = $this->createProductWithScopedGroups();
        $bungkus = $product->modifierOptions()
            ->where('group_name', 'Bungkus')
            ->first();

        $cart = Cart::create([
            'cashier_id' => $cashier->id,
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'qty' => 1,
            'price' => $product->sell_price,
        ]);

        $cart->modifiers()->create([
            'product_modifier_option_id' => $bungkus->id,
            'name' => $bungkus->name,
            'qty' => 1,
            'unit_price' => (int) $bungkus->price,
            'base_price' => (int) $bungkus->price,
            'markup_price' => 0,
            'total_price' => (int) $bungkus->price,
        ]);

        $grandTotal = $product->sell_price + (int) $bungkus->price;

        $this->actingAs($cashier)
            ->post(route('transactions.store'), [
                'customer_id' => $customer->id,
                'order_type' => 'take_away',
                'discount' => 0,
                'grand_total' => $grandTotal,
                'cash' => $grandTotal,
                'change' => 0,
            ])
            ->assertRedirect();

        $this->assertDatabaseCount('transactions', 1);
        $this->assertSame('take_away', Transaction::latest('id')->first()->order_type);
    }

    public function test_per_item_order_type_overrides_transaction_level(): void
    {
        $cashier = $this->createCashier();
        $outlet = $this->createOutlet();
        $cashier->outlets()->attach($outlet, ['is_primary' => true]);
        $this->openShiftFor($cashier, $outlet);

        $customer = Customer::create([
            'name' => 'Per Item',
            'no_telp' => 62812345,
            'address' => 'Jl. Topping',
        ]);
        $product = $this->createProductWithScopedGroups();

        // Item ditandai take_away, tapi transaksi dine_in -> bungkus tetap wajib (per-item menang).
        Cart::create([
            'cashier_id' => $cashier->id,
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'order_type' => 'take_away',
            'qty' => 1,
            'price' => $product->sell_price,
        ]);

        $this->actingAs($cashier)
            ->from(route('transactions.index'))
            ->post(route('transactions.store'), [
                'customer_id' => $customer->id,
                'order_type' => 'dine_in',
                'discount' => 0,
                'grand_total' => $product->sell_price,
                'cash' => $product->sell_price,
                'change' => 0,
            ])
            ->assertRedirect(route('transactions.index'));

        $this->assertDatabaseCount('transactions', 0);

        // Item ditandai dine_in, transaksi take_away -> bungkus tidak wajib.
        Cart::query()->update(['order_type' => 'dine_in']);

        $this->actingAs($cashier)
            ->post(route('transactions.store'), [
                'customer_id' => $customer->id,
                'order_type' => 'take_away',
                'discount' => 0,
                'grand_total' => $product->sell_price,
                'cash' => $product->sell_price,
                'change' => 0,
            ])
            ->assertRedirect();

        $this->assertDatabaseCount('transactions', 1);
    }

    private function createProductWithScopedGroups(): Product
    {
        $category = Category::create([
            'name' => 'Makanan',
            'description' => 'Kategori pengujian',
            'image' => 'category.png',
        ]);

        $product = Product::create([
            'category_id' => $category->id,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(10)),
            'title' => 'Mie Goreng Take Away',
            'description' => 'Deskripsi.',
            'buy_price' => 15000,
            'sell_price' => 20000,
            'stock' => 10,
            'supports_modifiers' => true,
            'publish_status' => 'approved',
            'published_at' => now(),
        ]);

        $product->modifierOptions()->createMany([
            [
                'group_name' => 'Bungkus',
                'order_type_scope' => 'take_away',
                'name' => 'Bungkus Kertas',
                'price' => 1000,
                'is_active' => true,
                'selection_mode' => 'multiple',
                'min_select' => 1,
                'max_select' => null,
            ],
            [
                'group_name' => 'Bungkus',
                'order_type_scope' => 'take_away',
                'name' => 'Mika',
                'price' => 2000,
                'is_active' => true,
                'selection_mode' => 'multiple',
                'min_select' => 1,
                'max_select' => null,
            ],
            [
                'group_name' => 'Kuah',
                'order_type_scope' => null,
                'name' => 'Kuah Kental',
                'price' => 0,
                'is_active' => true,
                'selection_mode' => 'optional',
                'min_select' => 0,
                'max_select' => null,
            ],
        ]);

        return $product;
    }

    private function createCashier(): User
    {
        $user = User::factory()->create();
        $user->givePermissionTo([
            'transactions-access',
            'cashier-shifts-access',
            'cashier-shifts-open',
            'cashier-shifts-close',
        ]);

        return $user;
    }

    private function createOutlet(): Outlet
    {
        return Outlet::create([
            'code' => 'OUTLET-A',
            'slug' => 'outlet-a',
            'name' => 'Outlet A',
            'legal_name' => 'Outlet A',
            'address' => 'Jl. Test No. 1',
            'city' => 'Jakarta',
            'phone' => '08123456789',
            'email' => 'outlet@example.com',
            'website' => 'https://example.com',
            'outlet_type' => 'main',
            'commission_rate_percent' => 0,
            'is_active' => true,
            'is_default' => true,
            'sort_order' => 1,
        ]);
    }

    private function createTable(Outlet $outlet): DiningTable
    {
        return DiningTable::create([
            'outlet_id' => $outlet->id,
            'name' => 'Meja 01',
            'code' => 'A1',
            'qr_token' => 'table-01-token',
            'capacity' => 4,
            'status' => 'active',
            'self_order_enabled' => true,
            'sort_order' => 1,
        ]);
    }

    private function openShiftFor(User $cashier, Outlet $outlet): CashierShift
    {
        return CashierShift::create([
            'user_id' => $cashier->id,
            'outlet_id' => $outlet->id,
            'opened_by' => $cashier->id,
            'opened_at' => now(),
            'opening_cash' => 100000,
            'expected_cash' => 100000,
            'status' => 'open',
        ]);
    }
}
