# Logo Lisan.ai

Folder ini berisi aset logo resmi aplikasi **Lisan.ai** — platform penilaian lisan berbasis AI.

## Spesifikasi Gambar

### Format & Ukuran

| Aset | Format | Ukuran (px) | Penggunaan |
|------|--------|-------------|------------|
| `logo.svg` | SVG (vektor) | 64×64 (skalabel) | Sumber utama, favicon, brand-mark |
| `favicon.ico` | ICO | 32×32 | Tab browser (fallback lama) |
| `apple-touch-icon.png` | PNG | 180×180 | iOS / Android home screen |
| `icon-192.png` | PNG | 192×192 | PWA / Android |
| `icon-512.png` | PNG | 512×512 | PWA / splash screen |

### Desain

- **Bentuk**: Kotak dengan sudut membulat (`rx=16` pada viewBox 64).
- **Warna dasar**: `#2563eb` (blue-600) — sama dengan variabel `--accent` di `styles.css`.
- **Simbol**: 5 garis gelombang suara putih (mewakili penilaian **lisan** / suara).
- **Kontras**: Putih di atas biru, memenuhi rasio kontras untuk ikon kecil.

### Pedoman

1. **Jangan** mengubah warna dasar tanpa menyesuaikan `--accent` di `styles.css`.
2. **Jangan** menambahkan teks pada ikon — teks "Lisan.ai" sudah ditampilkan di samping logo di UI.
3. Untuk favicon, gunakan versi 32×32 agar tajam di tab browser.
4. Simpan semua aset di folder ini agar konsisten dan mudah dikelola.

## Cara Menghasilkan PNG dari SVG

Jika belum ada file PNG, buat dari `logo.svg` menggunakan salah satu cara berikut:

```bash
# Menggunakan ImageMagick
magick -background none -density 300 public/logo/logo.svg -resize 512x512 public/logo/icon-512.png
magick -background none -density 300 public/logo/logo.svg -resize 192x192 public/logo/icon-192.png
magick -background none -density 300 public/logo/logo.svg -resize 180x180 public/logo/apple-touch-icon.png
magick -background none -density 300 public/logo/logo.svg -resize 32x32 public/logo/favicon.ico
```

> **Catatan**: SVG sudah cukup untuk favicon modern dan brand-mark. File PNG/ICO hanya diperlukan jika menargetkan browser lama atau PWA.