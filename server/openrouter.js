const { OPENROUTER_URL } = require("./config");
const { getDb } = require("./database");
const crypto = require("node:crypto");

async function callOpenRouter(messages, schemaHint, context = {}) {
  const startTime = Date.now();
  const tenantId = context.tenantId || "system";
  const userId = context.userId || "system";
  const action = context.action || "unknown";
  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

  let promptTokens = 0;
  let completionTokens = 0;
  let responseData = null;
  let errorMsg = null;
  let status = "success";
  let content = null;

  try {
    const hasApiKey = !!process.env.OPENROUTER_API_KEY && 
                      process.env.OPENROUTER_API_KEY !== "mock-key" && 
                      !process.env.OPENROUTER_API_KEY.includes("your_api_key");

    if (!hasApiKey) {
      // Simulate API latency delay
      const simulatedDelay = 800 + Math.floor(Math.random() * 1200);
      await new Promise(resolve => setTimeout(resolve, simulatedDelay));

      if (action === "generate-questions") {
        const payload = JSON.parse(messages[0].content);
        const count = payload.jumlah_soal || 5;
        const questions = [];
        for (let i = 1; i <= count; i++) {
          questions.push({
            prompt: `Bagaimana pemahaman Anda tentang ${payload.topik} pada aspek ${payload.learning_outcome ? 'kompetensi' : 'umum'} ke-${i}?`,
            focus: payload.topik,
            ideal: `Penjelasan yang komprehensif mengenai konsep ${payload.topik} sesuai rubrik evaluasi.`
          });
        }
        content = JSON.stringify({ questions });
      } else if (action === "recommend-assessment-config") {
        const payload = JSON.parse(messages[0].content);
        content = JSON.stringify({
          outcomes: `1. Siswa mampu memahami prinsip dasar dari ${payload.topic}.\n2. Siswa mampu menerapkan konsep ${payload.topic} dalam studi kasus lisan.\n3. Siswa dapat menyusun argumen lisan yang terstruktur.`,
          rubric: `Kelancaran Berbicara: 30%\nKesesuaian Materi & Konsep: 40%\nKetepatan Tata Bahasa & Diksi: 30%`
        });
      } else if (action === "evaluate") {
        const payload = JSON.parse(messages[0].content);
        const questionScores = (payload.qa_pairs || []).map((pair, idx) => {
          const score = 75 + Math.floor(Math.random() * 21); // 75 - 95
          return {
            question: pair.question,
            answer: pair.student_answer,
            score,
            matched: ["konsep utama", "diksi tepat"],
            strengths: ["Penyampaian lisan cukup lancar dan terstruktur", "Penggunaan kata kunci yang tepat"],
            gaps: score < 85 ? ["Argumen pendukung dapat diperdalam lagi dengan contoh konkret"] : []
          };
        });
        const finalScore = Math.round(questionScores.reduce((acc, q) => acc + q.score, 0) / questionScores.length);
        content = JSON.stringify({
          finalScore,
          feedback: `Evaluasi Lisan: Siswa menunjukkan pemahaman yang baik tentang ${payload.topik || 'materi'}. Struktur kalimat sudah bagus, hanya perlu sedikit penguatan pada kedalaman contoh.`,
          questionScores
        });
      } else if (action === "improve-questions") {
        const payload = JSON.parse(messages[0].content);
        const questions = (payload.questions || []).map((q, i) => ({
          prompt: `${q.prompt} (Disempurnakan oleh AI)`,
          focus: q.focus,
          ideal: q.ideal
        }));
        content = JSON.stringify({ questions });
      } else {
        content = JSON.stringify({});
      }

      promptTokens = 350 + Math.floor(Math.random() * 200);
      completionTokens = 180 + Math.floor(Math.random() * 150);
    } else {
      // Real API Call
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://127.0.0.1:4173",
          "X-Title": "Lisan.ai",
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.25,
          max_tokens: 4000,
          reasoning: {
            effort: "none",
            exclude: true,
          },
          messages: [
            {
              role: "system",
              content:
                "Anda adalah evaluator pendidikan berbahasa Indonesia. Balas hanya JSON valid tanpa markdown. " +
                schemaHint,
            },
            ...messages,
          ],
        }),
      });

      responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(responseData.error?.message || `OpenRouter error ${response.status}`);
      }

      content = responseData.choices?.[0]?.message?.content;
      if (!content) throw new Error("Respons model kosong");

      promptTokens = responseData.usage?.prompt_tokens || 0;
      completionTokens = responseData.usage?.completion_tokens || 0;
    }

    return parseJsonContent(content);
  } catch (err) {
    status = "error";
    errorMsg = err.message;
    throw err;
  } finally {
    const latencyMs = Date.now() - startTime;
    let cacheSavingsTokens = 0;

    // Simulate Prefix KV Cache savings based on proposal's design criteria:
    // If the call succeeds and has a significant system prompt/rubric (promptTokens > 300),
    // and there was another successful AI call by the same tenant in the last 15 minutes,
    // we consider the prefix prompt cached (saving ~65% of input tokens).
    if (status === "success" && promptTokens > 300) {
      try {
        const db = getDb();
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const recentCall = await db.get(
          "SELECT id FROM ai_logs WHERE tenant_id = ? AND action = ? AND status = 'success' AND created_at > ? LIMIT 1",
          tenantId,
          action,
          fifteenMinutesAgo
        );
        if (recentCall) {
          cacheSavingsTokens = Math.round(promptTokens * 0.65);
        }
      } catch (dbErr) {
        console.error("Gagal memeriksa status cache:", dbErr);
      }
    }

    // Save telemetry to the database asynchronously
    try {
      const db = getDb();
      await db.run(
        `INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, error_message, cache_savings_tokens, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        crypto.randomUUID().replace(/-/g, ""),
        tenantId,
        userId,
        action,
        model,
        promptTokens,
        completionTokens,
        promptTokens + completionTokens,
        latencyMs,
        status,
        errorMsg,
        cacheSavingsTokens,
        new Date().toISOString()
      );
    } catch (dbErr) {
      console.error("Gagal menyimpan log observabilitas:", dbErr);
    }
  }
}

function parseJsonContent(content) {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Respons model bukan JSON valid");
  }
}

module.exports = {
  callOpenRouter,
};
