export const DEFAULT_STATE = {
  assessments: [],
  submissions: [],
};

export const DEFAULT_QUESTION_COUNT = 5;

export const FALLBACK_KEYWORDS = ["konsep", "alasan", "contoh", "hubungan"];

export const STOPWORDS = new Set([
  "yang",
  "dan",
  "atau",
  "untuk",
  "dengan",
  "dalam",
  "pada",
  "dari",
  "ke",
  "di",
  "sebagai",
  "adalah",
  "serta",
  "siswa",
  "mampu",
  "dapat",
  "secara",
  "contoh",
  "rubrik",
  "penilaian",
  "materi",
  "topik",
  "kompetensi",
  "jawaban",
]);

export const FALLBACK_QUESTION_STEMS = {
  Dasar: [
    "Jelaskan pengertian utama dari {topic} dengan bahasa sendiri.",
    "Sebutkan dua konsep penting dalam {topic} dan jelaskan hubungannya.",
    "Berikan contoh sederhana yang menunjukkan pemahamanmu tentang {keyword}.",
    "Apa bagian dari {topic} yang paling mudah keliru dipahami? Jelaskan.",
  ],
  Menengah: [
    "Jelaskan {topic} dengan mengaitkan konsep {keyword} dan alasan pendukungnya.",
    "Bandingkan dua ide penting dalam {topic}, lalu jelaskan mana yang paling menentukan.",
    "Gunakan contoh konkret untuk membuktikan bahwa kamu memahami {keyword}.",
    "Jika ada teman yang salah memahami {topic}, bagaimana kamu memperbaiki penjelasannya?",
    "Apa konsekuensi dari konsep {keyword} terhadap penerapan {topic}?",
  ],
  Lanjutan: [
    "Analisis keterkaitan {topic}, {keyword}, dan indikator kompetensi yang diuji.",
    "Evaluasi sebuah situasi nyata yang berkaitan dengan {topic}, lalu berikan argumenmu.",
    "Bangun penjelasan bertahap tentang {keyword} beserta keterbatasan contohnya.",
    "Ajukan kesimpulan tentang {topic} dan pertahankan dengan bukti konseptual.",
    "Sintesis beberapa konsep dalam {topic} menjadi penjelasan yang utuh dan kritis.",
  ],
};
