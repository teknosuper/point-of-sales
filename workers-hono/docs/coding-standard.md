# Coding Standard

Kembali ke indeks dokumentasi: `docs/README.md`

Dokumen ini adalah coding standard untuk versi `POINZA Cloudflare Workers + Hono`. Isinya melanjutkan prinsip repo utama, tetapi disesuaikan untuk:

- Hono route modules,
- runtime edge stateless,
- data access via Cloudflare bindings,
- multi outlet sebagai constraint inti,
- kitchen routing per station sebagai workflow inti POS.

## Prinsip Umum

- Perlakukan proyek ini sebagai sistem operasional bisnis, bukan CRUD API biasa.
- Setiap perubahan yang menyentuh uang, stok, hutang, piutang, shift, outlet scope, kitchen routing, atau akses harus dianggap high-risk.
- Optimalkan konsistensi domain dan outlet isolation lebih dulu, baru kecepatan implementasi.
- Jangan memindahkan pola Laravel lama mentah-mentah jika tidak cocok untuk Workers.

## Standard Arsitektur

1. Route module adalah boundary HTTP, bukan tempat business logic utama.
2. Service adalah boundary workflow bisnis.
3. Repository adalah boundary akses data.
4. Middleware shared menangani auth, active outlet, correlation id, dan request context.
5. Jangan gabungkan outlet resolution dengan logic bisnis modul secara ad hoc.
6. Semua modul operasional harus outlet-aware sejak awal.
7. Routing item ke kitchen station harus diperlakukan sebagai workflow domain resmi, bukan side effect UI.

## Standard Routing dan Handler

1. Gunakan satu route file per modul, misalnya `src/modules/transactions/routes.ts`.
2. Handler harus tipis: parse input, panggil service, serialize output.
3. Jangan tulis query SQL langsung di handler.
4. Semua response JSON harus stabil bentuknya.
5. Route sensitif wajib melalui auth guard dan outlet access guard.
6. Gunakan idempotency key bila endpoint bisa diretry oleh client atau webhook.
7. Endpoint kitchen display atau printer dispatch harus punya contract status yang eksplisit.

## Standard Validation

1. Semua input request harus divalidasi sebelum masuk ke service.
2. Validasi harus mencakup `outlet_id` atau active outlet context bila relevan.
3. Jangan mengandalkan validasi UI sebagai satu-satunya proteksi.
4. Enum status, payment method, dan mutation type harus dibatasi eksplisit.
5. Jika product butuh proses dapur, mapping ke `station_id` harus tervalidasi.

## Standard Service Layer

1. Service menangani workflow lintas repository.
2. Service tidak boleh tahu detail Hono context kecuali melalui parameter terstruktur.
3. Gunakan service untuk:
   - checkout
   - shift open/close
   - stock opname finalize
   - mutation creation
   - payment reconciliation
   - receivable/payable lifecycle
   - campaign processing
   - kitchen ticket dispatch
   - kitchen ticket acknowledgement
4. Jika workflow menyentuh banyak aggregate, service wajib menjelaskan urutan side effect dengan jelas.
5. Checkout service harus memutuskan dengan deterministik item mana masuk ke station mana.

## Standard Repository Layer

1. Repository hanya berisi akses data dan mapping record.
2. Query harus selalu mempertimbangkan outlet scope bila aggregate outlet-bound.
3. Jangan buat helper query lintas outlet kecuali memang route konsolidasi khusus.
4. Gunakan nama method yang menjelaskan intent domain, bukan nama SQL generik.
5. Query report berat harus dipisah dari query operasional transaksi harian.
6. Repository kitchen harus bisa mengambil ticket per station tanpa membaca ticket station lain.

## Standard Multi Outlet

1. Semua aggregate operasional wajib punya outlet boundary eksplisit.
2. Jangan pakai default outlet tersembunyi di service.
3. `activeOutletId` harus datang dari context yang tervalidasi.
4. Jika sebuah entity global, jelaskan itu di schema dan repository.
5. Cross-outlet action harus jarang dan eksplisit.
6. Transfer antar outlet harus diperlakukan sebagai workflow resmi, bukan update stok langsung.
7. Test untuk outlet isolation wajib ada pada setiap modul outlet-bound.

## Standard Kitchen Routing

