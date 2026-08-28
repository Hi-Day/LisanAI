# Analisa Kelayakan Keuangan & Bisnis — LisanAI

Versi: 1.0
Tanggal: 26 Agustus 2026
Status: Draf internal

---

## 1. Ringkasan Eksekutif

Dari sisi keuangan dan bisnis, LisanAI dinilai **LAYAK** untuk dikomersialkan,
dengan catatan penting:

- **Biaya variabel sangat rendah.** Biaya LLM per evaluasi berkisar
  **USD 0,001 – 0,007** (tergantung model). Bahkan jika ditambah biaya
  speech-to-text, total biaya variabel per submission hanya sekitar
  **USD 0,002 – 0,04**.
- **Margin kotor sangat tinggi (~92–98%).** Biaya utama bukan token, melainkan
  biaya tetap (pengembangan, cloud, pemasaran, dukungan).
- **Model bisnis yang realistis:** langganan (subscription) per sekolah /
  per guru / per tenant, bukan per-token. Kenaikan pendapatan datang dari
  jumlah sekolah, bukan dari volume pemakaian.
- **Titik impas (break-even)** sangat sensitif terhadap besarnya OPEX tetap:
  - Tim ramping / bootstrap (OPEX ~Rp 8–15 jt/bulan): impas dengan **5–10 sekolah**
    berlangganan (pendapatan ~Rp 12–20 jt/bulan).
  - Tim penuh / funded (OPEX ~Rp 120 jt/bulan): impas dengan **±80 sekolah**
    (pendapatan ~Rp 180 jt/bulan). Detail di Bagian 9.
- **ROI positif** tercapai antara bulan ke-8 (bootstrap ramping) hingga bulan
  ke-18 (skenario funded/konservatif), bergantung pada biaya tetap & laju adopsi.

Perkiraan harga API LLM dikumpulkan dari sumber resmi (DeepSeek, OpenAI, Google
Gemini via OpenRouter) pada 26 Agustus 2026.

---

## 2. Data Harga API LLM (Riset Internet)

Semua harga dalam **USD per 1 juta token** (per 1M). Harga diambil dari halaman
resmi provider pada tanggal analisis.

### 2.1 DeepSeek (API resmi — model saat ini di aplikasi)

| Item | DeepSeek-V4-Flash (off-peak) | DeepSeek-V4-Flash (peak) | DeepSeek-V4-Pro (off-peak) |
|---|---|---|---|
| Input cache-hit | $0.007 / M | $0.014 / M | $0.022 / M |
| Input cache-miss | $0.22 / M | $0.44 / M | $0.66 / M |
| Output | $0.66 / M | $1.32 / M | $1.98 / M |

> Catatan: peak = 01:00–04:00 & 06:00–10:00 UTC, Senin–Jumat; selain itu off-peak.

### 2.2 DeepSeek-V4-Flash via provider pihak ketiga (OpenRouter)

Harga sangat bervariasi per provider hosting. Contoh:

| Provider | Input /M | Output /M |
|---|---|---|
| DeepInfra / Relace | $0.08 | $0.18 |
| Together / SiliconFlow | $0.14 | $0.28 |
| DeepSeek resmi | $0.22 | $0.66 |
| Baidu Qianfan (56% off) | ~$0.062 | ~$0.123 |

### 2.3 Gemini 2.5 Flash (Google, via Vertex / AI Studio / OpenRouter)

| Item | Harga |
|---|---|
| Input | $0.30 / M |
| Output | $2.50 / M |
| Cache read | $0.03 / M |

### 2.4 OpenAI (API, per 1M token)

Model yang paling relevan untuk evaluasi & STT:

| Model | Input | Output | Cached input |
|---|---|---|---|
| gpt-4o-mini | $0.15 | $0.60 | $0.075 |
| gpt-4.1-nano | $0.10 | $0.40 | $0.025 |
| gpt-5-mini | $0.25 | $2.00 | $0.025 |
| gpt-5-nano | $0.05 | $0.40 | $0.005 |
| gpt-5.6-luna | $0.20 | $1.20 | $0.02 |

