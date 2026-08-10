<?php

namespace Tests\Feature\Products;

use App\Models\Category;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\ProductRenameRequest;
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
            'products-edit',
            'products-pricing-update',
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

    public function test_tenant_name_change_creates_pending_rename_request_and_keeps_product_approved(): void
    {
        [$tenantUser, $tenantOutlet] = $this->createTenantEditor();
        $product = $this->createApprovedProduct($tenantOutlet->id, 'Nama Asli');

        $this->actingAs($tenantUser)
            ->put(route('products.update', $product->id), [
                'title' => 'Nama Baru',
                'description' => $product->description,
                'category_id' => $product->category_id,
                'tenant_outlet_id' => $tenantOutlet->id,
                'buy_price' => $product->buy_price,
                'sell_price' => $product->sell_price,
                'tenant_hpp_price' => $product->tenant_hpp_price,
            ])
            ->assertRedirect(route('products.index'));

        $fresh = $product->fresh();
        $this->assertSame('approved', $fresh->publish_status);
        $this->assertSame('Nama Asli', $fresh->title);

        $rename = ProductRenameRequest::query()
            ->where('product_id', $product->id)
            ->where('status', 'pending')
            ->first();

        $this->assertNotNull($rename);
        $this->assertSame('Nama Asli', $rename->old_title);
        $this->assertSame('Nama Baru', $rename->requested_title);
        $this->assertSame($tenantUser->id, $rename->requested_by);
    }

    public function test_owner_can_approve_rename_request(): void
    {
        $owner = $this->createMainOutletOwner();
        [$tenantUser, $tenantOutlet] = $this->createTenantEditor();
        $product = $this->createApprovedProduct($tenantOutlet->id, 'Nama Asli');
        $rename = ProductRenameRequest::create([
            'product_id' => $product->id,
            'old_title' => 'Nama Asli',
            'requested_title' => 'Nama Baru',
            'status' => 'pending',
            'requested_by' => $tenantUser->id,
        ]);

        $this->session(['auth.password_confirmed_at' => time()]);

        $this->actingAs($owner)
            ->patch(route('products.rename.approve', $rename->id))
            ->assertRedirect();

        $this->assertSame('Nama Baru', $product->fresh()->title);
        $this->assertSame('approved', $rename->fresh()->status);
        $this->assertSame($owner->id, $rename->fresh()->reviewed_by);
        $this->assertNotNull($rename->fresh()->reviewed_at);
    }

    public function test_owner_reject_rename_request_keeps_old_title(): void
    {
        $owner = $this->createMainOutletOwner();
        [$tenantUser, $tenantOutlet] = $this->createTenantEditor();
        $product = $this->createApprovedProduct($tenantOutlet->id, 'Nama Asli');
        $rename = ProductRenameRequest::create([
            'product_id' => $product->id,
            'old_title' => 'Nama Asli',
            'requested_title' => 'Nama Baru',
            'status' => 'pending',
            'requested_by' => $tenantUser->id,
        ]);

        $this->session(['auth.password_confirmed_at' => time()]);

        $this->actingAs($owner)
            ->patch(route('products.rename.reject', $rename->id), ['review_note' => 'Terlalu mirip produk lain'])
            ->assertRedirect();

        $this->assertSame('Nama Asli', $product->fresh()->title);
        $this->assertSame('approved', $product->fresh()->publish_status);
        $this->assertSame('rejected', $rename->fresh()->status);
        $this->assertSame('Terlalu mirip produk lain', $rename->fresh()->review_note);
    }

    public function test_tenant_reverting_name_cancels_pending_rename_request(): void
    {
        [$tenantUser, $tenantOutlet] = $this->createTenantEditor();
        $product = $this->createApprovedProduct($tenantOutlet->id, 'Nama Asli');
        ProductRenameRequest::create([
            'product_id' => $product->id,
            'old_title' => 'Nama Asli',
            'requested_title' => 'Nama Baru',
            'status' => 'pending',
            'requested_by' => $tenantUser->id,
        ]);

        $this->actingAs($tenantUser)
            ->put(route('products.update', $product->id), [
                'title' => 'Nama Asli',
                'description' => $product->description,
                'category_id' => $product->category_id,
                'tenant_outlet_id' => $tenantOutlet->id,
                'buy_price' => $product->buy_price,
                'sell_price' => $product->sell_price,
                'tenant_hpp_price' => $product->tenant_hpp_price,
            ])
            ->assertRedirect(route('products.index'));

        $this->assertSame('approved', $product->fresh()->publish_status);
        $this->assertNull(
            ProductRenameRequest::query()
                ->where('product_id', $product->id)
                ->where('status', 'pending')
                ->first()
        );
    }

    public function test_tenant_price_only_change_keeps_approved_product_approved(): void
    {
        [$tenantUser, $tenantOutlet] = $this->createTenantEditor();
        $product = $this->createApprovedProduct($tenantOutlet->id, 'Nama Tetap');

        $this->actingAs($tenantUser)
            ->put(route('products.update', $product->id), [
                'title' => 'Nama Tetap',
                'description' => $product->description,
                'category_id' => $product->category_id,
                'tenant_outlet_id' => $tenantOutlet->id,
                'buy_price' => 18000,
                'sell_price' => 28000,
                'tenant_hpp_price' => 18000,
            ])
            ->assertRedirect(route('products.index'));

        $fresh = $product->fresh();
        $this->assertSame('approved', $fresh->publish_status);
        $this->assertSame(18000, (int) $fresh->buy_price);
        $this->assertSame('Nama Tetap', $fresh->title);
    }

    public function test_review_queue_lists_pending_rename_requests_scoped_by_tenant(): void
    {
        [$tenantUser, $tenantOutlet] = $this->createTenantUser();
        $product = $this->createApprovedProduct($tenantOutlet->id, 'Nama Produk');
        $rename = ProductRenameRequest::create([
            'product_id' => $product->id,
            'old_title' => 'Nama Produk',
            'requested_title' => 'Nama Baru',
            'status' => 'pending',
            'requested_by' => $tenantUser->id,
        ]);

        $otherOutlet = Outlet::create([
            'code' => 'TNT9-'.Str::upper(Str::random(4)),
            'slug' => 'tenant-lain-'.Str::lower(Str::random(8)),
            'name' => 'Tenant Lain',
            'outlet_type' => 'tenant',
            'is_active' => true,
            'is_default' => false,
        ]);
        $otherProduct = $this->createApprovedProduct($otherOutlet->id, 'Produk Lain');
        ProductRenameRequest::create([
            'product_id' => $otherProduct->id,
            'old_title' => 'Produk Lain',
            'requested_title' => 'Produk Lain Baru',
            'status' => 'pending',
            'requested_by' => $tenantUser->id,
        ]);

        $this->actingAs($tenantUser)
            ->get(route('products.review'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Products/Review')
                ->where('pendingRenames.data', fn ($rows) => count($rows) === 1
                    && (int) $rows[0]['id'] === (int) $rename->id
                    && $rows[0]['requested_title'] === 'Nama Baru'));
    }

    private function createApprovedProduct(?int $tenantOutletId, string $title): Product
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
            'description' => 'Produk approved',
            'tenant_hpp_price' => 15000,
            'buy_price' => 15000,
            'sell_price' => 25000,
            'stock' => 5,
            'publish_status' => 'approved',
            'published_at' => now(),
        ]);
    }

    /**
     * @return array{0: User, 1: Outlet}
     */
    private function createTenantEditor(): array
    {
        $outlet = Outlet::create([
            'code' => 'TNT-'.Str::upper(Str::random(4)),
            'slug' => 'tenant-'.Str::lower(Str::random(8)),
            'name' => 'Tenant Editor',
            'outlet_type' => 'tenant',
            'is_active' => true,
            'is_default' => false,
        ]);

        $user = User::factory()->create();
        $user->givePermissionTo(['products-access', 'products-edit', 'products-pricing-update']);
        $user->outlets()->attach($outlet->id, ['is_primary' => true]);

        return [$user, $outlet];
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
