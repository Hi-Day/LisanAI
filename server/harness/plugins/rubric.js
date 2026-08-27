const { validateRubric } = require("../validator");

/**
 * Best-effort parse of a free-text rubric (e.g. "Akurasi 40%, Kelengkapan 60%")
 * into structured criteria, normalized so weights sum to 1.
 *
 * Supported separators: commas, semicolons, newlines. Numeric weights may
 * appear as "Nama 40%", "Nama: 40%", "Nama - 40", or "40% Nama". If some
 * items carry weights and others do not, the unweighted ones get an equal
 * share of the remaining weight so we do NOT collapse a multi-criterion
 * rubric into a single "overall".
 */
function parseRubricText(text) {
  if (!text) return [];

  // Handle JSON v2 format (from the gradation table builder)
  const t = String(text).trim();
  if (t.startsWith("{")) {
    try {
      const p = JSON.parse(t);
      if (p.version === "2" && Array.isArray(p.criteria) && p.criteria.length > 0) {
        return p.criteria.map((c, i) => ({
          id: slugify(c.name) || `c${i + 1}`,
          name: c.name || `Kriteria ${i + 1}`,
          weight: (c.weight || 0) / 100,
          scale: 100,
        }));
      }
    } catch { /* fall through to legacy parser */ }
  }

  // Concatenated JSON v2 blocks (e.g. per-question rubrics joined by newline,
  // as produced by createAssessment). Parse each block and merge criteria so a
  // multi-question assessment does not collapse into an invalid rubric.
  const multi = parseConcatenatedJsonRubrics(t);
  if (multi) {
    const criteria = distributeWeights(multi);
    return criteria.length > 0 ? criteria : legacyParse(t);
  }

  return legacyParse(t);
}

/**
 * Parse a text containing one or more concatenated JSON v2 rubric blocks
 * (e.g. `{...}\n{...}`). Returns a flat array of criteria with weights already
 * normalized per-block, or null when the text is not multiple JSON v2 blocks.
 */
function parseConcatenatedJsonRubrics(text) {
  const lines = String(text)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const blocks = [];
  for (const line of lines) {
    if (!line.startsWith("{")) return null;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      return null;
    }
    if (!parsed || parsed.version !== "2" || !Array.isArray(parsed.criteria)) return null;
    const blockSum = parsed.criteria.reduce((acc, c) => acc + (Number(c.weight) || 0), 0) || 1;
    blocks.push(
      parsed.criteria.map((c) => ({
        id: slugify(c.name) || `c${criteria.length + 1}`,
        name: c.name || "Kriteria",
        weight: (c.weight || 0) / blockSum,
        scale: 100,
      })),
    );
  }
  if (blocks.length === 0) return null;

  // Same criterion name may appear across many per-question blocks. Merge them
  // by averaging their (already per-block normalized) weight so duplicates
  // collapse instead of doubling the total weight past 1.
  const merged = new Map();
  for (const block of blocks) {
    for (const c of block) {
      const key = c.id;
      if (!merged.has(key)) merged.set(key, { ...c, count: 1, weight: c.weight });
      else {
        const e = merged.get(key);
        e.weight = (e.weight * e.count + c.weight) / (e.count + 1);
        e.count += 1;
      }
    }
  }
  const criteria = [...merged.values()].map(({ count, ...c }) => c);
  return criteria.length > 0 ? criteria : null;
}

function legacyParse(text) {
  const items = String(text)
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Flatten comma-separated items: split on commas only when outside parentheses
  const flat = [];
  for (const item of items) {
    let depth = 0, start = 0;
    for (let i = 0; i < item.length; i++) {
      if (item[i] === '(' || item[i] === '[' || item[i] === '{') depth++;
      else if (item[i] === ')' || item[i] === ']' || item[i] === '}') depth--;
      else if (depth === 0 && item[i] === ',') {
        const seg = item.slice(start, i).trim();
        if (seg) flat.push(seg);
        start = i + 1;
      }
    }
    const last = item.slice(start).trim();
    if (last) flat.push(last);
  }
  const criteria = [];
  for (const item of flat) {
    const parsed = parseRubricItem(item);
    if (!parsed) continue;
    criteria.push({ id: slugify(parsed.name) || `c${criteria.length + 1}`, name: parsed.name, weight: parsed.weight, scale: 100 });
  }

  if (criteria.length === 0) {
    // Fallback single criterion so evaluation remains valid.
    return [{ id: "overall", name: "Penilaian Keseluruhan", weight: 1, scale: 100 }];
  }

  // Distribute unspecified weight equally so the total is 1 without silently
  // dropping criteria that had no explicit percentage.
  return distributeWeights(criteria);
}

/**
 * Match one rubric item: name + optional trailing/leading percent weight.
 * Returns { name, weight|null } or null when uninhabitable.
 */
function parseRubricItem(item) {
  let s = item.replace(/^[•\-*]\s*/, "").replace(/[.!]+$/, "").trim();
  // Strip trailing comma before percentage (e.g. "Ketepatan konsep, 40%")
  s = s.replace(/,\s*(?=\d+\s*%?$)/, " ").trim();
  // "Nama 40%" | "Nama: 40%" | "Nama - 40%" | "Nama (40%)"
  let m = s.match(/^(.+?)\s*[-:–]?\s*\(?\s*(\d+(?:\.\d+)?)\s*%?\s*\)?$/);
  if (m && m[1]) return { name: cleanName(m[1]), weight: Number(m[2]) / 100 };
  // "40% Nama"
  m = s.match(/^(\d+(?:\.\d+)?)\s*%?\s+(.+)$/);
  if (m) return { name: cleanName(m[2]), weight: Number(m[1]) / 100 };
  // No weight — just a criterion name.
  if (/[a-zA-Z]{3,}/.test(s) && !/^\d+(\.\d+)?\s*%?$/.test(s)) {
    return { name: cleanName(s), weight: 0 };
  }
  return null;
}

function cleanName(s) {
  return String(s).trim().replace(/[-:–]\s*$/, "").trim();
}

/**
 * If the parsed weights don't sum to >0 (i.e. all unweighted), split equally.
 * If some are weighted, keep them and ignore zero-weight dupes.
 */
function distributeWeights(criteria) {
  const withWeight = criteria.filter((c) => c.weight > 0);
  if (withWeight.length === criteria.length && Math.abs(withWeight.reduce((a, c) => a + c.weight, 0) - 1) < 1e-6) {
    return criteria;
  }
  // Any criterion without a weight shares equally with the others.
  if (withWeight.length > 0 && withWeight.length < criteria.length) {
    // Keep explicit weights; give the remaining share to the unweighted ones equally.
    const explicitSum = withWeight.reduce((a, c) => a + c.weight, 0);
    const remaining = Math.max(0, 1 - explicitSum);
    const unweightedCount = criteria.length - withWeight.length;
    const added = remaining > 0 ? remaining / unweightedCount : 0;
    return criteria.map((c) => (c.weight > 0 ? c : { ...c, weight: added }));
  }
  const equal = 1 / criteria.length;
  return criteria.map((c) => ({ ...c, weight: c.weight > 0 ? c.weight : equal }));
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