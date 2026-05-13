# Table Order QR

Kembali ke indeks dokumentasi: `docs/README.md`

## Tujuan

Fitur ini memungkinkan pembeli scan QR meja, memilih menu dari perangkat sendiri, lalu checkout tanpa menunggu kasir membangun cart.

## Alur Tunai

1. pembeli scan QR meja
2. pembeli pilih menu dan checkout
3. sistem membuat `table_order` dengan status `pending_cashier_payment`
4. pembeli menuju kasir untuk bayar tunai
5. kasir approve pembayaran pada dashboard `Pesanan QR Meja`
6. sistem membentuk `Transaction` tunai yang sudah `paid`
7. setelah approval kasir, pesanan baru diteruskan ke dapur melalui `kitchen_tickets`

## Route Penting

- public:
  - `/order/table/{qrToken}`
  - `/order/status/{accessToken}`
- dashboard:
  - `/dashboard/table-orders`

## Boundary

- self-order publik tidak langsung menjadi `Transaction`
- source of truth order awal ada di `table_orders` dan `table_order_items`
- approval kasir adalah titik transisi ke `transactions`
- untuk flow awal ini, metode pembayaran yang didukung adalah `cash`
