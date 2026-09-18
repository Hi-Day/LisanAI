# Operasi LisanAI

Panduan singkat untuk deploy, migrasi, backup, dan rollback.

## Deploy

- Vercel otomatis men-deploy dari push ke branch `master` lewat integrasi GitHub.
- CI (`.github/workflows/ci.yml`) menjalankan unit test, architecture check, dan E2E sebelum merge.
- Jalankan `npm run check` dan `npm run build` secara lokal sebelum push.

## Migrasi

- Migrasi berjalan otomatis saat boot di dalam `initDatabase()`, dari `server/migrations/*.sql`.
- Versi tercatat di tabel `schema_migrations` (satu baris per file).
- Setiap file diterapkan secara **atomik** dalam satu batch libSQL: DDL + pencatatan versi
  adalah satu transaksi all-or-nothing. Jika gagal di tengah file, tidak ada skema parsial
  dan versi tidak tercatat.
- Migrasi bersifat **forward-only/additive** (menambah tabel/kolom/index). Tidak ada
  down-migration karena `DROP COLUMN` di SQLite bersifat destruktif dan tidak aman.
- Cek status: `npm run migrate:status`.
- Gate sebelum deploy: `npm run migrate:status -- --check` (exit 1 bila masih ada migrasi pending).
- Menambah migrasi baru: buat file bernomor, mis. `server/migrations/016_nama_fitur.sql`,
  dengan DDL idempoten (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  `ALTER TABLE ... ADD COLUMN`).

## Backup

- Database produksi adalah Turso:
  - Gunakan fitur point-in-time restore Turso untuk snapshot sebelum rilis berisiko.
  - Atau ekspor manual: `turso db shell <db> .dump > backup.sql`.
- Database dev lokal adalah file `data/lisan_ai.db`; cukup salin file tersebut.

## Rollback

1. Deploy ulang deployment Vercel sebelumnya (Vercel Dashboard → Deployment → Promote/Rollback).
2. Jika terjadi kerusakan skema, restore snapshot Turso sebelum rilis.
3. Karena migrasi bersifat additive, revisi aplikasi sebelumnya tetap kompatibel dengan
   skema baru (kolom/tabel ditambah, bukan dihapus), sehingga rollback aplikasi aman.

## Data Seed / Demo

Tersedia di `package.json` (dengan pengaman produksi):

- `npm run seed:showcase`
- `npm run seed:pendopo`
- `npm run seed:competency`

## Health Check

- `/api/health` memerlukan sesi terautentikasi (untuk probe internal), **bukan** endpoint
  uptime publik. Gunakan monitoring internal/authenticated untuk memantau kesehatan.
- Endpoint ini melakukan **readiness probe nyata**, bukan sekadar dump state:
  - menjalankan query `SELECT 1` ke database;
  - melaporkan kesiapan harness evaluasi (provider terkonfigurasi dan statusnya)
    tanpa panggilan jaringan dan tanpa membocorkan secret.
- Bentuk respons:
  ```json
  {
    "status": "ok" | "error",
    "database": { "ok": true } | { "ok": false, "error": "<pesan singkat>" },
    "harness": { "provider": "mock" | "openrouter", "ready": true, "mode": "mock" | "openrouter" },
    "timestamp": "<ISO-8601>"
  }
  ```
- Semantik status HTTP:
  - **200** ketika pemeriksaan database berhasil;
  - **503** ketika pemeriksaan database gagal.
- Detail error internal tidak diungkap; hanya pesan singkat yang dikembalikan.

