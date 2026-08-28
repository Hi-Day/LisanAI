# LisanAI — Pitch Deck (One Pager)

> **Asesmen lisan yang objektif, tahan kecurangan AI, dan benar-benar mengukur cara berpikir murid — bisa dipertanggungjawabkan.**

---

## 1. Masalah (Rasa Sakit yang Nyata)

| # | Masalah | Dampak |
|---|---|---|
| 1 | Penilaian lisan **subjektif** — standar beda antar-guru, menilai impresi bukan kriteria | Nilai tidak adil, tidak konsisten |
| 2 | Guru **tak sanggup** menilai ratusan lisan secara manual | Nilai "asal", dihindari, tidak valid |
| 3 | **Booming AI** memungkinkan kecurangan tugas tertulis | Tugas tidak lagi mengukur murid |
| 4 | **Tidak ada bukti** saat Rapor Pendidikan/e-Kinerja menuntut | Laporan kosong/dipalsukan, sengketa nilai |
| 5 | AI generik = **kotak hitam**, tidak bisa dipertanggungjawabkan | Sekolah takut mengadopsi AI |

## 2. Solusi — LisanAI

Platform assessment **lisan** berbasis AI yang **terverifikasi manusia**:

- **Objektif:** skor berbasis *evidence → rubrik → nilai*, skor deterministik & reproducible.
- **Anti-kecurangan AI:** ujian lisan spontan + probing + soal terbuka (open-ended, berpikir), sulit disalin/ditiru AI.
- **Reflektif:** mengukur proses berpikir & komunikasi (kompetensi abad 21), bukan hafalan.
- **Trustworthy Harness:** verification gate, publication gate (butuh approval guru), reproducibility hash, reliability vector.
- **Multi-tenant, kelas, rekaman suara, dashboard riset** (AI-vs-Human, inter-rater).

## 3. Target Pasar

- **Primary:** Sekolah SMP/SMA Indonesia (B2B).
- **Pengguna:** guru (harian), kepala sekolah/kurikulum, yayasan, dinas.
- **Segmen pelengkap:** kursus bahasa/LPTK, bimbel, dinas pendidikan (on-premise).

## 4. Model Bisnis

Langganan per sekolah/seat (bukan per-token): **Basic Rp 1 jt**, **Pro Rp 2,5 jt**/bulan.

## 5. Estimasi Biaya Operasional

### Unit Economics (per submission — 5 soal lisan)

| Komponen | Input | Output | Biaya |
|---|---|---|---|
| Evaluasi (harness + verifikasi) | 4.000 | 2.500 | ~$0.002 (DeepSeek off-peak) |
| Speech-to-text (lokal/gratis) | — | — | $0 |
| Speech-to-text (berbayar, opsional) | — | — | ~$0.03 |
| **Total variabel/submission** | | | **$0.002–0.04** |

> Margin kotor ~92–98%. Biaya variabel hampir nol → menambah sekolah hampir gratis.

### Biaya tetap bulanan (Cloud SaaS — bootstrap)

| Pos | Estimasi |
|---|---|
| Developer/engineering (1–2 org) | $3.000–6.000 |
| Cloud + DB (Vercel + Turso + storage) | $100–500 |
| Monitoring/telemetri | $50–200 |
| Dukungan & success | $500–1.000 |
| Pemasaran & penjualan | $500–2.000 |
| Legal/kepatuhan (UU PDP) | $200–500 |
| **Total OPEX tetap** | **~$4.500–10.000/bulan** |

**Break-even:** 5–10 sekolah (bootstrap) s/d ~80 sekolah (tim penuh). **ROI positif** bulan ke-8–18.

## 6. Tawaran yang Sulit Ditolak

> **Risiko nol.** Satu kelas percobaan penuh, 45 hari, **gratis**. Nilai guru lebih cepat, lebih adil, lebih berbukti — atau tidak ada biaya. Data bisa diekspor/dihapus kapan pun; setiap nilai bisa diperiksa sampai ke bukti & rubrik.

---

*Angka berdasar inspeksi codebase (unit economics §FINANCIAL_FEASIBILITY.md) & estimator `server/ai/pricing.js`. Perlu verifikasi melalui pilot 10–20 sekolah sebelum go-to-market.*