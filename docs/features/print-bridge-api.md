# Print Bridge API

Kembali ke indeks dokumentasi: `docs/README.md`

Dokumen ini menjelaskan kontrak API untuk `print bridge` lokal, yaitu service kecil yang berjalan di PC kasir, mini PC outlet, atau device jaringan lokal untuk mencetak thermal printer dari queue Laravel.

## Tujuan

`Print bridge` dipakai saat:

- kasir memakai browser laptop, tablet, atau smartphone,
- kitchen display memakai browser tablet,
- printer thermal harus mencetak otomatis tanpa dialog browser,
- antrian cetak perlu status `queued / processing / success / failed`.

Dokumen ini fokus pada `Local Print Bridge`, tetapi repo sekarang juga sudah menyiapkan `print profile` device agar satu sistem bisa memakai beberapa jalur:

- `browser_manual`
- `rawbt_android`
- `qz_tray`
- `local_bridge`

## Konfigurasi

Tambahkan token di `.env`:

```env
PRINT_BRIDGE_TOKEN=isi-token-rahasia-yang-panjang
```

Lalu reload config:

```bash
php artisan config:clear
php artisan config:cache
```

Semua request bridge harus mengirim header:

```http
X-Print-Bridge-Token: isi-token-rahasia-yang-panjang
```

## Konfigurasi Admin

Semua device printer sekarang bisa dikonfigurasi dari halaman admin:

- `Dashboard > Kitchen Ops & Printer`

Field yang bisa diubah tanpa edit kode:

- `Print Profile`
- `Connection Driver`
- `Endpoint / IP / Queue`
- `Dispatch Mode`
- `Fallback Device`
- `Paper Width`
- `Template Style`
- `Print Copies`
- `RawBT Intent URL`
- `QZ Printer Name`
- `Bridge Device Key`

Artinya satu outlet bisa:

- ganti printer Bluetooth Android ke device lain,
- ganti printer desktop yang dibaca QZ Tray,
- ganti bridge queue/device key,
- menonaktifkan printer lama,
- menjadikan device lain sebagai primary,

tanpa perlu ubah source code.

## Endpoint

### 1. Health Check

`GET /api/print-bridge/health`

Digunakan untuk memastikan Laravel menerima token bridge.

Contoh:

```bash
curl -X GET \
  http://localhost:8000/api/print-bridge/health \
  -H "X-Print-Bridge-Token: isi-token-rahasia-yang-panjang"
```

Response:

```json
{
  "status": "ok",
  "service": "print-bridge",
  "timestamp": "2026-05-08T10:00:00+07:00"
}
```

### 2. Pull Print Jobs

`POST /api/print-bridge/jobs/pull`

Bridge memanggil endpoint ini untuk mengambil antrian printer per device.

Request body:

```json
{
  "device_id": 12,
  "limit": 5,
  "agent_name": "kitchen-agent-ayam-01"
}
```

Aturan:

- `device_id` wajib
- `limit` opsional, default `10`, maksimum `20`
- job yang diambil akan diubah statusnya dari `queued` menjadi `processing`

Response ringkas:

```json
{
  "success": true,
  "device": {
    "id": 12,
    "name": "Printer Ayam",
    "device_type": "printer",
    "connection_driver": "network",
    "endpoint": "tcp://192.168.1.20:9100",
    "paper_width": "80mm",
    "template_style": "kitchen",
    "print_copies": 1,
    "station": {
      "id": 3,
      "name": "Dapur Ayam",
      "slug": "ayam",
      "code": "AYM"
    },
    "outlet": {
      "id": 2,
      "name": "Tenant Ayam",
      "code": "TNT-AYM"
    }
  },
  "jobs": [
    {
      "id": 81,
      "job_type": "kitchen_ticket",
      "status": "processing",
      "copies": 1,
      "queued_at": "2026-05-08T09:58:00+07:00",
      "processing_at": "2026-05-08T09:58:12+07:00",
      "failure_reason": null,
      "payload": {
        "ticket_number": "KT-00081",
        "device_name": "Printer Ayam",
        "device_type": "printer",
        "connection_driver": "network",
        "endpoint": "tcp://192.168.1.20:9100"
      },
      "transaction": {
        "id": 1001,
        "invoice": "INV-20260508-001",
        "customer_name": "Walk In"
      },
      "kitchen_ticket": {
        "id": 55,
        "ticket_number": "KT-00081",
        "status": "pending",
        "station": {
          "id": 3,
          "name": "Dapur Ayam",
          "slug": "ayam",
          "code": "AYM"
        },
        "items": [
          {
            "id": 900,
            "product_name": "Ayam Bakar",
            "qty": 2,
            "notes": null
          }
        ]
      }
    }
  ],
  "meta": {
    "count": 1,
    "agent_name": "kitchen-agent-ayam-01",
    "pulled_at": "2026-05-08T09:58:12+07:00"
  }
}
```

### 3. Ack Success

`POST /api/print-bridge/jobs/{printJob}/success`

Dipanggil setelah printer agent berhasil mencetak job.

Request body:

```json
{
  "device_id": 12,
  "agent_name": "kitchen-agent-ayam-01",
  "note": "Printed via LAN printer"
}
```

Hasil:

- `print_jobs.status` menjadi `success`
- `processed_at` diisi
- event kitchen ticket `ticket.print_job_succeeded` dicatat

### 4. Ack Failed

`POST /api/print-bridge/jobs/{printJob}/failed`

Dipanggil setelah agent gagal mencetak job.

Request body:

```json
{
  "device_id": 12,
  "agent_name": "kitchen-agent-ayam-01",
  "reason": "Printer offline atau kertas habis"
}
```

Hasil:

- `print_jobs.status` menjadi `failed`
- `failed_at` diisi
- `failure_reason` disimpan
- event kitchen ticket `ticket.print_job_failed` dicatat

## Flow Implementasi Bridge

Flow minimal yang disarankan:

1. bridge boot
2. bridge hit `/api/print-bridge/health`
3. bridge loop polling `/api/print-bridge/jobs/pull`
4. jika ada job:
   - format payload menjadi ESC/POS atau HTML print command
   - kirim ke printer
5. jika sukses:
   - hit `/api/print-bridge/jobs/{id}/success`
6. jika gagal:
   - hit `/api/print-bridge/jobs/{id}/failed`

## Saran Arsitektur Agent

Versi agent yang paling praktis:

- Node.js service lokal
- Python service lokal
- Electron helper
- Raspberry Pi service untuk dapur

Minimal tanggung jawab agent:

- menyimpan `device_id`
- mengetahui printer target
- polling job berkala
- mengubah payload menjadi template print
- mengirim ke printer
- mengirim ack sukses / gagal

## Catatan Penting

- endpoint ini sengaja memakai token terpisah, bukan session login browser
- token bridge harus dirahasiakan
- untuk tablet / smartphone, browser tetap hanya sebagai UI
- auto print nyata sebaiknya selalu melalui bridge, bukan browser mobile langsung
