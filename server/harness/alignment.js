const { callOpenRouter, streamOpenRouter } = require("../openrouter");
const { parseJson } = require("../ai/response-parser");
const { parseRubricText } = require("./plugins/rubric");

// ---------------------------------------------------------------------------
// Soal ↔ Rubrik Alignment Harness
// ---------------------------------------------------------------------------
// Tugas: menjaga agar setiap soal hanya dinilai terhadap kriteria rubrik yang
// BENAR-BENAR diukur oleh substansi soal tersebut. Kalibrasi dilakukan via AI
// (menentukan subset kriteria per soal, dan bila perlu menulis ulang substansi
// soal agar selaras rubrik), lalu selalu ditutup oleh enforcement deterministik
// sehingga penilaian tidak "under-estimate": soal "sebutkan" tidak dihukum oleh
// kriteria yang butuh analisis/sebab-akibat/penerapan yang tidak pernah diminta.

/** Parse rubric teacher menjadi daftar kriteria terstruktur. */
function parseRubricCriteria(payload) {
  const rubric = payload && payload.rubric;
  if (rubric && Array.isArray(rubric.criteria)) {
    return rubric.criteria
      .map((c, i) => ({
        id: String(c.id || c.criterionId || `k${i + 1}`),
        name: String(c.name || c.label || c.id || `Kriteria ${i + 1}`).trim(),
        weight: Number(c.weight || 0),
      }))
      .filter((c) => c.name);
  }
  if (Array.isArray(rubric)) {
    return rubric
      .map((c, i) => ({
        id: String(c.id || c.criterionId || `k${i + 1}`),
        name: String(c.name || c.label || c.id || `Kriteria ${i + 1}`).trim(),
        weight: Number(c.weight || 0),
      }))
      .filter((c) => c.name);
  }
  if (typeof rubric === "string" && rubric.trim()) {
    return parseRubricText(rubric).map((c) => ({
      id: c.id,
      name: c.name,
      weight: Number(c.weight || 0),
    }));
  }
  return [];
}

function normalizeCriterionName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cocokkan nama kriteria yang ditulis model/soal dengan kriteria rubrik. */
function matchCriterionId(candidate, criteria) {
  const target = normalizeCriterionName(candidate);
  if (!target) return null;
  for (const c of criteria) {
    const name = normalizeCriterionName(c.name);
    if (name === target || name.includes(target) || target.includes(name)) return c.id;
  }
  return null;
}