### 2.5 Speech-to-Text (STT) — OpenAI

| Model | Biaya |
|---|---|
| gpt-transcribe | $0.05 / menit |
| gpt-4o-mini-transcribe | $0.003 / menit |
| gpt-4o-transcribe | $0.006 / menit |
| Whisper | $0.006 / menit |

Catatan: STT lokal (mis. Whisper di server, atau transkripsi gratis) dapat
mengurangi biaya ini menjadi nol — penting untuk skenario on-premise.

---

## 3. Asumsi Model Pemakaian

Untuk menghitung biaya per aktivitas, dipakai asumsi token per satu assessment
(5 soal, evaluasi berbasis rubrik + verifikasi via harness):

| Aktivitas | Input token | Output token |
|---|---|---|
| Generate soal (5 soal, streaming) | 1.500 | 2.000 |
| Rekomendasi konfigurasi (jarang) | 500 | 600 |
| Repair / align / improve (kadang) | 500 | 300 |
| Evaluasi 1 submission (harness: eval + verifikasi) | 4.000 | 2.500 |

Biaya per submission = biaya evaluasi + (opsional) STT.

Perkiraan waktu audio per submission (5 soal, rata-rata 2 menit/soal) = ~10 menit.

---

## 4. Unit Economics per Submission (Biaya Variabel)

Dihitung dari biaya evaluasi (4.000 in / 2.500 out) + opsi STT.

Asumsi cache: 60% input cache-hit, 40% cache-miss (karena prompt/rubrik berulang).

### 4.1 Biaya evaluasi per submission (tanpa STT)

| Model | Blended input $/M | Output $/M | Biaya/submission |
|---|---|---|---|
| DeepSeek V4 Flash (resmi, off-peak) | 0.042 | 0.66 | **$0.0019** |
| DeepSeek V4 Flash (DeepInfra) | 0.08 | 0.18 | **$0.00077** |
| Gemini 2.5 Flash | 0.138 | 2.50 | **$0.0068** |
| OpenAI gpt-4o-mini | 0.105 | 0.60 | **$0.0019** |
| OpenAI gpt-5.6-luna | 0.092 | 1.20 | **$0.0034** |
| OpenAI gpt-5-mini | 0.145 | 2.00 | **$0.0058** |

Rumus blended input: (60% × cache-hit) + (40% × cache-miss).

### 4.2 Biaya speech-to-text per submission (opsional)

| Metode | Biaya per submission (10 menit) |
|---|---|
| gpt-4o-mini-transcribe ($0.003/mnt) | **$0.03** |
| Whisper ($0.006/mnt) | $0.06 |
| STT lokal / gratis | $0.00 |

### 4.3 Total biaya variabel per submission

| Skenario | LLM + STT | Total/submission |
|---|---|---|
| DeepSeek (resmi), tanpa STT | $0.0020 + 0 | **$0.0020** |
| DeepSeek (resmi), + STT gpt-4o-mini | $0.0020 + $0.03 | **$0.032** |
| Gemini + STT gpt-4o-mini | $0.0068 + $0.03 | **$0.037** |
| DeepSeek + STT lokal (0) | $0.0020 + 0 | **$0.0020** |

> **Insight penting:** speech-to-text, bila memakai API berbayar, menjadi
> komponen biaya variabel terbesar. Strategi: pakai STT lokal/self-host agar
> biaya variabel tetap di kisaran < $0.005 per submission.

### 4.4 Perbandingan dengan estimator di kode

Kode `server/openrouter.js` memakai estimator **$1.50 / 1K input dan $2.00 / 1K
output** (~$1500/M dan $2000/M) — jauh di atas harga riil DeepSeek. Artinya:

- Estimator kode **over-estimate** biaya riil saat ini (real ~10–50x lebih murah
  untuk DeepSeek). Cocok sebagai buffer konservatif, bukan angka sebenarnya.
