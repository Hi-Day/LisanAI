const { OpenRouterProvider } = require("../ai/openrouter-provider");

const MAX_TRANSCRIPTS_PER_CALL = 20;
const MAX_CHARS_PER_TRANSCRIPT = 12000;

function normalizeToken(token) {
  return String(token || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?;:()[\]{}"'“”‘’…—–-]/g, "")
    .trim();
}

function tokenize(text) {
  return String(text || "")
    .normalize("NFKC")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

/**
 * Conservative provenance gate.
 * Every content token in the polished transcript must occur in the raw
 * transcript in the same order. This prevents the polisher from inventing
 * facts, terminology, examples, or claims. It may remove filler/noise and
 * normalize punctuation/spacing, but it cannot add or reorder content.
 */
function preservesSourceOrder(raw, polished) {
  const source = tokenize(raw);
  const target = tokenize(polished);
  if (target.length === 0) return source.length === 0;
  if (target.length > source.length) return false;

  let cursor = 0;
  for (const token of target) {
    let found = -1;
    for (let i = cursor; i < source.length; i += 1) {
      if (source[i] === token) {
        found = i;
        break;
      }
    }
    if (found < 0) return false;
    cursor = found + 1;
  }
  return true;
}

function cleanFallback(raw) {
  // Safe fallback: only normalize whitespace. Never invent or delete content.
  return String(raw || "").replace(/\s+/g, " ").trim();
}

function parseJsonObject(raw) {
  const text = String(raw || "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

/**
 * Polish browser STT transcripts before assessment.
 *
 * This is deliberately separate from the raw transcript. The raw transcript
 * remains the source of record. The LLM may remove obvious speech-recognition
 * noise/fillers and normalize punctuation, but a provenance gate rejects any
 * output that adds or reorders lexical content.
 */
async function polishTranscripts(answers, options = {}) {
  const rawAnswers = (Array.isArray(answers) ? answers : []).map((answer) => String(answer || ""));
  const metadata = rawAnswers.map((rawTranscript, index) => ({
    index,
    rawTranscript,
    cleanTranscript: cleanFallback(rawTranscript),
    polishing: "fallback",
    verified: true,
  }));

  const candidates = rawAnswers
    .map((rawTranscript, index) => ({ index, rawTranscript: rawTranscript.trim() }))
    .filter((item) => item.rawTranscript)
    .slice(0, MAX_TRANSCRIPTS_PER_CALL);

  const provider = options.provider || new OpenRouterProvider();
  if (!provider.hasApiKey() || candidates.length === 0) {
    return { answers: metadata.map((item) => item.cleanTranscript), metadata };
  }

  const payload = candidates.map(({ index, rawTranscript }) => ({
    index,
    transcript: rawTranscript.slice(0, MAX_CHARS_PER_TRANSCRIPT),
  }));

  const raw = await provider.generate({
    model: options.model || process.env.OPENROUTER_MODEL,
    temperature: 0,
    maxTokens: Math.min(3000, Math.max(600, candidates.length * 120)),
    systemPrompt: [
      "You are a conservative speech-transcript polisher for an academic oral assessment.",
      "Your job is NOT to rewrite, summarize, correct, infer, or improve the student's knowledge.",
      "Remove only obvious speech-recognition artifacts such as duplicated fragments, stutters, filler words, accidental punctuation, and clearly unrelated ambient fragments.",
      "Preserve every substantive word, claim, example, number, technical term, negation, uncertainty, and sequence of ideas.",
      "Do not add any word that is not present in the source transcript.",
      "Do not reorder words.",
      "If unsure whether text is noise or student content, KEEP IT.",
      "Return strict JSON only: {\"transcripts\":[{\"index\":0,\"cleanTranscript\":\"...\"}]}",
    ].join("\n"),
    userMessage: JSON.stringify({
      task: "Polish these transcripts conservatively.",
      transcripts: payload,
    }),
    schemaHint: "Strict JSON object with a transcripts array.",
  });

  const parsed = parseJsonObject(raw);
  const polished = new Map(
    Array.isArray(parsed?.transcripts)
      ? parsed.transcripts.map((item) => [Number(item?.index), String(item?.cleanTranscript || "")])
      : []
  );

  for (const item of metadata) {
    if (!polished.has(item.index)) continue;
    const candidate = polished.get(item.index).trim();
    if (!candidate || !preservesSourceOrder(item.rawTranscript, candidate)) {
      item.cleanTranscript = cleanFallback(item.rawTranscript);
      item.polishing = "rejected";
      item.verified = false;
      continue;
    }
    item.cleanTranscript = candidate;
    item.polishing = "llm";
    item.verified = true;
  }

  return {
    answers: metadata.map((item) => item.cleanTranscript),
    metadata,
  };
}

module.exports = { polishTranscripts, preservesSourceOrder, cleanFallback };
