/**
 * Evidence quality measurement v1.
 *
 * This module measures evidence signals, not truth. Keyword/phrase signals are
 * deliberately transparent and deterministic; the assessment harness remains
 * the source of truth for scoring.
 */

const DIMENSIONS = [
  {
    type: "conceptual_clarity",
    label: "kejelasan konsep",
    patterns: [/\bjelaskan\b/i, /\bkonsep\b/i, /\bdefinisi\b/i, /\bmakna\b/i, /\bartinya\b/i],
  },
  {
    type: "causal_reasoning",
    label: "alasan atau sebab-akibat",
    patterns: [/\bkarena\b/i, /\bsebab\b/i, /\bmengapa\b/i, /\bkenapa\b/i, /\bakibat\b/i, /\bsehingga\b/i, /\bmaka\b/i],
  },
  {
    type: "application",
    label: "penerapan pada situasi",
    patterns: [/\bcontoh\b/i, /\bmisal(?:nya)?\b/i, /\bkasus\b/i, /\bsituasi\b/i, /\bpenerapan\b/i, /\bditerapkan\b/i],
  },
  {
    type: "evidence",
    label: "bukti atau dasar",
    patterns: [/\bbukti\b/i, /\bdata\b/i, /\bfakta\b/i, /\bdasar\b/i, /\bindikator\b/i, /\bobservasi\b/i, /\bmenunjukkan\b/i],
  },
  {
    type: "alternative_reasoning",
    label: "alternatif atau batasan",
    patterns: [/\bnamun\b/i, /\btetapi\b/i, /\bsebaliknya\b/i, /\bberbeda\b/i, /\bkondisi\b/i, /\bbatas(?:an)?\b/i, /\bkelemahan\b/i, /\balternatif\b/i],
  },
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function textFromEvidence(evidence) {
  if (Array.isArray(evidence)) {
    return evidence.map((item) => {
      if (typeof item === "string") return item;
      return item?.text || item?.content || item?.evidence || item?.claim || "";
    }).join(" ");
  }
  return normalizeText(evidence);
}

function signalDimensions(text) {
  const normalized = normalizeText(text);
  return DIMENSIONS.filter((dimension) => dimension.patterns.some((pattern) => pattern.test(normalized)))
    .map((dimension) => dimension.type);
}

function questionText(question) {
  return normalizeText([
    question?.text,
    question?.question,
    question?.prompt,
    question?.focus,
    question?.rubric,
    question?.criteria,
    ...(Array.isArray(question?.rubrics) ? question.rubrics.map((r) => r?.text || r?.description || r?.criterion || r) : []),
  ].filter(Boolean).join(" "));
}

function inferRequiredEvidence(question, fallbackType = null) {
  const types = signalDimensions(questionText(question));
  if (types.length) return types.map((type) => ({ type, weight: 1 }));
  if (fallbackType && DIMENSIONS.some((dimension) => dimension.type === fallbackType)) {
    return [{ type: fallbackType, weight: 1 }];
  }
  return [{ type: "conceptual_clarity", weight: 1 }];
}

function coverage(present, required) {
  if (!required.length) return 0;
  const requiredTypes = new Set(required.map((item) => item.type));
  return required.filter((item) => present.includes(item.type)).reduce((sum, item) => sum + item.weight, 0) /
    required.reduce((sum, item) => sum + item.weight, 0);
}

function measureEvidenceQuality(question, questionScore) {
  const probing = questionScore?.probing || null;
  const fallbackType = probing?.evidenceGap?.type || probing?.probeType || null;
  const required = inferRequiredEvidence(question, fallbackType);
  const initialText = textFromEvidence(questionScore?.evidence) || questionScore?.answer || "";
  const probeText = probing?.answer || "";
  const initialPresent = signalDimensions(initialText);
  const probePresent = signalDimensions(probeText);
  const finalPresent = signalDimensions(`${initialText} ${probeText}`);
  const requiredTypes = new Set(required.map((item) => item.type));
  const initialRequired = initialPresent.filter((type) => requiredTypes.has(type));
  const finalRequired = finalPresent.filter((type) => requiredTypes.has(type));
  const gained = finalRequired.filter((type) => !initialRequired.includes(type));

  return {
    version: 1,
    method: "transparent_evidence_signal_v1",
    required,
    initial: {
      present: initialRequired,
      missing: required.filter((item) => !initialRequired.includes(item.type)).map((item) => item.type),
      coverage: coverage(initialRequired, required),
    },
    probe: probing ? {
      target: fallbackType,
      present: probePresent.filter((type) => requiredTypes.has(type)),
      coverageGain: gained.length,
    } : null,
    final: {
      present: finalRequired,
      missing: required.filter((item) => !finalRequired.includes(item.type)).map((item) => item.type),
      coverage: coverage(finalRequired, required),
    },
    impact: {
      baselineScore: Number.isFinite(Number(probing?.baselineScore)) ? Number(probing.baselineScore) : null,
      verifiedScore: Number.isFinite(Number(questionScore?.score)) ? Number(questionScore.score) : null,
      scoreDelta: Number.isFinite(Number(probing?.baselineScore)) && Number.isFinite(Number(questionScore?.score))
        ? Number(questionScore.score) - Number(probing.baselineScore)
        : null,
      evidenceGain: gained.length,
    },
  };
}

function buildEvidenceQuality(assessment, questionScores) {
  const questions = Array.isArray(assessment?.questions) ? assessment.questions : [];
  return (questionScores || []).map((questionScore, index) =>
    ({ questionIndex: index, ...measureEvidenceQuality(questions[index] || {}, questionScore) })
  );
}

module.exports = {
  buildEvidenceQuality,
  inferRequiredEvidence,
  measureEvidenceQuality,
  signalDimensions,
};