/** Bobot overlap kata antara prompt/fokus dan nama kriteria. */
function criterionOverlap(a, b) {
  const tokensA = new Set(normalizeCriterionName(a).split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(normalizeCriterionName(b).split(" ").filter((t) => t.length > 2));
  let shared = 0;
  tokensA.forEach((t) => {
    if (tokensB.has(t)) shared += 1;
  });
  return shared;
}

/** Pilih kriteria terdekat dgn prompt/fokus; seri → bobot & id terkecil. */
function bestFittedCriterion(prompt, focus, outcome, criteria) {
  const source = `${prompt || ""} ${focus || ""} ${outcome || ""}`;
  let best = null;
  let bestScore = -1;
  for (const c of criteria) {
    const score = criterionOverlap(source, c.name);
    if (
      score > bestScore ||
      (score === bestScore &&
        best &&
        (Number(c.weight) > Number(best.weight) ||
          (Number(c.weight) === Number(best.weight) && String(c.id).localeCompare(String(best.id)) < 0)))
    ) {
      bestScore = score;
      best = c;
    }
  }
  if (!best) {
    criteria = criteria.slice().sort(
      (a, b) => Number(b.weight) - Number(a.weight) || String(a.id).localeCompare(String(b.id))
    );
    best = criteria[0];
  }
  return best;
}

/**
 * Bangun teks rubrik per-soal hanya dari SUBSET kriteria yang diukur soal
 * tsb, dengan bobot dinormalisasi ulang menjadi total 100%. Soal "sebutkan"
 * sehingga tidak akan dinilai/ditampilkan sebagai harus memenuhi sebab-akibat.
 */
function buildQuestionRubricText(question, allCriteria) {
  const ids = (question.criteria || []).map((c) => String(typeof c === "object" ? c.id || c.name : c));
  const subset = (allCriteria || []).filter((c) => ids.includes(String(c.id)));
  if (subset.length === 0) return "";
  const sum = subset.reduce((acc, c) => acc + Number(c.weight || 0), 0);
  return subset
    .map((c) => `${c.name}: ${sum > 0 ? Math.round((Number(c.weight) / sum) * 100) : 100 / subset.length}%`)
    .join("\n");
}

/**
 * Enforcement deterministik: setiap soal hanya boleh memetakan ke kriteria
 * rubrik yang benar-benar diukur soal tsb; seluruh kriteria wajib tercakup.
 * Sekaligus men-stempel teks rubrik per-soal (subset) agar konsisten dgn skor.
 */
function enforceRubricAlignment(questions, payload) {
  const criteria = parseRubricCriteria(payload) || [];
  if (criteria.length === 0) return questions;
  const byId = new Map(criteria.map((c) => [c.id, c.name]));
  const globalRubric = typeof payload?.rubric === "string" ? String(payload.rubric).trim() : "";

  // Step 1 — tentukan subset kriteria per soal (dari deklarasi model/soal,
  // atau best-fit konten bila soal tidak mendeklarasikan apa pun).
  const mapped = (questions || []).map((question) => {
    if (!question) return question;
    if (!String(question.prompt || "").trim()) return { ...question, criteria: [] };
    const declared = Array.isArray(question.criteria) ? question.criteria.map(String) : [];
    const ids = [];
    for (const d of declared) {
      const id = matchCriterionId(d, criteria);
      if (id && !ids.includes(id)) ids.push(id);
    }
    if (ids.length === 0) {
      const fit = bestFittedCriterion(question.prompt, question.focus, question.outcome, criteria);
      if (fit) ids.push(fit.id);
    }
    return { ...question, criteria: ids };
  });

  // Step 2 — coverage: kriteria yang belum dipetakan diberikan ke soal yang
  // paling cocok secara KONTEN. Bila tidak ada yang cocok, biarkan terbuka
  // supaya UI memperingatkan — bukan menghukum siswa atas kompetensi yang tak
  // ditanyakan.
  const covered = new Set();
  mapped.forEach((q) => (q.criteria || []).forEach((id) => covered.add(String(id))));
  for (const c of criteria) {
    if (covered.has(c.id)) continue;
    const target = mapped
      .filter((q) => String(q.prompt || "").trim())
      .map((q) => ({ q, score: criterionOverlap(`${q.prompt} ${q.focus || ""} ${q.outcome || ""}`, c.name) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || String(a.q.id).localeCompare(String(b.q.id)))[0];
    if (!target) continue;
    target.q.criteria.push(c.id);
    covered.add(c.id);
  }

  // Step 3 — finalisasi: ubah id → { id, name } dan (hanya untuk rubrik
  // bawaan global) tulis teks rubrik per-soal dari subset yang benar diukur.
  // Rubrik khusus yang sengaja ditulis guru tidak ditimpa.
  return mapped.map((question) => {
    if (!question || !Array.isArray(question.criteria)) return question;
    const questionRubric = String(question.rubric || "").trim();
    const isDefaultRubric = !questionRubric || (globalRubric.length > 0 && questionRubric === globalRubric);
    const next = {
      ...question,
      criteria: question.criteria.map((id) => ({ id, name: byId.get(id) || id })),
    };
    if (isDefaultRubric) {
      const subsetText = buildQuestionRubricText(next, criteria);
      if (subsetText) next.rubric = subsetText;
    }
    return next;
  });
}

// ---------------------------------------------------------------------------
// Kalibrasi berbasis AI
// ---------------------------------------------------------------------------

function buildAlignMessages(payload, questions) {
  const rubricCriteria = parseRubricCriteria(payload) || [];
  const current = (questions || []).map((q, index) => ({
    index,
    prompt: String(q.prompt || "").trim(),
    focus: String(q.focus || "").trim(),
    criteria: Array.isArray(q.criteria)
      ? q.criteria.map((c) => (typeof c === "object" ? c.name || c.id : c))
      : [],
  }));
  return [
    {
      role: "user",
      content: JSON.stringify({
        tugas: "Kalibrasi penyelarasan soal dengan rubrik agar penilaian koheren dengan substansi setiap soal.",
        topik: payload.topic,
        learning_outcome: payload.outcomes,
        rubrik: payload.rubric,
        kriteria_rubrik_yang_tersedia: rubricCriteria.map((c) => ({
          id: c.id,
          nama: c.name,
          bobot: c.weight,
        })),
        aturan_penyelarasan: [
          "Untuk setiap soal, tentukan SUBSET kriteria rubrik yang BENAR-BENAR diukur oleh substansi soal itu (field criteria).",
          "Soal bertipe 'sebutkan/identifikasi' HANYA boleh memetakan kriteria yang terukur dari penyebutan (mis. ketepatan konsep) dan DILARANG memetakan kriteria yang butuh penjelasan/sebab-akibat/analisis/penerapan, kecuali soal benar-benar memintanya.",
          "Soal tidak boleh menanyakan hal yang tidak diukur oleh kriteria mana pun.",
          "Jika sebuah soal tidak dapat mengukur kriteria mana pun karena substansinya tidak selaras, TULIS ULANG prompt-nya menjadi SATU substansi yang mencerminkan kriteria rubrik tertentu (tetap satu pertanyaan tunggal).",
          "Seluruh kriteria dalam kriteria_rubrik_yang_tersedia wajib tercakup oleh minimal satu soal.",
          "Pertahankan jumlah dan urutan soal persis sama dengan input.",
        ].join(". "),
        jumlah_dan_urutan_hasil: "harus sama persis dengan input",
        questions: current,
      }),
    },
  ];
}

const ALIGN_SCHEMA =
  'Format: {"questions":[{"index":0,"prompt":"...","focus":"...","criteria":["nama_kriteria1","nama_kriteria2"],"reason":"..."}]}. Jumlah dan urutan questions HARUS sama dengan input. criteria hanya boleh memakai nama kriteria pada kriteria_rubrik_yang_tersedia.';

function mergeCalibration(original, calibrated) {
  const out = (original || []).map((q) => ({ ...q }));
  if (!Array.isArray(calibrated || [])) return out;
  for (const entry of calibrated) {
    const idx = Number(entry?.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= out.length) continue;
    if (typeof entry.prompt === "string" && String(entry.prompt).trim()) {
      out[idx].prompt = String(entry.prompt).trim();
    }
    if (typeof entry.focus === "string" && entry.focus.trim()) {
      out[idx].focus = String(entry.focus).trim();
    }
    if (Array.isArray(entry.criteria)) {
      out[idx].criteria = entry.criteria.map(String).filter(Boolean);
    }
  }
  return out;
}

/**
 * Kalibrasi penuh: AI menentukan subset kriteria per soal (dan bila perlu
 * memperbaiki substansi soal), lalu enforcement deterministik menutup celah
 * coverage/kesalahan penulisan nama kriteria. Jika AI tidak tersedia, hasil
 * collision tetap ditutup deterministik — penilaian TIDAK pernah under-estimate.
 */
async function calibrateSoalRubrik(payload) {
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  if (questions.length === 0) return enforceRubricAlignment(questions, payload);

  let calibrated = null;
  try {
    calibrated = await callOpenRouter(buildAlignMessages(payload, questions), ALIGN_SCHEMA, {
      tenantId: payload.tenantId,
      userId: payload.userId,
      action: "align-rubric",
    });
  } catch (err) {
    console.error("Gagal kalibrasi AI, memakai alignment deterministik:", err.message);
  }

  const merged = mergeCalibration(questions, calibrated?.questions);
  return enforceRubricAlignment(merged, payload);
}

/** Versi streaming untuk UI wizard (SSE). */
async function streamCalibrateSoalRubrik(payload, onChunk) {
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  let content = "";
  let calibrated = null;
  try {
    const { content: raw } = await streamOpenRouter(
      buildAlignMessages(payload, questions),
      ALIGN_SCHEMA,
      { tenantId: payload.tenantId, userId: payload.userId, action: "align-rubric" },
      onChunk
    );
    content = raw;
    calibrated = parseJson(content);
  } catch (err) {
    console.error("Gagal streaming kalibrasi AI, memakai alignment deterministik:", err.message);
  }

  const merged = mergeCalibration(questions, calibrated?.questions);
  return enforceRubricAlignment(merged, payload);
}

module.exports = {
  name: "rubricAlignment",
  version: "1.0.0",
  parseRubricCriteria,
  enforceRubricAlignment,
  calibrateSoalRubrik,
  streamCalibrateSoalRubrik,
  buildQuestionRubricText,
  mergeCalibration,
  /**
   * Plugin hook — menjaga alignment saat evaluasi dijalankan. Memastikan
   * mapping soal↔rubrik tetap valid dan konsisten dengan kriteria yang benar
   * diukur soal; menandai kriteria yang sama sekali tidak diukur soal mana pun
   * (biarkan evaluator mengabaikannya, jangan menghukum siswa).
   */
  async before(context) {
    const assessment = context.assessment;
    const questions = Array.isArray(assessment && assessment.questions) ? assessment.questions : [];
    const rubric = context.rubric || (assessment && assessment.rubric);
    if (!questions.length || !rubric) return context;

    const criteria = Array.isArray(rubric) ? rubric : parseRubricCriteria({ rubric });
    if (!criteria.length) return context;

    // Anotasi ulang non-destruktif: bila sebuah soal belum punya mapping,
    // berikan kriteria terdekat sehingga evaluasi tidak "all-criteria apply".
    const covered = new Set();
    for (const q of questions) {
      const ids = Array.isArray(q.criteria) ? q.criteria.map((c) => String(typeof c === "object" ? c.id || c.name : c)) : [];
      const valid = ids.filter((id) => criteria.some((c) => c.id === id || c.name === id)).slice(0, 3);
      if (valid.length) {
        valid.forEach((id) => covered.add(id));
        q.criteria = valid.map((id) => ({ id, name: criteria.find((c) => c.id === id || c.name === id).name }));
      } else {
        const fit = bestFittedCriterion(q.prompt, q.focus, q.outcome, criteria);
        if (fit) {
          covered.add(fit.id);
          q.criteria = [{ id: fit.id, name: fit.name }];
        }
      }
    }

    const uncovered = criteria.filter((c) => !covered.has(c.id)).map((c) => c.id);

    context.trace &&
      context.trace.event("RUBRIC_ALIGNMENT", {
        totalCriteria: criteria.length,
        coveredCriteria: covered.size,
        uncoveredCriteria: uncovered,
        questionCount: questions.length,
      });
    context.rubricAlignment = {
      active: true,
      covered: [...covered],
      uncovered,
    };
    return context;
  },
};