- Dashboard observasi menampilkan biaya yang dibulatkan ke atas.

---

## 5. Skema Deployment Model (Skenario)

### 5.1 Opsi A — Cloud API (Managed, SaaS multi-tenant) — direkomendasikan

- Model: DeepSeek V4-Flash (resmi) + fallback; opsi Gemini/OpenAI untuk kualitas.
- STT: lokal (self-host) untuk tekan biaya.
- Infrastruktur: Vercel (serverless) + Turso/SQLite remote + storage audio.
- **Plus:** tanpa capex GPU, skala otomatis, pemeliharaan minim, model terbaru.
- **Minus:** bergantung provider cloud (internet), biaya token per bulan, data
  melintasi server pihak ketiga (perlu DPA / kebijakan privasi).

### 5.2 Opsi B — On-premise (self-host di sekolah/instansi)

- **AI:** model open-source kecil (Qwen 32B / Llama 8–70B / distilasi) karena
  DeepSeek V4-Flash (284B) terlalu besar untuk satu node; atau pakai API bila
  sekolah mengizinkan.
- **Hardware:** 1 server GPU (mis. 2x A100 80GB / RTX 4090 untuk model kecil).
- **Aplikasi:** Node + SQLite berjalan di server yang sama.
- **Plus:** data siswa 100% lokal (patuh UU PDP), tidak ada biaya token,
  offline-capable.
- **Minus:** CAPEX tinggi, perlu tenaga ML-Ops, pembaruan model manual, kualitas
  model kecil lebih rendah, skala terbatas.

### 5.3 Opsi C — Hybrid

- Cloud untuk skala fleksibel + on-premise untuk sekolah yang menuntut
  kerahasiaan data. Disarankan untuk pilot dengan sekolah besar/pemerintah.

### 5.4 Rekomendasi deployment

Gunakan **Opsi A (Cloud) saat peluncuran**, dengan arsitektur memungkinkan
**Opsi B** untuk klien yang membutuhkan data residency. Karena aplikasi sudah
provider-agnostik dan memakai SQLite file-based, jalur on-premise relatif murah
untuk diaktifkan.

---

## 6. CAPEX dan OPEX

### 6.1 CAPEX (Capital Expenditure)

| Item | Cloud (A) | On-premise (B) |
|---|---|---|
| Server/GPU | $0 | $20,000 – $250,000 |
| Penyimpanan audio | $0 (disewa) | $2,000–$10,000 |
| Setup/instalasi | $0 | $5,000–$20,000 |
| Kontrak lisensi model (ops) | $0 | $0 (open source) |
| **Total CAPEX awal** | **~$5,000–20,000** (bukan hardwa) | **~$30,000–$300,000** |

> CAPEX pada skenario cloud terutama untuk engineering/product hardening & biaya
> pengembangan sekali (sudah sebagian besar dilakukan).

### 6.2 OPEX tetap bulanan (Cloud SaaS)

| Pos | Estimasi / bulan (USD) |
|---|---|
| Developer / engineering (1–2 org) | $3,000–$6,000 |
| Cloud & database (Vercel + Turso + storage) | $100–$500 |
| Observasi/telemetri (LogRocket/Sentry/monitoring) | $50–$200 |
| Dukungan & success (part-time) | $500–$1,000 |
| Pemasaran & penjualan | $500–$2,000 |
| Legal/kepatuhan (UU PDP) | $200–$500 |
| **Total OPEX tetap** | **~$4,500–$10,000/bulan** |

### 6.3 OPEX variabel (Cloud) — tergantung volume

| Volume submission/bulan | LLM+STT ($0.002/sub) | LLM+STT+$0.03 (paid STT) |
|---|---|---|
| 1.000 | $2 | $32 |
| 10.000 | $20 | $320 |
| 100.000 | $200 | $3,200 |
| 1.000.000 | $2.000 | $32.000 |

### 6.4 On-premise OPEX

