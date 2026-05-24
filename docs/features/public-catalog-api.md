# Public Catalog API

API publik tanpa auth untuk dipakai dari aplikasi lain seperti Cloudflare Pages. Fokus endpoint ini adalah katalog produk, promo aktif, dan highlight produk promo.

Base path:

```text
/api/public/catalog
```

## Catatan

- endpoint ini tidak memakai auth
- CORS dibuka untuk `GET` dan `OPTIONS`
- default outlet diambil dari outlet aktif default jika query outlet tidak dikirim
- stok akan membaca `product_outlet_stocks` jika tabel tersedia; fallback ke `products.stock`

## Pilih Outlet

Semua endpoint mendukung salah satu query berikut:

- `outlet_id=1`
- `outlet_code=MAIN`
- `outlet_slug=main-store`

## 1. Meta

```http
GET /api/public/catalog/meta?outlet_code=MAIN
```

Untuk mengambil info outlet, kategori, dan ringkasan promo aktif.

## 2. Products

```http
GET /api/public/catalog/products?outlet_code=MAIN&search=kopi&category_id=2&promo_only=1&sort=promo_first&per_page=12&page=1
```

Query yang didukung:

- `search`
- `category_id`
- `promo_only=1`
- `include_out_of_stock=1`
- `sort=title|price_low|price_high|latest|promo_first`
- `per_page`
- `page`

Response utama:

- `data[]`
- `meta`
- `filters`
- `context.outlet`

Field produk penting:

- `id`, `title`, `description`, `image`
- `barcode`, `sku`
- `sell_price`, `buy_price`, `effective_price`
- `stock`
- `category`
- `tenant_outlet`
- `modifier_options`
- `kitchen_stations`
- `pricing_badge`

## 3. Product Detail

```http
GET /api/public/catalog/products/123?outlet_code=MAIN
```

Mengambil detail satu produk beserta harga efektif dan badge promo.

## 4. Promos

```http
GET /api/public/catalog/promos?outlet_code=MAIN
```

Mengambil seluruh pricing rule aktif yang bisa diekspos ke frontend publik.

Jenis promo yang ikut keluar:

- `standard_discount`
- `qty_break`
- `bundle_price`
- `buy_x_get_y`

Field promo penting:

- `id`, `name`, `kind`, `priority`
- `status`, `status_label`
- `target_type`, `customer_scope`
- `discount_type`, `discount_value`
- `starts_at`, `ends_at`
- `schedule`
- `active_days`, `daily_start_time`, `daily_end_time`
- `qty_breaks`
- `bundle_items`
- `buy_get_items`
- `buy_items`
- `get_items`
- `visual`
- `badge`
- `theme`
- `cta`
- `hero_image`
- `hero_product`
- `catalog`
- `highlight_products`

Query tambahan:

- `kind=standard_discount|qty_break|bundle_price|buy_x_get_y`
- `target_type=all|product|category`

Field `visual` dipakai agar client bisa render promo card dinamis tanpa logika tambahan besar di frontend.

Contoh:

- promo standar:
  - `visual.type = standard_discount`
  - `visual.target_product`
- qty break:
  - `visual.type = qty_break`
  - `visual.display_discount[]`
- bundle:
  - `visual.type = bundle`
  - `visual.bundle_items[]`
  - `visual.display_price`
- buy x get y:
  - `visual.type = buy_get`
  - `visual.buy_items[]`
  - `visual.get_items[]`

Setiap item produk promo sekarang membawa data visual minimum:

- `id`
- `title`
- `image`
- `sell_price`
- `buy_price`
- `stock`

Field tambahan untuk HTML client:

- `badge.text`
- `badge.tone`
- `theme.key`
- `theme.background`
- `theme.text`
- `visual.headline`
- `visual.subheadline`
- `visual.pill`
- `cta.label`
- `cta.path`
- `catalog.supports_grid_card`
- `catalog.supports_hero_banner`
- `catalog.supports_carousel`

Endpoint `/promos` juga sekarang mengembalikan:

- `meta.counts_by_kind`
- `groups.standard_discount`
- `groups.qty_break`
- `groups.bundle_price`
- `groups.buy_x_get_y`

Ini memudahkan client untuk langsung merender section HTML terpisah tanpa regrouping manual.

## 5. Highlights

```http
GET /api/public/catalog/highlights?outlet_code=MAIN
```

Response:

- `data.promo_products`
- `data.low_stock_products`

Query opsional:

- `promo_limit`
- `low_stock_limit`

## 6. Promo Banners

```http
GET /api/public/catalog/promo-banners?outlet_code=MAIN&limit=5
```

Endpoint ini khusus untuk hero slider atau banner promo.

Field penting:

- `headline`
- `subheadline`
- `badge`
- `theme`
- `hero_image`
- `hero_product`
- `cta`
- `schedule`
- `highlight_products`

## 7. Home Sections

```http
GET /api/public/catalog/home-sections?outlet_code=MAIN
```

Endpoint ini mengembalikan section homepage yang sudah terstruktur agar client tidak perlu menyusun ulang sendiri.

Section utama:

- `hero_banners`
- `featured_promos`
- `bundle_promos`
- `buy_get_promos`
- `qty_break_promos`
- `promo_products`
- `new_arrivals`
- `low_stock_products`

Query opsional:

- `kind`
- `featured_limit`
- `promo_product_limit`
- `new_limit`
- `low_stock_limit`

Field ini cocok untuk:

- hero banner
- promo card grid
- bundle carousel
- buy-get slider
- section produk promo
- section produk baru
- section stok menipis

## Contoh Fetch dari Cloudflare Pages

```js
const res = await fetch('https://your-api-domain.com/api/public/catalog/products?outlet_code=MAIN&promo_only=1');
const json = await res.json();
console.log(json.data);
```
