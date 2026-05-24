<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PublicApiDocsController extends Controller
{
    public function __invoke(Request $request): View|JsonResponse
    {
        $docs = [
            'title' => 'Public Catalog API',
            'version' => '1.0',
            'base_url' => url('/api/public/catalog'),
            'docs_url' => url('/api/public/docs'),
            'authentication' => [
                'required' => false,
                'type' => 'none',
                'notes' => 'Endpoint public ini tidak membutuhkan login atau bearer token.',
            ],
            'cors' => [
                'enabled' => true,
                'allow_origin' => '*',
                'allow_methods' => ['GET', 'OPTIONS'],
            ],
            'outlet_resolution' => [
                'supported_query' => ['outlet_id', 'outlet_code', 'outlet_slug'],
                'fallback' => 'Jika query outlet tidak dikirim, sistem memakai outlet default aktif.',
            ],
            'stock_resolution' => [
                'primary' => 'product_outlet_stocks',
                'fallback' => 'products.stock',
            ],
            'endpoints' => [
                [
                    'name' => 'API Docs',
                    'method' => 'GET',
                    'path' => '/api/public/docs',
                    'description' => 'Dokumentasi endpoint public API. Tambahkan `?format=json` untuk format JSON.',
                    'query' => [
                        ['name' => 'format', 'type' => 'string', 'required' => false, 'description' => 'Gunakan `json` untuk menerima dokumentasi dalam JSON.'],
                    ],
                ],
                [
                    'name' => 'Catalog Meta',
                    'method' => 'GET',
                    'path' => '/api/public/catalog/meta',
                    'description' => 'Mengambil informasi outlet aktif, kategori, ringkasan promo, dan daftar filter yang didukung.',
                    'query' => $this->outletQueryDocs(),
                    'example' => '/api/public/catalog/meta?outlet_code=MAIN',
                ],
                [
                    'name' => 'Product List',
                    'method' => 'GET',
                    'path' => '/api/public/catalog/products',
                    'description' => 'Mengambil daftar produk publik dengan harga efektif, badge promo, stok, kategori, tenant outlet, modifier, dan kitchen station.',
                    'query' => array_merge($this->outletQueryDocs(), [
                        ['name' => 'search', 'type' => 'string', 'required' => false, 'description' => 'Cari berdasarkan title, sku, atau barcode.'],
                        ['name' => 'category_id', 'type' => 'integer', 'required' => false, 'description' => 'Filter berdasarkan kategori.'],
                        ['name' => 'promo_only', 'type' => 'boolean', 'required' => false, 'description' => 'Jika `1`, hanya mengembalikan produk yang sedang punya promo.'],
                        ['name' => 'include_out_of_stock', 'type' => 'boolean', 'required' => false, 'description' => 'Jika `1`, produk stok 0 tetap ikut tampil.'],
                        ['name' => 'sort', 'type' => 'string', 'required' => false, 'description' => 'Nilai: `title`, `price_low`, `price_high`, `latest`, `promo_first`.'],
                        ['name' => 'per_page', 'type' => 'integer', 'required' => false, 'description' => 'Default 24, maksimum 100.'],
                        ['name' => 'page', 'type' => 'integer', 'required' => false, 'description' => 'Nomor halaman pagination.'],
                    ]),
                    'example' => '/api/public/catalog/products?outlet_code=MAIN&promo_only=1&sort=promo_first&per_page=12&page=1',
                ],
                [
                    'name' => 'Product Detail',
                    'method' => 'GET',
                    'path' => '/api/public/catalog/products/{product}',
                    'description' => 'Mengambil detail satu produk publik, termasuk harga efektif dan badge promo pada outlet yang dipilih.',
                    'query' => $this->outletQueryDocs(),
                    'example' => '/api/public/catalog/products/123?outlet_code=MAIN',
                ],
                [
                    'name' => 'Promo Rules',
                    'method' => 'GET',
                    'path' => '/api/public/catalog/promos',
                    'description' => 'Mengambil semua pricing rule aktif yang aman diekspos ke aplikasi publik, lengkap dengan data visual untuk render dinamis seperti buy/get items, bundle items, product image, dan headline promo.',
                    'query' => array_merge($this->outletQueryDocs(), [
                        ['name' => 'kind', 'type' => 'string', 'required' => false, 'description' => 'Filter jenis promo: `standard_discount`, `qty_break`, `bundle_price`, `buy_x_get_y`.'],
                        ['name' => 'target_type', 'type' => 'string', 'required' => false, 'description' => 'Filter target promo: `all`, `product`, `category`.'],
                    ]),
                    'example' => '/api/public/catalog/promos?outlet_code=MAIN&kind=buy_x_get_y',
                ],
                [
                    'name' => 'Promo Banners',
                    'method' => 'GET',
                    'path' => '/api/public/catalog/promo-banners',
                    'description' => 'Mengambil daftar banner promo siap render untuk hero slider atau banner section.',
                    'query' => array_merge($this->outletQueryDocs(), [
                        ['name' => 'kind', 'type' => 'string', 'required' => false, 'description' => 'Filter jenis promo.'],
                        ['name' => 'limit', 'type' => 'integer', 'required' => false, 'description' => 'Default 6, maksimum 20.'],
                    ]),
                    'example' => '/api/public/catalog/promo-banners?outlet_code=MAIN&limit=5',
                ],
                [
                    'name' => 'Home Sections',
                    'method' => 'GET',
                    'path' => '/api/public/catalog/home-sections',
                    'description' => 'Mengambil section homepage siap render: hero banners, featured promos, bundle promos, buy-get promos, qty break promos, promo products, new arrivals, dan low stock.',
                    'query' => array_merge($this->outletQueryDocs(), [
                        ['name' => 'kind', 'type' => 'string', 'required' => false, 'description' => 'Opsional, batasi promo section ke jenis tertentu.'],
                        ['name' => 'featured_limit', 'type' => 'integer', 'required' => false, 'description' => 'Default 6.'],
                        ['name' => 'promo_product_limit', 'type' => 'integer', 'required' => false, 'description' => 'Default 8.'],
                        ['name' => 'new_limit', 'type' => 'integer', 'required' => false, 'description' => 'Default 8.'],
                        ['name' => 'low_stock_limit', 'type' => 'integer', 'required' => false, 'description' => 'Default 8.'],
                    ]),
                    'example' => '/api/public/catalog/home-sections?outlet_code=MAIN',
                ],
                [
                    'name' => 'Highlights',
                    'method' => 'GET',
                    'path' => '/api/public/catalog/highlights',
                    'description' => 'Mengambil highlight produk promo dan produk low stock.',
                    'query' => array_merge($this->outletQueryDocs(), [
                        ['name' => 'promo_limit', 'type' => 'integer', 'required' => false, 'description' => 'Default 8, maksimum 20.'],
                        ['name' => 'low_stock_limit', 'type' => 'integer', 'required' => false, 'description' => 'Default 8, maksimum 20.'],
                    ]),
                    'example' => '/api/public/catalog/highlights?outlet_code=MAIN&promo_limit=6',
                ],
            ],
            'promo_rule_types' => [
                ['key' => 'standard_discount', 'description' => 'Diskon langsung per produk atau kategori.'],
                ['key' => 'qty_break', 'description' => 'Harga atau diskon khusus jika jumlah beli mencapai threshold tertentu.'],
                ['key' => 'bundle_price', 'description' => 'Harga paket tetap untuk kombinasi beberapa produk.'],
                ['key' => 'buy_x_get_y', 'description' => 'Beli item tertentu dan dapat item reward/gratis.'],
            ],
            'response_notes' => [
                'Semua nominal harga dikirim sebagai integer.',
                'Produk publik menyertakan `effective_price` dan `pricing_badge` bila promo aktif.',
                'Promo kompleks seperti bundle dan buy-x-get-y muncul detailnya di endpoint `/promos`.',
                'Pagination hanya ada pada endpoint `/products`.',
            ],
            'examples' => [
                'fetch_products' => "fetch('".url('/api/public/catalog/products?outlet_code=MAIN&promo_only=1')."').then(r => r.json())",
                'fetch_promos' => "fetch('".url('/api/public/catalog/promos?outlet_code=MAIN')."').then(r => r.json())",
                'fetch_highlights' => "fetch('".url('/api/public/catalog/highlights?outlet_code=MAIN')."').then(r => r.json())",
            ],
            'sample_shapes' => [
                'product' => [
                    'id' => 123,
                    'title' => 'Es Kopi Susu',
                    'sell_price' => 28000,
                    'effective_price' => 20000,
                    'stock' => 9,
                    'category' => ['id' => 4, 'name' => 'Minuman'],
                    'pricing_badge' => [
                        'id' => 91,
                        'name' => 'Promo Kopi Pagi',
                        'kind' => 'standard_discount',
                        'label' => 'Harga Rp 20.000',
                        'promo_price' => 20000,
                        'base_price' => 28000,
                    ],
                ],
                'promo' => [
                    'id' => 91,
                    'name' => 'Promo Kopi Pagi',
                    'kind' => 'standard_discount',
                    'priority' => 300,
                    'status_label' => 'Active',
                    'target_type' => 'product',
                    'discount_type' => 'fixed_price',
                    'discount_value' => 20000,
                    'badge' => ['text' => 'Promo', 'tone' => 'danger'],
                    'theme' => ['key' => 'rose'],
                    'visual' => [
                        'type' => 'standard_discount',
                        'headline' => 'Promo Kopi Pagi',
                        'subheadline' => 'Es Kopi Susu',
                        'pill' => 'Promo',
                    ],
                    'cta' => ['label' => 'Lihat Promo', 'path' => '/promos/91'],
                    'hero_image' => 'https://example.com/storage/products/kopi.jpg',
                    'highlight_products' => [],
                ],
            ],
        ];

        if ($request->expectsJson() || $request->string('format')->toString() === 'json') {
            return response()->json(['data' => $docs]);
        }

        return view('api.public-docs', ['docs' => $docs]);
    }

    private function outletQueryDocs(): array
    {
        return [
            ['name' => 'outlet_id', 'type' => 'integer', 'required' => false, 'description' => 'Pilih outlet berdasarkan ID.'],
            ['name' => 'outlet_code', 'type' => 'string', 'required' => false, 'description' => 'Pilih outlet berdasarkan kode outlet.'],
            ['name' => 'outlet_slug', 'type' => 'string', 'required' => false, 'description' => 'Pilih outlet berdasarkan slug outlet.'],
        ];
    }
}