| Pos | Estimasi / bulan |
|---|---|
| Listrik & pendinginan | $200–$800 |
| ML-Ops / admin (part-time) | $1,000–$3,000 |
| Pemeliharaan/pembaruan | $200–$500 |
| **Total** | **$1,400–$4,300/bulan** |

---

## 7. Model Komersialisasi

### 7.1 Struktur harga (langganan, dalam Rupiah)

Pendekatan: **berlangganan per sekolah / per guru**, bukan per-token (menghindari
biaya variabel yang membuat pelanggan takut dan tidak dapat diprediksi).

| Paket | Harga/bulan | Cakupan |
|---|---|---|
| Basic | Rp 1.000.000 | 1 sekolah, hingga 20 guru, hingga 500 siswa, evaluasi tak terbatas |
| Pro | Rp 2.500.000 | 1 sekolah, hingga 100 guru, kelas lanjutan, dashboard riset |
| Enterprise / On-prem | Harga negosiasi | Data lokal, dukungan khusus, SLA |

Asumsi kurs: Rp 16.000 / USD.

### 7.2 Alasan harga

- Biaya variabel per sekolah sangat kecil (ribuan rupiah/bulan), sehingga hampir
  seluruh harga jual menjadi margin.
- Harga mengikuti kemampuan bayar sekolah Indonesia (Rp 500rb–3jt/bulan masuk
  akal untuk alat asesmen digital).
- Paket "evaluasi tak terbatas" menarik karena di sisi kami biaya per evaluasi
  sangat kecil — berbeda dengan produk per-token.

### 7.3 Model pendapatan alternatif

1. Langganan per guru (seat): Rp 100–200 ribu/guru/bulan.
2. Per sekolah flat: Rp 2–5 juta/bulan (mudah dipahami).
3. Per pemakaian (volume): tidak disarankan.
4. Kemitraan/distribusi: lewat MGMP, dinas pendidikan, atau startup edutech.
5. Grants / kemitraan riset: untuk kalibrasi dan validasi (aset nilai jual).

---

## 8. Proyeksi Pendapatan dan Laba (3 Tahun)

Asumsi kurs $1 = Rp 16.000. Skenario ini memakai **tim ramping/bootstrap** dengan
OPEX tetap ~**Rp 10 jt/bulan** (Rp 120 jt/tahun). Skenario tim penuh/funded akan
menaikkan OPEX dan titik impas (lihat Bagian 9). Pendapatan rata-rata per sekolah
(mix Basic/Pro) = **Rp 1,5 jt/bulan**.

### 8.1 Skenario Dasar (Base)

| Tahun | Sekolah aktif | Pendapatan/bulan | Pendapatan/tahun | OPEX tetap/tahun | Laba/tahun* |
|---|---|---|---|---|---|
| T1 | 20 | Rp 30 jt | Rp 360 jt | Rp 120 jt | ~Rp 240 jt |
| T2 | 80 | Rp 120 jt | Rp 1,44 M | Rp 120 jt | ~Rp 1,3 M |
| T3 | 200 | Rp 300 jt | Rp 3,6 M | Rp 144 jt | ~Rp 3,4 M |

*Sebelum biaya variabel (sangat kecil, < Rp 5 jt/bulan).*

### 8.2 Skenario Konservatif

- 15 sekolah T1, 40 T2, 90 T3. Pendapatan T1 ~Rp 270 jt, T2 ~Rp 720 jt,
  T3 ~Rp 1,6 M. Break-even mundur ke pertengahan tahun ke-2.

### 8.3 Skenario Agresif

- 40 sekolah T1, 150 T2, 400 T3. Laba nyata mulai bulan ke-6–9.

---

## 9. Analisa ROI dan Break-Even

### 9.1 Break-even (titik impas)

Break-even ditentukan oleh OPEX tetap bulanan dibagi pendapatan rata-rata per
sekolah (Rp 1,5 jt/bulan):

