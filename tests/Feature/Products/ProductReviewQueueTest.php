<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ProductReviewQueueTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'products-access',
            'products-review',
        ] as $permission) {
            Permission::firstOrCreate([
                'name' => $permission,
                'guard_name' => 'web',
            ]);
        }
    }

    public function test_tenant_user_only_sees_own_pending_products(): void
    {
        [$tenantUser, $tenantOutlet] = $this->createTenantUser();

        $ownProduct = $this->createPendingProduct($tenantOutlet->id, 'Produk Tenant Menunggu');
        $this->createPendingProduct(null, 'Produk Owner Global');

        $this->actingAs($tenantUser)
            ->get(route('products.review'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Products/Review')
                ->where('pendingProducts.data', fn ($rows) => count($rows) === 1
                    && (int) $rows[0]['id'] === (int) $ownProduct->id));
    }

    public function test_main_outlet_owner_sees_all_pending_products(): void
    {
        $owner = $this->createMainOutletOwner();
        $tenantOutlet = Outlet::create([
            'code' => 'TNT-'.Str::upper(Str::random(4)),
            'slug' => 'tenant-'.Str::lower(Str::random(8)),
            'name' => 'Tenant A',
            'outlet_type' => 'tenant',
            'is_active' => true,
            'is_default' => false,
        ]);

        $this->createPendingProduct($tenantOutlet->id, 'Produk Tenant A');
        $this->createPendingProduct(null, 'Produk Owner Global');

        $this->actingAs($owner)
            ->get(route('products.review'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Products/Review')
                ->where('pendingProducts.data', fn ($rows) => count($rows) === 2));
    }

    public function test_owner_can_approve_pending_product(): void
    {
        $owner = $this->createMainOutletOwner();
        $product = $this->createPendingProduct(null, 'Produk Disetujui');
        $this->assertSame('pending', $product->publish_status);

        $this->session(['auth.password_confirmed_at' => time()]);

        $this->actingAs($owner)
            ->patch(route('products.approve', $product->id))
            ->assertRedirect();

        $this->assertSame('approved', $product->fresh()->publish_status);
        $this->assertNotNull($product->fresh()->published_at);
    }

    public function test_owner_can_reject_pending_product(): void
    {
        $owner = $this->createMainOutletOwner();
        $product = $this->createPendingProduct(null, 'Produk Ditolak');

        $this->session(['auth.password_confirmed_at' => time()]);

        $this->actingAs($owner)
            ->patch(route('products.reject', $product->id), ['review_note' => 'Harga belum sesuai'])
            ->assertRedirect();

        $this->assertSame('rejected', $product->fresh()->publish_status);
        $this->assertNull($product->fresh()->published_at);
        $this->assertSame('Harga belum sesuai', $product->fresh()->review_note);
    }

    private function createPendingProduct(?int $tenantOutletId, string $title): Product
    {
        $category = Category::create([
            'name' => 'Kategori '.Str::random(4),
            'description' => 'Kategori review',
            'image' => 'category.png',
            'tenant_outlet_id' => $tenantOutletId,
        ]);

        return Product::create([
            'category_id' => $category->id,
            'tenant_outlet_id' => $tenantOutletId,
            'image' => 'product.png',
            'barcode' => 'BRCD-'.Str::upper(Str::random(8)),
            'sku' => 'SKU-'.Str::upper(Str::random(8)),
            'title' => $title,
            'description' => 'Produk menunggu review',
            'tenant_hpp_price' => 15000,
            'buy_price' => 15000,
            'sell_price' => 25000,
            'stock' => 5,
            'publish_status' => 'pending',
            'published_at' => null,
        ]);
    }

    /**
     * @return array{0: User, 1: Outlet}
     */
    private function createTenantUser(): array
    {
        $outlet = Outlet::create([
            'code' => 'TNT-'.Str::upper(Str::random(4)),
            'slug' => 'tenant-'.Str::lower(Str::random(8)),
            'name' => 'Tenant Review',
            'outlet_type' => 'tenant',
            'is_active' => true,
            'is_default' => false,
        ]);

        $user = User::factory()->create();
        $user->givePermissionTo(['products-access', 'products-review']);
        $user->outlets()->attach($outlet->id, ['is_primary' => true]);

        return [$user, $outlet];
    }

    private function createMainOutletOwner(): User
    {
        Outlet::create([
            'code' => 'MAIN',
            'slug' => 'main-outlet',
            'name' => 'Outlet Utama',
            'outlet_type' => 'main',
            'is_active' => true,
            'is_default' => true,
        ]);

        $user = User::factory()->create();
        $user->givePermissionTo(['products-access', 'products-review']);
        $user->outlets()->attach(
            Outlet::where('outlet_type', 'main')->value('id'),
            ['is_primary' => true]
        );

        return $user;
    }
}
