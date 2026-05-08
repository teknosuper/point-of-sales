# Printing Architecture Options

Kembali ke indeks dokumentasi: `docs/README.md`

Dokumen ini merangkum beberapa versi arsitektur printing agar aplikasi POS tetap fleksibel untuk:

- laptop / desktop browser,
- tablet browser,
- smartphone browser,
- kitchen display,
- foodcourt multi tenant,
- printer thermal cashier dan printer dapur.

## Prinsip Dasar

Karena aplikasi ini web-based, browser biasa tidak ideal untuk direct silent print ke thermal printer tanpa bantuan tambahan. Maka desain printing sebaiknya dipisah menjadi:

1. `UI / Web App`
2. `Print Job / Queue`
3. `Print Executor`

Dengan begitu, kasir dan kitchen bisa tetap memakai browser, tetapi cara cetaknya bisa dipilih sesuai kebutuhan outlet.

## Opsi 1: Browser Manual Print

### Cocok untuk

- demo
- toko kecil 1 printer
- kebutuhan awal sebelum ada integrasi device

### Flow

1. user checkout transaksi
2. sistem membuka halaman invoice / receipt
3. user klik `Print`
4. browser menampilkan print dialog
5. user memilih printer thermal

### Kelebihan

- paling cepat dibuat
- tidak perlu service tambahan
- bisa langsung dipakai di laptop

### Kekurangan

- tetap perlu klik manual
- rawan salah printer
- tidak cocok untuk multi kitchen station
- tidak cocok untuk operasional cepat foodcourt
- di tablet/smartphone hasil print sering tidak stabil

## Opsi 2: Browser Kiosk / Silent Print Device

### Cocok untuk

- device khusus kasir
- desktop Chrome/Edge yang dikunci untuk operasional

### Flow

1. device kasir menjalankan browser mode kiosk
2. print dilakukan dari web
3. dialog print dikurangi atau dilewati sesuai setup OS/browser

### Kelebihan

- lebih cepat dari print manual
- cocok untuk receipt printer tunggal

### Kekurangan

- setup per device
- sulit untuk tablet/smartphone
- tetap tidak ideal untuk foodcourt multi printer
- tidak fleksibel untuk retry, queue, dan failover

## Opsi 3: Local Print Bridge

### Cocok untuk

- POS production
- cashier receipt printer
- kitchen printer per station
- multi outlet / foodcourt

### Flow

1. Laravel membuat `print job`
2. browser/operator memilih device atau device default
3. job dikirim ke `print bridge`
4. print bridge menerjemahkan job ke ESC/POS atau driver printer
5. printer mencetak
6. bridge mengembalikan status `queued / success / failed`

### Bentuk Print Bridge

- app Node.js lokal
- service Python lokal
- Electron helper
- mini service di PC kasir
- mini PC / Raspberry Pi di jaringan lokal

### Kelebihan

- paling cocok untuk thermal printer nyata
- bisa auto print tanpa dialog browser
- bisa multi printer
- bisa retry
- bisa audit queue
- cocok untuk tablet/smartphone karena yang cetak bukan browsernya

### Kekurangan

- perlu install service tambahan
- perlu manajemen device dan koneksi jaringan

## Opsi 4: Server Queue + Local Bridge

### Cocok untuk

- foodcourt
- banyak dapur
- banyak tenant
- perlu antrian print yang dapat diaudit

### Flow

1. checkout menghasilkan `kitchen tickets`
2. Laravel membuat `print queue records`
3. local bridge per outlet / per station melakukan polling queue
4. job dicetak ke printer terkait
5. bridge update status ke Laravel

### Kelebihan

- paling rapi untuk multi tenant
- cocok untuk kitchen printer per dapur
- status queue bisa terlihat di dashboard
- retry dan dead-letter lebih mudah

### Kekurangan

- lebih kompleks
- butuh endpoint queue/polling/acknowledgement

## Opsi 5: Mobile / Tablet as UI, Printer via Network Bridge

### Cocok untuk

- kasir pakai tablet
- kitchen pakai tablet display
- printer thermal ada di jaringan lokal

### Flow

1. tablet membuka aplikasi web
2. transaksi tetap diproses di Laravel
3. Laravel mengirim job ke print bridge jaringan lokal
4. bridge mencetak ke printer cashier/kitchen

