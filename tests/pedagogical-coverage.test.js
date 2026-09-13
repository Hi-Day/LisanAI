const assert = require("node:assert/strict");
const test = require("node:test");

// Gateway picks its provider lazily from AI_PROVIDER; mock keeps this offline.
process.env.AI_PROVIDER = "mock";

const gateway = require("../server/ai/gateway");
const { MockProvider } = require("../server/ai/mock-provider");
const { streamCoverageQuestion } = require("../server/pedagogical-coverage");

/**
 * Deterministic, offline model stub. Emits the content through onToken (the
 * gateway's chunk callback) before resolving, mirroring a streaming provider.
 */
function stubModelContent(content) {
  const provider = gateway.getProvider();
  assert.ok(provider instanceof MockProvider, "AI_PROVIDER=mock must select MockProvider");
  provider.generate = async (request) => {
    const chunks = String(content).match(/.{1,24}/gs) || [];
    for (const chunk of chunks) request.onToken?.(chunk);
    return content;
  };
  return () => {
    delete provider.generate;
  };
}

const PAYLOAD = {
  topic: "Fotosintesis",
  outcomes: ["Siswa mampu menjelaskan proses fotosintesis"],
  criterion: "Menjelaskan peran klorofil",
  questions: [],
};

test("streamCoverageQuestion: normalizes the parsed question and streams chunks", async () => {
  gateway.resetProvider();
  const content = JSON.stringify({
    question: {
      prompt: "Jelaskan peran klorofil dalam fotosintesis!",
      focus: "Peran klorofil",
      outcome: "Siswa mampu menjelaskan proses fotosintesis",
      rubric: "Klorofil 40%\nCahaya 35%\nAir 25%",
      ideal: "Klorofil menyerap cahaya untuk mengubah air dan CO2 menjadi glukosa.",
      criteria: ["Menjelaskan peran klorofil"],
    },
  });
  const restore = stubModelContent(content);

  try {
    const chunks = [];
    const question = await streamCoverageQuestion(PAYLOAD, (chunk) => chunks.push(chunk));

    assert.equal(question.prompt, "Jelaskan peran klorofil dalam fotosintesis!");
    assert.equal(question.focus, "Peran klorofil");
    assert.equal(question.rubric, "Klorofil 40%\nCahaya 35%\nAir 25%");
    assert.deepEqual(question.criteria, [PAYLOAD.criterion]);
    assert.ok(String(question.id).startsWith("q-ai-"));

    assert.ok(chunks.length > 1, "chunks must stream through onChunk");
    assert.equal(chunks.join(""), content);
  } finally {
    restore();
  }
});

test("streamCoverageQuestion: unusable model output keeps the coverage error", async () => {
  // No JSON object at all -> gateway parsing fails.
  const restoreGarbage = stubModelContent("Maaf, saya tidak dapat membuat soal.");
  try {
    await assert.rejects(
      () => streamCoverageQuestion(PAYLOAD, null),
      /AI tidak menghasilkan soal tambahan yang valid\./
    );
  } finally {
    restoreGarbage();
  }

  // Valid JSON, but no `question` payload to derive a question from.
  const restoreNoQuestion = stubModelContent(JSON.stringify({ notes: "tidak ada soal" }));
  try {
    await assert.rejects(
      () => streamCoverageQuestion(PAYLOAD, null),
      /AI tidak menghasilkan soal tambahan yang valid\./
    );
  } finally {
    restoreNoQuestion();
  }
});
