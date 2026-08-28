# Feasibility Study — LisanAI

Versi: 1.0
Tanggal: 26 Agustus 2026
Status: Draf internal

---

## 1. Ringkasan Eksekutif

LisanAI adalah platform assessment lisan berbasis AI untuk guru dan siswa, dengan multi-tenant, manajemen kelas, input suara, evaluasi berbasis rubrik yang terverifikasi, serta dashboard riset.

Kesimpulan: proyek layak secara teknis, operasional, dan ekonomis untuk lanjut ke tahap pilot terbatas. Kesiapan teknis tinggi karena pipeline inti (generate soal, respons siswa, evidence, rubrik, skor, feedback, persist, audit) sudah terbangun utuh, diuji dengan lebih dari 200 test otomatis, dan mencakup fitur tata kelola penilaian yang jarang dimiliki kompetitor: verification gate, publication gate, reproducibility hash, dan reliability vector.

Risiko terbesar bukan pada teknologi, melainkan pada adopsi dan kepercayaan. Guru dan institusi harus yakin bahwa penilaian AI adil dan dapat dipertanggungjawabkan. Mitigasi inti (human approval, evidence trace, AI-vs-human metrics) sudah tersedia dan tinggal diperkuat lewat kalibrasi lintas model.

Rekomendasi: lanjutkan pengembangan jangka pendek (6 bulan) dengan prioritas pada Bagian 6.

---

## 2. Deskripsi Proyek dan Kondisi Saat Ini

### 2.1 Posisi Aplikasi

- Guru: membuat kelas, mengatur keanggotaan (kode join + approval), membuat assessment lisan berbantuan AI (generasi soal dari topik, learning outcome, rubrik, tingkat kesulitan), mengedit soal, melihat hasil siswa.
- Siswa: bergabung ke kelas, mengerjakan assessment (rekam suara atau mengetik transkripsi), menerima skor dan feedback.
- Admin: pengawasan lintas tenant.
- Sistem: evaluasi berbasis evidence (evidence ke kriteria rubrik ke penilaian) secara deterministik dengan traceability dan gerbang verifikasi.

### 2.2 Fitur Pembeda Utama

1. Trustworthy Assessment Harness: verification gate (FAIL tidak dipublikasi), publication gate (REVIEW butuh approval manusia), reproducibility hashing, reliability vector.
2. AI single-substance: validasi deterministik plus perbaikan model agar tiap soal hanya menanyakan satu substansi.
3. Alignmen rubrik per soal: setiap soal dinilai terhadap subset kriteria yang benar-benar diukur soal.
4. Dashboard riset: AI-vs-human metrics, inter-rater reliability, human-approval flow, export trace.
5. Observability: telemetri per panggilan (latency, token, cost, KV-cache), trace persister, log AI.

### 2.3 Arsitektur

Ringkas:
- Backend: Node.js, HTTP server manual, server-side rendering.
- Frontend: vanilla JS SPA dibangun esbuild, output statis.
- Database: SQLite / libsql (Turso), file lokal atau URL remote, migrasi aditif.
- AI: abstraction provider di server, OpenRouter (model default + fallback), mock provider untuk CI.
- Deploy: Vercel serverless + static.
- Testing: 18 file test, lebih dari 200 test unit/integrasi, Playwright e2e.

### 2.4 Status Saat Ini

Sudah berfungsi:
- Auth: register, login, session cookie HttpOnly + SameSite, CSRF, rate limit.
- RBAC: admin, guru, siswa; multi-tenant.
- Kelas dengan kode join, approval membership, retake, batas percobaan.
- CRUD assessment, status published/draft, topik dan tingkat kesulitan.
- Generasi soal AI (streaming SSE), rekomendasi konfigurasi, perbaikan soal.
- Evaluasi harness evidence ke rubrik, verification gate: failure diblokir.
- Submit dengan rekaman audio, detail submission dengan audio penuh.
- Komplain siswa, respons guru.
- Dashboard observasi dan dashboard riset.
- API publik v1 dengan API key dan dokumentasi Swagger.