1. Setiap product yang butuh proses dapur harus punya station mapping yang jelas.
2. Jangan hardcode nama dapur di frontend atau handler POS.
3. Gunakan master `kitchen_stations` dan mapping product-to-station.
4. Satu transaksi boleh menghasilkan banyak kitchen ticket.
5. Satu kitchen ticket hanya boleh memuat item dari satu station.
6. Delivery ke printer atau layar harus berdasarkan device aktif milik station pada outlet aktif.
7. Retry print atau resend display tidak boleh membuat ticket baru bila tidak diperlukan.
8. Event kitchen minimal harus punya state `pending_dispatch`, `dispatched`, `acknowledged`, `ready`.
9. Test wajib membuktikan station yang tidak punya item tidak menerima ticket.

## Standard Auth dan Access

1. Auth harus menghasilkan identity + memberships + permissions.
2. Permission check harus mempertimbangkan outlet scope jika role bersifat per outlet.
3. Aksi sensitif wajib punya jalur step-up auth bila diperlukan.
4. Jangan percaya payload client untuk outlet access tanpa verifikasi membership.

## Standard Error Handling

1. Error domain harus dibedakan dari error infrastructure.
2. Jangan bocorkan detail internal database ke response publik.
3. Gunakan error code atau message yang bisa ditindaklanjuti oleh client.
4. Error yang terkait outlet mismatch harus dibedakan dari forbidden umum.

## Standard Audit dan Observability

1. Event penting wajib membentuk audit log.
2. Audit log minimal memuat:
   - event
   - module
   - user_id
   - outlet_id bila relevan
   - target reference
   - before/after jika masuk akal
   - correlation_id
3. Payment, stock, finance, dan privileged action wajib punya jejak audit.
4. Request log dan audit log jangan dicampur menjadi satu konsep.
5. Kitchen dispatch, print attempt, device failure, dan station acknowledgement wajib bisa diaudit.

## Standard Data

1. Nilai uang, stok, qty, poin, dan diskon disimpan sebagai integer.
2. Status workflow harus eksplisit dan terbatas.
3. Gunakan UTC untuk storage waktu; formatting lokal dilakukan di layer presentasi.
4. Public identifier seperti invoice number harus stabil dan unik.
5. Jangan jadikan display text sebagai sumber state bisnis.
6. Kitchen ticket number harus stabil per station dan transaction reference.

## Standard Integrasi Cloudflare

1. D1 untuk relational source of truth, bukan cache sementara.
2. KV hanya untuk cache atau lookup ringan, bukan transaksi finansial utama.
3. R2 untuk file, image, atau dokumen turunan.
4. Durable Objects dipakai hanya jika memang butuh coordination state atau lock semantics.
5. Env binding harus dibungkus adapter, jangan dipanggil sembarangan di semua modul.
6. Jika kitchen display butuh feed real-time per station, pertimbangkan Durable Objects hanya bila polling biasa tidak cukup.

## Standard Testing

1. Setiap modul baru minimal punya test happy path.
2. Tambahkan test authorization dan outlet isolation.
3. Tambahkan test side effect untuk stok, profit, receivable, payable, loyalty point, atau audit log bila relevan.
4. Tambahkan test idempotency untuk webhook, campaign share, dan operasi retryable.
5. Tambahkan regression test untuk bug sebelum atau bersamaan dengan fix.
6. Tambahkan test kitchen routing untuk memastikan item hanya masuk ke station yang benar.

## Standard Dokumentasi

1. Jika modul baru menambah boundary sistem, perbarui `docs/system-map.md`.
2. Jika aturan implementasi berubah, perbarui `docs/coding-standard.md`.
3. Jika desain multi outlet berubah, dokumentasikan dampaknya terhadap aggregate lain.

## Naming Rules

1. Gunakan nama modul berbasis domain bisnis, bukan sekadar teknis.
2. Gunakan `outlet`, bukan campuran `store`, `branch`, dan `shop` tanpa alasan kuat.
3. Gunakan `transaction`, `receivable`, `payable`, `mutation`, `campaign` secara konsisten.
4. Nama method service harus menjelaskan aksi domain, misalnya `finalizeStockOpname`, bukan `processData`.
5. Gunakan `station`, `kitchenTicket`, dan `device` secara konsisten untuk modul dapur.

## Definition of Done

Sebuah perubahan dianggap layak merge jika:

1. route dan contract jelas,
2. validation ada,
3. service dan repository boundary rapi,
4. outlet isolation aman,
5. auditability dipertimbangkan,
6. test penting tersedia,
7. kitchen routing benar bila perubahan menyentuh transaksi, produk, atau station mapping,
8. dokumentasi tetap sinkron.
