/**
 * Response parser — turns raw model content into canonical evaluation output.
 */
function stripCodeFences(content) {
  return String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseJson(content) {
  const trimmed = stripCodeFences(content);
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Respons model bukan JSON valid");
  }
}

/**
 * Parse response content into a canonical evaluation object.
 * Does NOT compute finalScore (server side). Recognizes both harness
 * ({ criteria }) and legacy ({ questionScores }) shapes.
 */
async function parse(content, _opts = {}) {
  const parsed = parseJson(content);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Hasil parsing model bukan object");
  }
  return parsed;
}

module.exports = { parse, parseJson, stripCodeFences };