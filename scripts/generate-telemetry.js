const http = require("http");

const BASE_URL = "http://127.0.0.1:4173";

function postJson(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        const setCookie = res.headers["set-cookie"];
        let parsed = {};
        try {
          parsed = JSON.parse(responseBody);
        } catch (e) {
          // not json
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          setCookie,
          body: parsed
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function run() {
  console.log("Memulai simulasi trafik telemetri...");
  
  // 1. Login Guru
  const loginRes = await postJson("/api/auth", {
    action: "login",
    payload: {
      email: "guru@demo.com",
      password: "password123"
    }
  });

  if (loginRes.statusCode !== 200) {
    console.error("Gagal login:", loginRes.body);
    process.exit(1);
  }

  console.log("Berhasil login sebagai guru@demo.com");
  
  // Ambil token cookie dan CSRF token
  const setCookie = loginRes.setCookie;
  if (!setCookie) {
    console.error("Set-Cookie header tidak ditemukan.");
    process.exit(1);
  }
  const cookieHeader = setCookie.map(c => c.split(";")[0]).join("; ");
  const csrfToken = loginRes.body.csrfToken;

  const authHeaders = {
    Cookie: cookieHeader,
    "X-CSRF-Token": csrfToken
  };

  // List topik untuk rekomendasi kompetensi / rubrik
  const topics = [
    "Siklus Air & Presipitasi",
    "Gaya Gravitasi & Gerak Planet",
    "Struktur Sel Hewan & Tumbuhan",
    "Pancasila sebagai Dasar Negara",
    "Teks Eksposisi & Argumentasi",
    "Greeting & Introduction in English",
    "Konsep Algoritma & Flowchart",
    "Sistem Persamaan Linear Dua Variabel",
    "Kemerdekaan Indonesia 1945",
    "Ekosistem Terumbu Karang"
  ];

  // Jalankan beberapa request secara berurutan dengan jeda singkat
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    console.log(`\n[Request ${i + 1}/${topics.length}] Memproses topik: ${topic}`);

    // Call 1: recommend-assessment-config
    console.log("-> Memanggil recommend-assessment-config...");
    const recommendRes = await postJson("/api/assessment", {
      action: "recommend-assessment-config",
      payload: { topic, difficulty: i % 2 === 0 ? "Menengah" : "Lanjutan" }
    }, authHeaders);
    console.log(`   Status: ${recommendRes.statusCode} (${recommendRes.body.recommendation ? 'Sukses' : 'Gagal'})`);

    // Jeda 100ms
    await new Promise(resolve => setTimeout(resolve, 100));

    // Call 2: generate-questions
    console.log("-> Memanggil generate-questions...");
    const genRes = await postJson("/api/assessment", {
      action: "generate-questions",
      payload: {
        topic,
        outcomes: recommendRes.body.recommendation?.outcomes || "Memahami prinsip dasar.",
        rubric: recommendRes.body.recommendation?.rubric || "Kesesuaian isi: 100%",
        difficulty: i % 2 === 0 ? "Menengah" : "Lanjutan",
        count: 3
      }
    }, authHeaders);
    console.log(`   Status: ${genRes.statusCode} (${genRes.body.questions ? `Sukses, generate ${genRes.body.questions.length} soal` : 'Gagal'})`);

    // Jeda 100ms
    await new Promise(resolve => setTimeout(resolve, 100));

    // Call 3: evaluate (simulasi siswa menjawab)
    if (genRes.body.questions && genRes.body.questions.length > 0) {
      console.log("-> Memanggil evaluate (simulasi penilaian)...");
      const evalRes = await postJson("/api/assessment", {
        action: "evaluate",
        payload: {
          assessment: {
            id: `a-${Date.now()}`,
            topic,
            rubric: recommendRes.body.recommendation?.rubric || "Kesesuaian isi: 100%",
            questions: genRes.body.questions
          },
          answers: genRes.body.questions.map((q, idx) => `Jawaban simulasi siswa ke-${idx + 1} untuk soal: ${q.prompt}`),
          studentName: `Siswa Simulasi ${i + 1}`
        }
      }, authHeaders);
      console.log(`   Status: ${evalRes.statusCode} (Skor: ${evalRes.body.evaluation?.finalScore || 0})`);
    }

    // Jeda 200ms sebelum topik berikutnya
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log("\nSimulasi trafik selesai! Silakan refresh dashboard admin untuk melihat log.");
}

run().catch(console.error);
