# Lisan.ai

Platform assessment lisan berbasis AI untuk guru dan siswa dengan multi-tenant, kelas, approval join, speech input, evaluasi berbasis rubrik terverifikasi, dan dashboard riset.

## Fitur Utama

- **Auth multi-role**: admin, guru, siswa
- **Multi-tenant**: data tenant terpisah penuh
- **Kelas**: guru membuat kelas dengan kode join, siswa request join, guru approve
- **Assessment**: hanya muncul pada kelas yang sesuai, dengan retake & batas waktu per soal
- **AI generate soal**: dari topik, kompetensi, rubrik, dan tingkat kesulitan — dengan Rubrik Alignment otomatis
- **AI enforce single-substance**: mencegah soal bertingkat (multi-part prompt)
- **Per-question rubric**: setiap soal memiliki rubrik subset yang diselaraskan dengan substansinya
- **Kustomisasi soal**: guru edit manual, minta AI perbaiki, atau AI Rubric Alignment
- **Siswa menjawab**: rekaman suara atau mengetik transkripsi manual
- **AI evaluasi**: evidence-based scoring dengan grounding verifikasi
- **Trustworthy Assessment Harness**: verification gate, publication gate, reproducibility hashes, reliability vector
- **Komplain siswa**: siswa bisa komplain skor, guru respon atau tolak (skor -20)
- **Dashboard Observabilitas**: telemetry, latency, token usage, cost, KV-cache, prefix optimization
- **Dashboard Riset**: AI-vs-Human metrics, inter-rater reliability, approval flow, export trace
- **API publik v1**: dengan API key authentication
- **SQLite lokal**: untuk data aplikasi

## Setup Lokal

1. Install dependency:

   ```bash
   npm install
   ```

2. Buat file `.env` dari template:

   ```bash
   cp .env.example .env
   ```

3. Isi `OPENROUTER_API_KEY` di `.env`.

4. Evaluasi menggunakan **Trustworthy Assessment Harness** — satu-satunya evaluation
   engine (evidence verification, publication gate, reproducibility, reliability,
   risk-based adaptive verification). Tambahkan ke `.env`:

   ```bash
   HARNESS_PROVIDER=openrouter
   MAX_EVALUATION_RETRIES=1
   ```

   `HARNESS_PROVIDER=mock` memakai evaluator deterministik tanpa memerlukan API key,
   berguna untuk CI/develop. Lihat `.env.example` untuk semua variabel.

5. Opsional — aktifkan widget simulasi peran untuk development:

   ```bash
   ENABLE_DEMO_SIMULATION=true
   ```

6. Jalankan server:

   ```bash
   npm run dev
   ```

7. Buka:

   ```
   http://127.0.0.1:4173
   ```

   Dokumentasi API publik (Swagger UI): `http://127.0.0.1:4173/api/docs`

## Scripts

| Perintah                        | Deskripsi                           |
| ------------------------------- | ----------------------------------- |
| `npm run dev`                   | Build frontend + start server lokal |
| `npm run build`                 | Build static frontend (esbuild)     |
| `npm test`                      | Jalankan 239+ test unit/integrasi   |
| `npm run check`                 | Syntax check + semua test           |
| `npm run test:e2e`              | Playwright end-to-end tests         |
| `node scripts/run-benchmark.js` | Benchmark experiment CLI            |

## Testing

18 file test mencakup:

- **Scoring**: weighted mean, renormalisasi, determinism, edge cases
- **Harness**: verification gate, publication gate, grounding, reliability
- **AI service**: generate questions, evaluation, rubric alignment, single-substance
- **Auth**: register, login, session, CSRF, rate limit
- **API**: API keys, assessment CRUD, submission, complaints
- **Research**: AI-vs-Human metrics, inter-rater, experiment runner
- **Security**: CSP headers, rate limiting, authorization boundaries

```bash
npm test        # 239 tests, ~25 detik
npm run check   # syntax check + test
```

## Data dan Keamanan

- `.env` tidak boleh di-commit.
- Database lokal tersimpan di `data/lisan_ai.db`.
- Session memakai cookie HttpOnly + SameSite.
- Password disimpan dengan hash `scrypt`.
- **CSRF token** untuk semua state-changing request.
- **Rate limiting** pada login (5×/menit) dan API AI.
- **Security headers**: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy.
- API assessment, kelas, user, dan submission diproteksi oleh role.
- **API key authentication** untuk API v1 publik.
- **Harness publication gate**: FAIL tidak dipublikasi, REVIEW butuh approval manusia.

## Fitur Belum Ada (Roadmap)

- Reset password & email verification
- Billing/plan quota per tenant
- Export report CSV/PDF

## Demo dan Galeri

### Video Demonstrasi

https://github.com/Hi-Day/LisanAI/raw/master/videos/lisan.ai.mp4

## Deployment

Proyek terdeploy di Vercel:

[https://lisan-ai-assessment.vercel.app](https://lisan-ai-assessment.vercel.app)

Push ke branch `master` otomatis memicu redeploy via integrasi GitHub.

Contributors:

- Hi-Day
- aryakpt