### 2.5 Estimasi Biaya Langsung

- Estimasi harga di server/config.js: sekitar 0.0015 USD per 1K prompt token dan 0.002 USD per 1K completion token.
- Ada fallback model dan retry (429/5xx/network) dengan backoff.
- KV-cache prefix: estimasi penghematan 65% untuk panggilan berulang dalam 15 menit.

---

## 3. Analisis Kelayakan

### 3.1 Teknis — Tinggi

Sudah bekerja:
- Seluruh pipeline berfungsi dari generasi soal hingga audit metric.
- Deterministic scoring, reproducibility, dan reliability diuji otomatis.
- Mock provider membuat pengembangan tidak bergantung API key berbayar.

Gap utama:
- Speech-to-text belum otomatis mengubah rekaman suara menjadi transkripsi; saat ini masih transkripsi manual.
- Skala database embedded SQLite terbatas; untuk banyak tenant paralel sebaiknya gunakan Turso remote.
- Konsistensi skor lintas model belum diverifikasi secara luas.

### 3.2 Kelayakan Ekonomis

- Biaya terbesar adalah LLM (per generasi soal dan per evaluasi).
- Dengan model murah dan KV-cache, biaya per unit tetap rendah.
- Jalur komersial realistis: paket seat per guru/tenant, bukan per token.

### 3.3 Kelayakan Operasional

- Deploy Vercel siap, variabel env tersedia.
- Observability dengan log AI per panggilan, trace, dashboard.
- Reliability dengan retry, fallback model, dan verifikasi.

### 3.4 Kelayakan Legal dan Regulasi

- Data siswa bersifat sensitif. Perlu kepatuhan UU PDP Indonesia, kebijakan privasi, persetujuan orang tua untuk data anak, dan kesepakatan pemrosesan data dengan penyedia AI.

---

## 4. Risiko Utama dan Mitigasi

| Risiko | Severitas | Mitigasi |
|---|---|---|
| Model AI menghasilkan penilaian tidak adil | Tinggi | Verification gate, human review, evidence trace, AI-vs-human metrics |
| Prompt injection dari jawaban siswa | Tinggi | Sistem instruksi terpisah dari konten, validasi output, deterministik scoring |
| Konsistensi antarmodel | Sedang | Kalibrasi benchmark lintas model, inter-rater reliability |
| Biaya LLM meningkat | Sedang | Model murah, caching, batas retry, monitoring cost |
| Kepatuhan data anak | Tinggi | Persetujuan orang tua, minimalisasi data, kebijakan privasi, DPA |

---

## 5. Estimasi Rencana Implementasi

| Fase | Durasi | Deliverable |
|---|---|---|
| Integrasi speech-to-text | 1-2 bulan | Rekaman siswa ditranskripsi otomatis |
| Kalibrasi antarmodel | 2 bulan | Panel perbandingan skor, tuning rubrik |
| Pilot terbatas | 2-3 bulan | Uji dengan sekolah/guru nyata, kualitas feedback |
| Komersialisasi awal | 1 bulan | Paket penjualan, dukungan |

---

## 6. Rekomendasi

Proyek layak untuk dilanjutkan. Prioritas 6 bulan ke depan:

1. Integrasi speech-to-text otomatis pada alur perekaman siswa.
2. Kalibrasi soal dan rubrik lintas model.
3. Pilot dengan sekolah atau guru nyata untuk umpan balik.
4. Roadmap komersial (seat per guru, paket sekolah).
5. Kepatuhan perlindungan data peserta didik.

Catatan: seluruh pertimbangan ekonomi didasarkan pada estimasi biaya internal dan perlu dipertajam pada tahap pilot.

---

*Dokumen disusun berdasarkan hasil inspeksi arsitektur dan implementasi saat ini (26 Agustus 2026).*