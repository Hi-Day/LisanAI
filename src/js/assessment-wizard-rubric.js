import { escapeHtml } from "./utils.js";

// Rubric editor is intentionally isolated from the wizard orchestration.
// The wizard passes its context explicitly so this module has no hidden
// singleton state and can be rerouted safely after verification.

export const DEFAULT_LEVELS = [
  { score: 4, label: "Sangat Baik", descriptor: "" },
  { score: 3, label: "Baik", descriptor: "" },
  { score: 2, label: "Cukup", descriptor: "" },
  { score: 1, label: "Kurang", descriptor: "" },
];

function fillLevelDescriptors(criterionName, levels) {
  const name = criterionName || "Kriteria";
  const templates = [
    `${name} sangat baik, lengkap, dan tepat`,
    `${name} baik dan memadai`,
    `${name} cukup, namun masih perlu pengembangan`,
    `${name} kurang, perlu perbaikan signifikan`,
  ];
  return levels.map((level, index) => ({
    ...level,
    descriptor: level.descriptor || templates[index] || "",
  }));
}

/**
 * Convert a rubric string (JSON v2 or legacy text) into structured criteria.
 * JSON v2: {version:"2", criteria:[{id,name,weight,levels:[...]}]}
 * Legacy: "Nama 40%"
 */
export function parseRubricToCriteria(text) {
  if (!text || !text.trim()) {
    return [{
      id: "c1",
      name: "",
      weight: 0,
      levels: fillLevelDescriptors("", JSON.parse(JSON.stringify(DEFAULT_LEVELS))),
    }];
  }

  const value = text.trim();
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      if (parsed.version === "2" && Array.isArray(parsed.criteria)) {
        return parsed.criteria.map((criterion, index) => ({
          id: criterion.id || `c${index + 1}`,
          name: criterion.name || "",
          weight: criterion.weight || 0,
          levels: Array.isArray(criterion.levels) && criterion.levels.length === 4
            ? fillLevelDescriptors(
                criterion.name || "",
                criterion.levels.map((level) => ({
                  score: level.score,
                  label: level.label || "",
                  descriptor: level.descriptor || "",
                }))
              )
            : fillLevelDescriptors(criterion.name || "", JSON.parse(JSON.stringify(DEFAULT_LEVELS))),
        }));
      }
    } catch {
      // Fall through to the legacy parser.
    }
  }

  // Split only at top-level separators so commas inside parentheses remain
  // part of a criterion name.
  const lines = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (depth === 0 && (char === "," || char === ";" || char === "\n")) {
      const segment = value.slice(start, index).trim();
      if (segment) lines.push(segment);
      start = index + 1;
    }
  }
  const last = value.slice(start).trim();
  if (last) lines.push(last);
  if (!lines.length) lines.push("");

  return lines.map((line, index) => {
    let name = line.trim()
      .replace(/^[•\-*]\s*/, "")
      .replace(/[.!]+$/, "")
      .trim();
    name = name.replace(/,\s*(?=\d+\s*%?$)/, " ").trim();

    let weight = 0;
    let match = name.match(/^(.+?)\s*[-:–]?\s*\(?\s*(\d+(?:\.\d+)?)\s*%?\s*\)?$/);
    if (match) {
      name = match[1].trim();
      weight = Number(match[2]);
    } else {
      match = name.match(/^(\d+(?:\.\d+)?)\s*%?\s+(.+)$/);
      if (match) {
        weight = Number(match[1]);
        name = match[2].trim();
      }
    }

    return {
      id: `c${index + 1}`,
      name,
      weight,
      levels: fillLevelDescriptors(name, JSON.parse(JSON.stringify(DEFAULT_LEVELS))),
    };
  });
}

function formatCriteriaToJson(criteria) {
  return JSON.stringify({ version: "2", criteria });
}