### Kelebihan

- UI tetap fleksibel di tablet/smartphone
- printing tidak tergantung kemampuan browser mobile
- paling realistis untuk deployment campuran device

### Kekurangan

- perlu bridge lokal
- tablet tidak benar-benar mencetak sendiri

## Opsi 6: Native Companion App

### Cocok untuk

- Android POS dedicated
- device yang harus terhubung ke Bluetooth printer

### Flow

1. web app atau API backend dipakai sebagai sumber data
2. companion app native menerima print payload
3. app memanggil SDK printer
4. printer mencetak

### Kelebihan

- paling kuat untuk Bluetooth/mobile printing
- bisa akses fitur hardware lebih banyak

### Kekurangan

- biaya development lebih besar
- maintenance lebih berat
- tidak sesederhana browser-only

## Rekomendasi Per Skenario

### Skenario A: Toko kecil, 1 kasir, 1 printer

Rekomendasi:

- mulai dari `Opsi 1`
- naik ke `Opsi 2` jika mau lebih cepat

### Skenario B: Toko menengah, laptop kasir, receipt printer thermal

Rekomendasi:

- `Opsi 3`

### Skenario C: Kasir pakai tablet, kitchen pakai tablet, printer ada di dapur

Rekomendasi:

- `Opsi 5`

Tambahan praktis:

- jika tablet atau HP Android dipakai kasir dan printer thermal memakai Bluetooth, gunakan profile `Android RawBT`
- browser Android tetap menjadi UI
- proses thermal print diserahkan ke aplikasi RawBT
- cocok untuk outlet kecil atau mobile cashier

### Skenario D: Foodcourt multi tenant, 1 kasir, banyak kitchen printer

Rekomendasi:

- `Opsi 4`

### Skenario E: Mobile-first, printer Bluetooth, device Android dedicated

Rekomendasi:

- `Opsi 6`

Jika ingin biaya implementasi lebih ringan dari native app penuh:

- pakai browser Android + `RawBT`
- jadikan ini sebagai jembatan tahap awal sebelum companion app native

### Skenario F: Desktop browser atau mini PC kiosk

Rekomendasi:

- `QZ Tray Desktop`

Pola ini cocok bila:

- kasir memakai Windows/Linux/Mac
- printer thermal USB/LAN berada dekat device kasir
- ingin direct print dari browser tanpa dialog print standar

## Rekomendasi Untuk Repo Ini

Untuk sistem POINZA saat ini, jalur paling fleksibel adalah:

1. browser tetap menjadi UI utama
2. Laravel menjadi sumber event dan queue
3. kitchen receipt / tenant receipt memakai `print bridge`
4. tablet/smartphone dipakai untuk UI, bukan direct thermal print

Tambahan strategi fleksibel yang sekarang direkomendasikan:

- `Android RawBT` untuk browser Android + printer Bluetooth
- `QZ Tray Desktop` untuk browser desktop atau kiosk
- `Local Print Bridge` untuk foodcourt, multi kitchen, atau printer jaringan yang lebih kompleks

Jadi target arsitektur terbaik untuk repo ini adalah:

- cashier browser: laptop atau tablet
- kitchen display: browser tablet
- thermal printer: melalui local/network print bridge
- Laravel: sumber truth untuk queue, status, audit

## Milestone Implementasi Yang Disarankan

### Fase 1

- tetap pertahankan print manual
- stabilkan kitchen queue dan device metadata

### Fase 2

- tambah tabel / model `print_jobs`
- tambah endpoint enqueue print
- tambah status `queued / processing / success / failed`

### Fase 3

- buat local print bridge
- polling dari bridge ke Laravel
- tambahkan ack `success / failed` dari bridge
- cetak ESC/POS untuk cashier dan kitchen

### Fase 4

- retry policy
- printer health monitoring
- failure dashboard
- fallback printer

## Status Repo Saat Ini

Yang sudah ada:

- kitchen station
- kitchen device
- queue board
- status dispatch dasar
- queue/success/fail marker di kitchen printer mode
- `print_jobs` formal
- API `print bridge` untuk `health`, `pull`, `success`, dan `failed`

Yang belum ada:

- bridge lokal nyata
- ESC/POS formatter nyata
- health monitoring printer nyata

## Lihat Juga

- `docs/features/print-bridge-api.md`
