# OralAI Assessment

Platform assessment lisan berbasis AI untuk guru dan siswa dengan multi-tenant, kelas, approval join, speech input, dan evaluasi berbasis rubrik.

## Fitur Utama

- Auth multi-role: admin, guru, siswa
- Multi-tenant: data tenant terpisah
- Guru membuat kelas dengan kode join
- Siswa request join kelas
- Guru approve siswa sebelum assessment terlihat
- Assessment hanya muncul pada kelas yang sesuai
- AI generate soal dari topik, kompetensi, rubrik, dan tingkat kesulitan
- Guru bisa edit question set secara manual sebelum publish
- Guru bisa meminta AI memperbaiki seluruh question set
- Siswa menjawab secara lisan atau mengetik transkripsi manual
- AI mengevaluasi jawaban berdasarkan rubrik
- SQLite lokal untuk data aplikasi

## Setup Lokal

1. Install dependency:

```powershell
npm install
```

2. Buat file `.env` dari template:

```powershell
Copy-Item .env.example .env
```

3. Isi `OPENROUTER_API_KEY` di `.env`.

4. Jalankan server:

```powershell
npm start
```

5. Buka:

```txt
http://127.0.0.1:4173
```

## Akun Test Lokal

Jika database lokal yang sudah dibuat masih ada, akun demo:

```txt
Admin
Email: auth932352@example.com
Password: password123
```

```txt
Guru
Email: guru.demo@oralai.test
Password: password123
```

```txt
Siswa
Email: siswa.demo@oralai.test
Password: password123
```

Jika `data/oralai.db` dihapus, buat tenant baru dari halaman register.

## Data dan Keamanan

- `.env` tidak boleh di-commit.
- Database lokal tersimpan di `data/oralai.db`.
- Session memakai cookie HttpOnly.
- Password disimpan dengan hash `scrypt`.
- API assessment, kelas, user, dan submission diproteksi oleh role.

## Catatan Produksi Berikutnya

- Tambahkan reset password dan email verification.
- Tambahkan CSRF token untuk request state-changing.
- Tambahkan rate limit login dan API AI.
- Tambahkan billing/plan quota per tenant.
- Tambahkan export report CSV/PDF.
- Tambahkan test suite otomatis.

## Demo dan Galeri

### Video Demonstrasi
<video src="./videos/lisan.ai.mp4" controls width="100%">
  Browser Anda tidak mendukung tag video.
</video>

### Tangkapan Layar (Screenshots)

Berikut adalah beberapa tampilan dari platform:

<details>
<summary>Lihat Screenshot 439</summary>
<br>
<img src="./pics/Screenshot%20(439).png" alt="Screenshot 439" width="100%">
</details>

<details>
<summary>Lihat Screenshot 440</summary>
<br>
<img src="./pics/Screenshot%20(440).png" alt="Screenshot 440" width="100%">
</details>

<details>
<summary>Lihat Screenshot 441</summary>
<br>
<img src="./pics/Screenshot%20(441).png" alt="Screenshot 441" width="100%">
</details>

<details>
<summary>Lihat Screenshot 442</summary>
<br>
<img src="./pics/Screenshot%20(442).png" alt="Screenshot 442" width="100%">
</details>

<details>
<summary>Lihat Screenshot 443</summary>
<br>
<img src="./pics/Screenshot%20(443).png" alt="Screenshot 443" width="100%">
</details>

<details>
<summary>Lihat Screenshot 444</summary>
<br>
<img src="./pics/Screenshot%20(444).png" alt="Screenshot 444" width="100%">
</details>

<details>
<summary>Lihat Screenshot 445</summary>
<br>
<img src="./pics/Screenshot%20(445).png" alt="Screenshot 445" width="100%">
</details>

<details>
<summary>Lihat Screenshot 446</summary>
<br>
<img src="./pics/Screenshot%20(446).png" alt="Screenshot 446" width="100%">
</details>

<details>
<summary>Lihat Screenshot 447</summary>
<br>
<img src="./pics/Screenshot%20(447).png" alt="Screenshot 447" width="100%">
</details>

<details>
<summary>Lihat Screenshot 448</summary>
<br>
<img src="./pics/Screenshot%20(448).png" alt="Screenshot 448" width="100%">
</details>

<details>
<summary>Lihat Screenshot 449</summary>
<br>
<img src="./pics/Screenshot%20(449).png" alt="Screenshot 449" width="100%">
</details>