/** Render the four-level rubric editor into the supplied element. */
export function renderRubrikBuilder(el, rubricText, ctx) {
  const criteria = parseRubricToCriteria(rubricText);
  const levels = criteria[0]?.levels || DEFAULT_LEVELS;
  el.dataset.ready = "1";
  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <strong style="font-size:0.9rem;">Rubrik dengan Gradasi</strong>
      <button type="button" class="secondary-button rubrik-add" style="padding:4px 12px; font-size:0.85rem;">+ Tambah Kriteria</button>
    </div>
    <div class="rubrik-gradation-wrap">
      <table class="rubrik-gradation">
        <thead>
          <tr>
            <th style="min-width:140px;">Kriteria</th>
            <th style="min-width:40px;">Bobot</th>
            ${levels.map((level) => `<th class="rubrik-level-${level.score}">${escapeHtml(level.label)} (${level.score})</th>`).join("")}
            <th style="width:32px;"></th>
          </tr>
        </thead>
        <tbody class="rubrik-rows">
          ${criteria.map((criterion, index) => rubrikGradationRow(criterion, index, levels)).join("")}
        </tbody>
      </table>
    </div>
    <div class="rubrik-weight-sum" data-sum></div>
  `;

  el.querySelector(".rubrik-add").addEventListener("click", () => {
    const tbody = el.querySelector(".rubrik-rows");
    const index = tbody.children.length;
    const row = document.createElement("tr");
    row.innerHTML = rubrikGradationRow(
      { id: `c${index + 1}`, name: "", weight: 0, levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)) },
      index,
      levels
    );
    tbody.appendChild(row);
    updateRubrik(el, ctx);
  });

  el.querySelector(".rubrik-rows").addEventListener("input", () => updateRubrik(el, ctx));
  el.querySelector(".rubrik-rows").addEventListener("click", (event) => {
    if (event.target.closest(".rubrik-delete")) {
      event.target.closest("tr").remove();
      updateRubrik(el, ctx);
    }
  });
  updateRubrik(el, ctx);
}

function rubrikGradationRow(criterion, index, levels) {
  return `
    <tr class="rubrik-row">
      <td><input type="text" class="rubrik-name" placeholder="Nama kriteria" value="${escapeHtml(criterion.name || "")}" style="width:100%;" /></td>
      <td><input type="number" class="rubrik-weight" min="0" max="100" step="1" value="${criterion.weight}" aria-label="Bobot %" style="width:50px;" />%</td>
      ${levels.map((level, levelIndex) => `
        <td class="rubrik-level-cell rubrik-level-${level.score}">
          <textarea class="rubrik-desc" rows="2" placeholder="Deskripsi ${level.label.toLowerCase()}..." aria-label="${escapeHtml(level.label)}">${escapeHtml((criterion.levels && criterion.levels[levelIndex]?.descriptor) || "")}</textarea>
        </td>
      `).join("")}
      <td><button type="button" class="action-button danger-button rubrik-delete" aria-label="Hapus">&times;</button></td>
    </tr>
  `;
}

function updateRubrik(el, ctx) {
  const rows = [...el.querySelectorAll(".rubrik-rows tr")];
  const criteria = rows.map((row, index) => ({
    id: `c${index + 1}`,
    name: row.querySelector(".rubrik-name").value.trim(),
    weight: Number(row.querySelector(".rubrik-weight").value || 0),
    levels: DEFAULT_LEVELS.map((level, levelIndex) => ({
      score: level.score,
      label: level.label,
      descriptor: row.querySelectorAll(".rubrik-desc")[levelIndex]?.value?.trim() || "",
    })),
  }));

  const sum = criteria.reduce((total, criterion) => total + (Number.isFinite(criterion.weight) ? criterion.weight : 0), 0);
  const sumEl = el.querySelector("[data-sum]");
  sumEl.textContent = `Total bobot: ${sum}% ${sum === 100 ? "✓" : sum > 100 ? "(kelebihan)" : "(kurang)"}`;
  sumEl.className = `rubrik-weight-sum ${sum === 100 ? "valid" : "invalid"}`;

  const qIndex = el.dataset.qIndex;
  if (ctx && qIndex !== undefined && ctx.pendingQuestions?.[qIndex]) {
    ctx.pendingQuestions[qIndex].rubric = formatCriteriaToJson(criteria);
  }
}

/** Convert a legacy text rubric to JSON v2; preserve JSON v2 unchanged. */
export function convertLegacyRubricToJson(text) {
  if (!text || !text.trim()) return "";
  const value = text.trim();
  if (value.startsWith("{")) return value;
  try {
    return formatCriteriaToJson(parseRubricToCriteria(value));
  } catch {
    return value;
  }
}
