const { validateRubric } = require("../validator");

/**
 * Best-effort parse of a free-text rubric (e.g. "Akurasi 40%, Kelengkapan 60%")
 * into structured criteria, normalized so weights sum to 1.
 */
function parseRubricText(text) {
  if (!text) return [];
  const items = String(text)
    .split(/[;\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const criteria = [];
  for (const item of items) {
    const match = item.match(/^(.+?)\s*[-:]?\s*(\d+(?:\.\d+)?)\s*%?$/);
    if (!match) continue;
    const name = (match[1] || "").trim().replace(/[-:]\s*$/, "").trim();
    const weight = Number(match[2]) / 100;
    criteria.push({ id: slugify(name) || `c${criteria.length + 1}`, name: name || `Criterion ${criteria.length + 1}`, weight, scale: 100 });
  }
  if (criteria.length === 0) {
    // Fallback single criterion so evaluation remains valid.
    return [{ id: "overall", name: "Penilaian Keseluruhan", weight: 1, scale: 100 }];
  }
  return criteria;
}

function slugify(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug || `c${pluginSlugCounter()}`;
}

let slugCounter = 0;
function pluginSlugCounter() {
  slugCounter += 1;
  return `x${slugCounter}`;
}

module.exports = {
  name: "rubric",
  version: "1.0.0",
  parseRubricText,
  async before(context) {
    let rubric = context.rubric || null;
    if (!rubric && context.input && context.input.rubric) {
      rubric = context.input.rubric;
    }
    if (!rubric && context.assessment && context.assessment.rubric) {
      rubric = {
        id: "rubric-v1",
        criteria: parseRubricText(context.assessment.rubric),
      };
    }
    if (!rubric || !Array.isArray(rubric.criteria)) {
      throw new Error("Rubric tidak tersedia untuk evaluasi harness");
    }
    const check = validateRubric(rubric);
    if (!check.valid) {
      throw new Error(`Rubric invalid: ${check.issues.join("; ")}`);
    }
    context.rubric = rubric;
    context.trace && context.trace.event("RUBRIC_LOADED", { rubricId: rubric.id || "rubric-v1" });
    context.trace && context.trace.setContext("rubricId", rubric.id || "rubric-v1");
    return context;
  },
};