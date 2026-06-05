# Proposal Proyek: Oral AI Assessment (Asesmen Lisan Berbasis AI)

## 1. Background of the Project
Perkembangan pesat teknologi kecerdasan buatan (AI) generatif, seperti ChatGPT dan model bahasa besar lainnya, telah membawa disrupsi yang signifikan dalam dunia pendidikan. Salah satu dampak yang paling mengkhawatirkan adalah menurunnya integritas akademik pada ujian atau asesmen tertulis konvensional. Ujian tertulis (seperti esai, tugas mandiri, atau *take-home test*) kini sangat rawan terhadap praktik *copy-paste* (copas) dan plagiarisme menggunakan jawaban yang dihasilkan secara otomatis oleh AI. Mahasiswa dapat dengan mudah melewati ujian tanpa perlu benar-benar memahami dan menguasai materi pembelajaran.

Untuk memastikan bahwa sebuah evaluasi benar-benar mengukur pemahaman otentik dari mahasiswa, asesmen tertulis tidak lagi cukup. Diperlukan metode ujian lisan (*oral assessment*) di mana mahasiswa harus memproses pertanyaan secara langsung dan mengartikulasikan jawaban melalui pemikiran spontan mereka sendiri. Namun, menyelenggarakan ujian lisan secara tradisional memakan waktu yang sangat lama dan membutuhkan sumber daya penguji yang besar. Oleh karena itu, proyek "Oral AI Assessment" ini diusulkan untuk mengotomatisasi ujian lisan menggunakan AI. Sistem ini akan memungkinkan pelaksanaan ujian lisan secara masif dan terstruktur, mengembalikan integritas akademik tanpa membebani waktu dosen.

## 2. Problem Statement
1. **Rentan Terhadap Kecurangan Berbasis AI:** Asesmen dan ujian tertulis semakin kehilangan kredibilitasnya karena sangat rentan dimanipulasi dengan menggunakan AI (rawan *copy-paste*), sehingga nilai yang didapat mahasiswa seringkali tidak mencerminkan pemahaman aslinya.
2. **Keterbatasan Skalabilitas Ujian Lisan Tradisional:** Ujian lisan merupakan metode terbaik untuk mengukur pemahaman sejati, namun pelaksanaannya secara manual (*one-on-one* antara dosen dan mahasiswa) sangat tidak efisien dari segi waktu, tenaga, dan penjadwalan, khususnya untuk kelas dengan kapasitas besar.
3. **Keterlambatan Umpan Balik (Feedback):** Dalam metode evaluasi konvensional, mahasiswa harus menunggu proses koreksi yang lama untuk mendapatkan hasil evaluasi. Ketiadaan umpan balik yang instan memperlambat proses perbaikan dan pembelajaran mahasiswa.

## 3. Goal and Benefit
**Goal (Tujuan):**
* Mengembangkan platform asesmen lisan otomatis yang digerakkan oleh AI untuk melakukan tanya-jawab, memonitor, dan mengevaluasi pemahaman mahasiswa secara *real-time*.
* Menciptakan sistem evaluasi pendidikan yang tangguh (*resilient*) terhadap bentuk-bentuk kecurangan modern yang difasilitasi oleh AI generatif.

**Benefit (Manfaat):**
* **Integritas Akademik & Ketahanan (Resilience):** Asesmen menjadi jauh lebih *resilient* dari kecurangan *copy-paste* teks AI, karena mahasiswa diwajibkan menjawab secara verbal dan spontan.
* **Umpan Balik Instan bagi Mahasiswa:** Mahasiswa dapat langsung mendapatkan *feedback* evaluasi dari jawaban lisan mereka segera setelah ujian selesai, membantu mereka mengenali kelemahan dan memperbaiki pemahaman mereka saat itu juga.
* **Efisiensi Beban Kerja Dosen:** Dosen dapat mengevaluasi kemampuan komunikasi dan pemahaman konseptual seluruh mahasiswa dalam satu kelas secara serentak, serta memantau analitik hasilnya pada dasbor *monitoring*, tanpa harus menguji satu per satu.

## 4. Project Implementation Plan
Rencana implementasi proyek ini akan dibagi menjadi beberapa fase:
1. **Fase 1: Analisis & Desain Arsitektur**
   * Mengintegrasikan kebutuhan *monitoring real-time* ke dalam *Teacher Dashboard*.
   * Perancangan *flow* ujian berbasis lisan (integrasi antarmuka mikrofon dan perekaman audio).
2. **Fase 2: Pengembangan Inti (Core Development)**
   * Pembuatan modul *Speech-to-Text* (STT) untuk mentranskripsi jawaban audio mahasiswa menjadi teks.
   * Integrasi *Large Language Model* (LLM) untuk bertindak sebagai penilai (*grader*) yang membandingkan transkrip jawaban mahasiswa dengan rubrik penilaian dosen.
3. **Fase 3: Implementasi Fitur Optimasi AI**
   * Menerapkan teknik optimasi AI (*Prefix KV Cache*) pada sistem *backend* untuk mempercepat inferensi dan menangani repetisi instruksi ujian.