```
Skenario tim ramping/bootstrap:
  OPEX tetap ~Rp 8–15 jt/bulan
  Break-even ≈ Rp 8.000.000–15.000.000 / Rp 1.500.000 ≈ 5–10 sekolah

Skenario tim penuh/funded (eng + go-to-market):
  OPEX tetap ~Rp 120 jt/bulan
  Break-even ≈ Rp 120.000.000 / Rp 1.500.000 ≈ 80 sekolah
```

Artinya, titik impas berada di kisaran **5–10 sekolah (bootstrap)** hingga
**~80 sekolah (tim penuh)**, bergantung skala biaya tetap.

### 9.2 Payback / ROI

Anggap total modal + biaya pengembangan lanjutan (CAPEX efektif) ≈ **Rp 150 jt**
sebelum pendapatan.

- Dengan laba bersih ~Rp 20 jt/bulan (skenario dasar T1–T2),
  **payback ≈ 7–9 bulan**.
- **ROI kumulatif positif mulai bulan ke ~8–12** (dasar) dan **~12–18**
  (konservatif).

### 9.3 Sensitivitas

| Faktor | Dampak |
|---|---|
| Adopsi lambat | Menunda break-even 4–6 bulan |
| Biaya tetap naik (tambah karyawan) | Perlu +10–15 sekolah lagi |
| STT berbayar | Biaya variabel naik ke ~$0.03–0.06, masih kecil vs harga jual |
| Margin kotor | Tetap >90% karena biaya variabel minimal |
| Churn sekolah | Menurunkan pendapatan berulang; penting manajemen churn |

---

## 10. Aspek Keuangan Lainnya

### 10.1 Keuntungan struktural

- **Biaya marginal hampir nol:** menambah 1 sekolah hampir tidak menambah biaya
  variabel → margin inkremental sangat tinggi.
- **Recurring revenue:** langganan bulanan → pendapatan dapat diprediksi.
- **Moats:** data evaluasi rubrik (aset data), Trustworthy Harness (reputasi),
  switching cost saat sekolah sudah memasukkan data.

### 10.2 Risiko keuangan

- **Churn** adalah risiko pendapatan utama (butuh retention/onboarding).
- **Ketergantungan provider AI:** perubahan harga LLM berdampak kecil karena
  margin besar.
- **Adopsi B2B pendidikan lambat:** siklus penjualan panjang, anggaran sekolah
  terbatas. Pilot + kanal pemerintah penting.
- **Kompetisi:** posisikan lewat kualitas/validitas dan harga.

### 10.3 Kebutuhan dana

- **MVP/hardening:** selesai (sebagian besar sudah dibangun).
- **Go-to-market & skala:** butuh dana untuk pemasaran, dukungan, kepatuhan
  (est. Rp 150–300 jt untuk 12 bulan pertama).

---

## 11. Rekomendasi Keuangan dan Bisnis

1. **Gunakan Cloud SaaS (Opsi A)** saat peluncuran; siapkan jalur on-premise
   untuk sekolah yang menuntut data lokal.
2. **Terapkan model langganan** (per sekolah / seat), bukan per-token.
3. **Pakai DeepSeek V4-Flash + STT lokal** untuk menjaga biaya variabel
   < Rp 100/submission; cadangan Gemini/OpenAI untuk kualitas tertentu.
4. **Perbarui estimator biaya di kode** (`openrouter.js`) agar sesuai harga
   riil, untuk akurasi dashboard observasi.
5. Target **break-even** di 5–10 sekolah (bootstrap) hingga ~80 sekolah
   (tim penuh); ROI positif dalam 8–18 bulan tergantung skenario.
6. Mulai **pilot 10–20 sekolah** untuk mengukur churn, biaya nyata, dan
   willingness-to-pay sebelum agresif memasarkan.

---

*Dokumen disusun dari inspeksi codebase + riset harga API LLM publik
(DeepSeek, OpenAI, Google Gemini) per 26 Agustus 2026. Semua angka biaya LLM
adalah estimasi dan perlu validasi pada fase pilot.*