4. **Fase 4: Testing & Iterasi**
   * *Internal testing* dan *beta release* di lingkungan kelas percobaan untuk menguji beban (*load testing*) dan keakuratan penilaian (*grading accuracy*).
5. **Fase 5: Deployment & Peluncuran**
   * Persiapan server produksi, *deployment* platform untuk penggunaan internal universitas, serta pemantauan stabilitas sistem secara *real-time*.

## 5. Novelty (Kebaruan Inovasi)
Kebaruan (*novelty*) dan nilai inovasi teknis dari platform ini terletak pada **optimasi *Prefix KV (Key-Value) Cache* untuk pemrosesan *prompt* yang berulang dalam evaluasi asesmen siswa.**

Dalam pelaksanaan ujian yang melibatkan banyak mahasiswa, instruksi (*system prompt*), konteks pertanyaan, dan rubrik penilaian yang diberikan kepada *engine* AI (LLM) akan selalu sama. Secara tradisional, LLM akan memproses ulang teks panjang ini untuk setiap mahasiswa yang dinilai, sehingga memakan komputasi dan waktu yang besar. 
Melalui pendekatan **Prefix KV Cache**, sistem kami akan memproses dan menyimpan (*cache*) bagian *prompt* instruksi/rubrik yang statis (*prefix*) tersebut. Sehingga, ketika mengevaluasi puluhan atau ratusan mahasiswa pada soal yang sama, AI hanya perlu menghitung lanjutan dari *prompt* tersebut (yaitu jawaban transkrip dari masing-masing mahasiswa). Hal ini akan memberikan lonjakan performa dalam bentuk **waktu respons AI yang jauh lebih cepat (latensi rendah)** serta **penurunan biaya pemrosesan token secara signifikan**.

## 6. Potential Output
Sistem ini memiliki potensi penerapan dalam dua jalur utama:
1. **Penggunaan Internal (Binus University):**
   * Diimplementasikan sebagai bagian dari standar evaluasi dan *Quality Assurance* (QA) akademik di Bina Nusantara.
   * Digunakan oleh para dosen sebagai sarana kuis, ujian tengah semester, atau presentasi akhir berbasis lisan yang dinilai secara otomatis, mengukuhkan posisi Binus University sebagai kampus berteknologi mutakhir.
2. **Komersialisasi (B2B / SaaS):**
   * Platform ini dapat dipaketkan sebagai layanan SaaS (*Software as a Service*) di bidang *EdTech* (Educational Technology) yang ditawarkan kepada universitas lain, lembaga sertifikasi, tempat kursus bahasa, hingga korporasi untuk keperluan *interview* atau asesmen kompetensi karyawan.

## 7. Resource Efficiency Estimation ROI
* **Penghematan Waktu (Time Efficiency):** Dosen dapat menghemat hingga 80-90% waktu yang biasanya dihabiskan untuk melakukan ujian lisan secara tatap muka (misalnya, dari 15 jam ujian untuk 30 mahasiswa, menjadi hanya 1 jam pengerjaan serentak ditambah tinjauan hasil via *dashboard*).
* **Efisiensi Infrastruktur (Cost Efficiency):** Implementasi metode *Prefix KV Cache* diproyeksikan dapat mengurangi biaya operasional API/Infrastruktur LLM sebesar 40-60% saat melakukan ujian berskala masif, karena token dari rubrik dan konteks tidak perlu diproses ulang.
* **Return on Investment (ROI):** Bagi institusi, investasi awal untuk pengembangan akan dengan cepat tergantikan oleh efisiensi jam kerja dosen yang dapat dialihkan ke kegiatan riset atau pengajaran yang lebih berdampak. Untuk jalur komersialisasi, model *subscription* bulanan per institusi dapat memberikan *recurring revenue* yang tinggi dan profitabilitas cepat.

## 8. Project Risk
Beberapa risiko utama proyek beserta rencana mitigasinya:
1. **Risiko Akurasi Penilaian AI (Halusinasi/Bias):** AI mungkin salah menginterpretasi jawaban mahasiswa yang kurang terstruktur atau memiliki aksen yang kental.
   * *Mitigasi:* Menerapkan model *Speech-to-Text* lokal dengan akurasi tinggi untuk *Aksen Indonesia/Inggris lokal*. Menyediakan fitur "*Manual Override*" di mana dosen dapat memutar ulang rekaman suara mahasiswa dan merevisi nilai yang diberikan AI melalui *dashboard*.
2. **Risiko Reliabilitas Infrastruktur saat Beban Puncak (Peak Load):** Ratusan koneksi WebSocket dan *streaming* audio bersamaan saat periode ujian dapat menyebabkan *server crash* atau latensi tinggi.
   * *Mitigasi:* Menggunakan arsitektur *scalable* berorientasi *cloud* dengan *load balancer* dan optimalisasi *Prefix KV Cache* untuk mengurangi beban CPU pada *engine* LLM.
3. **Risiko Privasi dan Keamanan Data Siswa:** Penanganan rekaman suara dan metrik evaluasi personal mahasiswa.
   * *Mitigasi:* Penerapan enkripsi *database* dan kepatuhan penuh terhadap standar kebijakan privasi data institusi akademik yang berlaku.
