const crypto = require("node:crypto");
const { PluginRegistry } = require("./registry");
const { Pipeline } = require("./pipeline");
const { Trace } = require("./trace");
const { defaultConfig, validateConfig } = require("./config");
const { validateOutput } = require("./validator");
const { buildReproducibilityHashes } = require("./reproducibility");
const contextCache = require("./context-cache");

/**
 * AssessmentHarness — controls, validates, and records the judgment process.
 *
 *   input
 *    ↓
 *   load assessment       (plugin: assessmentContext)
 *    ↓
 *   build context         (plugin: persona + assessmentContext)
 *    ↓
 *   assemble rubric       (plugin: rubric)
 *    ↓
 *   invoke model          (provider)
 *    ↓
 *   parse output          (response-parser)
 *    ↓
 *   extract evidence      (plugin: evidence)
 *    ↓
 *   validate scores       (validator)
 *    ↓
 *   verify                (plugin: verification)
 *    ↓
 *   calculate final score (scoring engine)
 *    ↓
 *   persist trace         (caller-provided onTrace)
 *    ↓
 *   return result
 */
class AssessmentHarness {
  constructor(config = {}) {
    this.config = validateConfig(defaultConfig(config));
    this.registry = new PluginRegistry();
    this.provider = null;
    this.parser = null;
    this.persistTrace = null;
  }

  static createRunId() {
    return `run_${crypto.randomBytes(6).toString("hex")}`;
  }

  register(plugin) {
    this.registry.register(plugin);
    return this;
  }

  setProvider(provider) {
    // provider: { async generate(request), name, version }
    this.provider = provider;
    return this;
  }

  setParser(parser) {
    // parser: { async parse(content) -> output, hint }
    this.parser = parser;
    return this;
  }

  setTracePersister(fn) {
    this.persistTrace = fn;
    return this;
  }

  /**
   * Evaluate input ({ assessment, answers, studentName, meta }).
   */
  async evaluate(input) {
    validateConfig(this.config);
    if (!this.provider) throw new Error("Harness membutuhkan provider (setProvider)");
    if (!this.parser) throw new Error("Harness membutuhkan output parser (setParser)");
    if (!input || !Array.isArray(input.answers)) {
      throw new Error("input harus berisi answers array");
    }

    const runId = AssessmentHarness.createRunId();
    const trace = new Trace(runId, { tenantId: input.tenantId, userId: input.userId });

    const context = {
      runId,
      trace,
      input,
      tenantId: input.tenantId,
      userId: input.userId,
      assessment: input.assessment || null,
      rubric: null,
      prompt: null,
      config: this.config,
    };

    trace.event("ASSESSMENT_LOADED", { assessmentId: input.assessmentId });
    trace.setContext("assessmentId", input.assessmentId);
    trace.setContext("answerCount", input.answers.length);

    // PRD FR-12 — Re-evaluation. When verification FAILs, retry the model up
    // to `maxRetries` times (bounded, never an infinite loop). Each attempt
    // re-invokes the LLM with identical input; only a deterministically-failing
    // or parsing error path escapes early.
    const maxRetries = Number(process.env.MAX_EVALUATION_RETRIES ?? (this.config.verification && this.config.verification.maxRetries) ?? 1);
    let finalResult = null;
    let attempt = 0;
    for (let i = 0; i <= maxRetries; i += 1) {
      attempt = i + 1;
      const attemptResult = await this.runOnce(context, input, runId);
      if (attemptResult.verification && attemptResult.verification.status === "FAIL" && i < maxRetries) {
        trace.event("VERIFICATION_RETRY", {
          attempt,
          maxRetries,
          reason: (attemptResult.verification.reasons || []).slice(0, 3),
        });
        // Re-run the next attempt with a clean rubric context so plugins
        // assemble it fresh (evidence grounding stays student-only).
        delete context.criteria;
        context.prompt = null;
        context.promptForHash = null;
        continue;
      }
      finalResult = attemptResult;
      break;
    }
    trace.event("VERIFICATION", { valid: finalResult.verification.valid });

    if (this.persistTrace) {
      const snap = trace.snapshot({
        meta: {
          tenantId: input.tenantId,
          userId: input.userId,
          submissionId: (input.submissionId) || finalResult.submissionId || null,
          assessmentId: input.assessmentId,
        },
        model: this.config.model.model,
        provider: (this.provider && this.provider.name) || null,
        promptVersion: "v1",
        rubricVersion: finalResult.versioning.rubricVersion,
        harnessVersion: this.config.version,
        engineVersion: this.config.engineVersion,
        result: finalResult,
      });
      try {
        await this.persistTrace(snap);
      } catch (err) {
        // Trace persistence must never break evaluation.
        trace.event("TRACE_PERSIST_ERROR", { message: err.message });
      }
    }

    return finalResult;
  }

  /**
   * Run one full cycle: plugins around the model invocation, then finalize.
   * Returns the canonical evaluation result for a single attempt.
   */
  async runOnce(context, input, runId) {
    const trace = context.trace;
    const enabled = {};
    const map = this.config.pipeline || {};
    const registered = this.registry.list();
    for (const p of registered) {
      enabled[p.name] = typeof map[p.name] === "boolean" ? map[p.name] : true;
    }
    const pipeline = new Pipeline(registered, { enabled });

    // Run plugins around the model invocation.
    const result = await pipeline.run(context, async (ctx) => {
      trace.event("RUBRIC_LOADED", { rubricId: ctx.rubric && ctx.rubric.id });
      trace.event("MODEL_REQUEST", { model: this.config.model.model });

      const evidencePlan = {
        provider: this.provider.name || "unknown",
        model: this.config.model.model,
        rubric: ctx.rubric,
        questions: ctx.assessment ? ctx.assessment.questions : undefined,
        answers: input.answers,
        studentName: input.studentName,
      };

      // Let plugins inject a custom prompt BEFORE hitting the provider.
      // The prompt is split into a STABLE system prefix (instruction + rubric
      // + question set + output schema, identical across all submissions of
      // the same assessment) and a VOLATILE user tail (student answers, which
      // differ per run). Keeping the stable block first lets provider KV
      // prefix caches hit on repeated calls, while only the last message
      // changes between consecutive evaluations.
      const parts = (ctx.promptParts && (await ctx.promptParts(ctx))) || buildPromptParts(evidencePlan);
      const combined = defaultPrompt(evidencePlan);
      ctx.systemPrompt = parts.system || ctx.prompt || "";
      ctx.userMessage = parts.user || "";
      // The combined JSON is hashed for reproducibility — it contains both the
      // stable system block and the volatile answers, so two runs only compare
      // equal when their full input was identical.
      ctx.promptForHash = combined;

      // P1-1/P1-3 — Stable context identity. Hash only the STABLE context
      // (system prompt + rubric + questions + sampling + model), namespaced by
      // tenant. Never the student answers. Used for context caching and for
      // tracing which context produced a result. On a cache hit we reuse the
      // already-compiled stable prompt/rubric (avoiding recompilation); the
      // model still runs per student, so safety is preserved.
      const { computeContextHash, computeContextVersion, get: ctxGet, set: ctxSet } = contextCache;
      const ctxHash = computeContextHash({
        tenantId: input.tenantId,
        rubric: ctx.rubric,
        questions: ctx.assessment ? ctx.assessment.questions : undefined,
        model: this.config.model.model,
        temperature: this.config.model.temperature,
        topP: this.config.model.topP,
        maxTokens: this.config.model.maxTokens,
        promptTemplate: ctx.systemPrompt,
        harnessVersion: this.config.version,
        engineVersion: this.config.engineVersion,
        promptVersion: "v1",
      });
      const ctxVersion = computeContextVersion(ctxHash);
      ctx.contextHash = ctxHash;
      ctx.contextVersion = ctxVersion;
      const cachedContext = ctxGet(input.tenantId, ctxHash);
      if (cachedContext) {
        trace.event("CONTEXT_CACHE_HIT", { contextHash: ctxHash, contextVersion: ctxVersion });
        if (cachedContext.systemPrompt) ctx.systemPrompt = cachedContext.systemPrompt;
        if (cachedContext.rubric) ctx.rubric = cachedContext.rubric;
      } else {
        trace.event("CONTEXT_CACHE_MISS", { contextHash: ctxHash, contextVersion: ctxVersion });
        ctxSet(input.tenantId, ctxHash, {
          contextHash: ctxHash,
          contextVersion: ctxVersion,
          systemPrompt: ctx.systemPrompt,
          rubric: ctx.rubric,
          compiledAt: new Date().toISOString(),
        });
      }

      const rawContent = await this.provider.generate({
        prompt: combined, // preserved for the mock provider + legacy consumers
        systemPrompt: ctx.systemPrompt,
        userMessage: ctx.userMessage,
        model: this.config.model.model,
        tenantId: input.tenantId,
        userId: input.userId,
        runId,
        schemaHint: ctx.evaluationHint || "Balas JSON valid.",
        // Generation parameters (FR-16 / P0) — forwarded so the provider can
        // apply them and so the trace records exactly what was used.
        temperature: this.config.model.temperature,
        topP: this.config.model.topP,
        maxTokens: this.config.model.maxTokens,
      });
      trace.event("MODEL_RESPONSE", { modelTokenEstimate: rawContent ? rawContent.length : 0 });
      trace.setContext("rawContentLength", rawContent ? rawContent.length : 0);

      const parsed = await this.parser.parse(rawContent, { prompt: combined, context: ctx });
      trace.event("OUTPUT_PARSED");

      // Standardize: harness always produces criteria on the canonical shape.
      return harnessOutput(ctx, parsed, { runId, input });
    });

    // Final validation + compute score if plugin didn't already supply criteria-only.
    return this.finalize(result, { runId, input, trace });
  }

  /**
   * Apply deterministic scoring + versioning + verification to the parsed output.
   */
  async finalize(result, { runId, input, trace }) {
    const rubric = result.rubric || {};
    const criteria = result.criteria || [];

    // Deterministic weighted score (server-side, not LLM).
    const scoring = require("../evaluation/scoring");
    const weighted = scoring.calculateFinalScore(criteria, rubric);
    trace.event("FINAL_SCORE", {
      finalScore: weighted.finalScore,
      formula: weighted.formula,
    });

    const verificationResult = this.runVerification(result, rubric, criteria);
    let reliability = null;
    if (this.config.pipeline && this.config.pipeline.reliability !== false && verificationResult) {
      const { reliabilityVector } = require("./scoring/reliability");
      reliability = reliabilityVector({
        criteria,
        rubricCriteria: (rubric && rubric.criteria) || [],
        verification: verificationResult,
        valid: verificationResult.status === "FAIL" ? false : true,
      });
      trace.event("RELIABILITY", {
        overall: reliability.overallReliability,
        dimensions: reliability.dimensions,
      });
      trace.setContext("overallReliability", reliability.overallReliability);
    }

    // PRD FR-15 — Reproducibility hashes. These prove two runs used identical
    // input (answers), rubric, prompt and configuration.
    const hashes = buildReproducibilityHashes({
      answers: (input && input.answers) || [],
      rubric,
      prompt: result.promptForHash || input.promptForHash || null,
      config: this.config,
    });
    trace.setContext("reproducibility", hashes);

    // PRD FR-13 — Publication rule. A final score is only `published` after
    // verification clears it. FAIL → never published; REVIEW → requires human
    // review; PASS → published automatically.
    const status = verificationResult.status;
    let published = status === "PASS";
    let requiresHumanReview = status === "REVIEW";

    // P1-4/P1-5/P1-17 — Adaptive verification risk + policy. Additive layer:
    // it can only escalate PASS → human review (or force FAIL treatment); it
    // NEVER mutates the score and NEVER bypasses evidence/verification.
    let risk = this.computeRisk(criteria, verificationResult, input);
    if (risk) {
      risk = { ...risk, ...this.applyRiskPolicy(risk) };
      const policy = risk.policy;
      // Risk escalation is REVIEW-only: never downgrade an already-flagged run.
      if (policy && policy.requiresHumanReview) {
        requiresHumanReview = true;
        if (published) published = false;
      }
      trace.event("RISK", { score: risk.score, level: risk.level, decision: policy && policy.decision });
    }

    const output = {
      evaluationId: `ev_${crypto.randomBytes(6).toString("hex")}`,
      evaluationRunId: runId,
      assessmentId: input.assessmentId,
      submissionId: result.submissionId || null,
      criteria,
      finalScore: weighted.finalScore,
      weighted,
      feedback: result.feedback || "",
      verification: verificationResult,
      reproducibility: hashes,
      published,
      requiresHumanReview,
      reliability,
      versioning: {
        provider: (this.provider && this.provider.name) || null,
        model: this.config.model.model,
        modelVersion: (this.provider && this.provider.version) || null,
        temperature: this.config.model.temperature ?? null,
        topP: this.config.model.topP ?? null,
        maxTokens: this.config.model.maxTokens ?? null,
        promptVersion: "v1",
        rubricVersion: (rubric && rubric.id) || "v1",
        harnessVersion: this.config.version,
        engineVersion: this.config.engineVersion,
        contextHash: result.contextHash || null,
        contextVersion: result.contextVersion || null,
      },
      // Question ↔ rubric mapping (P0): which rubric categories each question
      // measures, stamped at generation time by enforceRubricAlignment. Persisted
      // with the trace so the audit can show every question's rubric category.
      questionRubric: buildQuestionRubricMap(input, rubric),
      risk,
      trace: trace.snapshot({ result: undefined }).events,
    };
    trace.setContext("finalScore", output.finalScore);
    trace.setContext("published", published);
    trace.setContext("requiresHumanReview", requiresHumanReview);
    if (risk) trace.setContext("risk", risk);
    return output;
  }

  /**
   * Single Verification Engine (P0).
   *
   * The verification PLUGIN (plugins/verification.js) is the single source of
   * truth for the gate decision (PASS/REVIEW/FAIL). This method only adapts the
   * plugin's result into the canonical shape and provides a minimal structural
   * fallback when the plugin is disabled — it never re-implements a competing
   * set of rules. All consumers (publication rule, reliability, trace) read the
   * same `verification` object produced here.
   */
  runVerification(result, rubric, weighted) {
    const pluginVerification = (result && result.verification) || {};
    // The plugin already computed the authoritative gate. Surface it unchanged.
    if (pluginVerification.status && pluginVerification.valid !== undefined) {
      return {
        valid: pluginVerification.valid,
        issues: pluginVerification.issues || [],
        status: pluginVerification.status,
        reasons: pluginVerification.reasons || [],
        scoreConsistency: pluginVerification.scoreConsistency,
      };
    }
    // Fallback (plugin disabled): minimal structural gate only.
    const fatalIssues = [];
    if (!rubric || !Array.isArray(rubric.criteria)) fatalIssues.push("Rubric tidak tersedia/tidak valid");
    if (!Array.isArray(result.criteria) || result.criteria.length === 0) fatalIssues.push("Tidak ada criterion score");
    const out = validateOutput({
      evaluationId: "pending",
      criteria: result.criteria,
      finalScore: weighted.finalScore,
    });
    if (!out.valid) fatalIssues.push(...out.issues);
    return {
      valid: fatalIssues.length === 0,
      issues: fatalIssues,
      status: fatalIssues.length === 0 ? "PASS" : "FAIL",
      reasons: fatalIssues,
      scoreConsistency: null,
    };
  }

  /**
   * P1-4 — Compute the adaptive risk score for a result.
   * Returns null when the risk engine is disabled, so callers can treat risk
   * as fully optional.
   */
  computeRisk(criteria, verification, input) {
    const riskCfg = this.config.risk;
    if (!riskCfg || riskCfg.enabled === false) return null;
    const { computeRiskScore } = require("./risk");
    const score = computeRiskScore(
      {
        criteria,
        verification,
        difficulty: input && input.assessment ? input.assessment.difficulty : null,
      },
      riskCfg.weights
    );
    return { score };
  }

  /**
   * P1-5/P1-17 — Apply the configured policy to a risk score.
   * Records the risk level and the policy decision. REVIEW-only escalation is
   * applied by the caller (finalize); this method never touches the score.
   */
  applyRiskPolicy(risk) {
    const { classifyRisk, applyPolicy } = require("./risk");
    const riskCfg = this.config.risk || {};
    const level = classifyRisk(risk.score, riskCfg.thresholds);
    const policy = applyPolicy(level, {}, riskCfg.policy);
    return {
      score: risk.score,
      level,
      policy,
    };
  }

  /**
   * Reconstruct a trace for a given runId (append-only, via persister if available).
   */
  async trace(runId) {
    if (!this.persistTrace) return { runId, available: false };
    const saved = await this.persistTrace({ mode: "read", runId });
    return saved ?? { runId, available: false };
  }

  async validate(runOrOutput) {
    // Validate a canonical output object.
    if (runOrOutput && runOrOutput.criteria) return validateOutput(runOrOutput);
    return { valid: false, issues: ["tidak ada output untuk divalidasi"] };
  }
}

/**
 * Build the STABLE system block: persona/instruction + scoring rubric +
 * question set + output schema. This block is byte-identical across every
 * evaluation of the same assessment, so provider KV prefix caching can reuse
 * it. It deliberately contains NO student-specific answers.
 */
function buildSystemPrompt(plan) {
  const criteriaIds = (plan.rubric && plan.rubric.criteria && plan.rubric.criteria.map((c) => c.id)) || [];
  return [
    "Role: expert-academic-assessor. You evaluate student ORAL EXAM answers.",
    "CONTEXT: Answers are transcribed from speech (speech-to-text). Do NOT penalize punctuation, capitalization, run-on sentences, or lack of formal/written style — those are artifacts of transcription, not real oral skill gaps.",
    "Score based on substantive content: accuracy, completeness, concept mastery, and how clearly the student communicates ideas verbally.",
    "RUBRIC: " + JSON.stringify(plan.rubric),
    "QUESTION SET: " + JSON.stringify(plan.questions),
    "CRITERION IDS: " + JSON.stringify(criteriaIds),
    "OUTPUT: Return STRICT JSON only, no markdown. Step 1: for every criterion id above emit a criterion entry {criterionId, score(0-100), evidence[exact text quoted from the student answer], strengths[name concrete positives], gaps[name concrete improvements], rationale[short], confidence(0-1)}. Strengths must reflect genuine positives in the answer — never leave them empty when the answer has merit. Step 2: also emit a questionScores array (one entry per student answer) {question, answer, score, matched, strengths, gaps}. Do NOT invent evidence. Do NOT compute a finalScore.",
  ].join("\n\n");
}

/**
 * Split prompt for the provider: a stable system prefix (cacheable across
 * runs of the same assessment) plus a volatile user tail (student answers,
 * which change on every evaluation). Keeping the stable block first is what
 * allows provider KV prefix caches to hit.
 */
function buildPromptParts(plan) {
  return {
    system: buildSystemPrompt(plan),
    user: JSON.stringify({
      task: "Evaluate the student's oral exam answers below against the rubric criteria.",
      studentName: plan.studentName || null,
      answers: plan.answers || [],
    }),
  };
}

/**
 * Combined default evaluator prompt (single JSON object) — kept for the mock
 * provider, trace/prompt hashing, and legacy consumers. The stable fields
 * (role, instruction, criteria, rubric, questions) appear before the volatile
 * `answers` so the serialized prefix is also cacheable when sent as one block.
 */
function defaultPrompt(plan) {
  const criteriaIds = (plan.rubric && plan.rubric.criteria && plan.rubric.criteria.map((c) => c.id)) || [];
  return JSON.stringify({
    role: "expert-academic-assessor",
    instruction:
      "Evaluate the student answers. Return a STRICT JSON object with NO markdown. " +
      "CONTEXT: These are ORAL EXAM answers transcribed from speech (speech-to-text). " +
      "Do NOT penalize punctuation, capitalization, run-on sentences, or lack of formal/written style — " +
      "those are artifacts of transcription, not real oral skill gaps. " +
      "Score based on substantive content: accuracy, completeness, concept mastery, and how clearly the student communicates ideas verbally. " +
      "Step 1: For every rubric criterion id in " + JSON.stringify(criteriaIds) +
      ", produce a criterion entry with {criterionId, score(0-100), evidence[exact text quoted from the student answer], strengths[name one or more concrete things the student did well], gaps[name one or more concrete things to improve], rationale[short explanation], confidence(0-1)}. " +
      "Your strengths must reflect genuine positives in the student's answer (accurate concepts, clear reasoning, relevant examples, proper terminology) — do not leave strengths empty when the answer has merit. " +
      "Step 2: Also produce questionScores (one entry per student answer) with {question, answer, score, matched, strengths, gaps}. " +
      "Do NOT invent evidence. Do NOT calculate a finalScore — the server will.",
    criteria: criteriaIds.map((id) => ({ criterionId: id, score: 0, evidence: [], strengths: [], gaps: [], rationale: "", confidence: 0 })),
    rubric: plan.rubric,
    questions: plan.questions,
    answers: plan.answers,
  });
}

/**
 * Normalize the parser output into the canonical harness output shape.
 * Supports both the legacy shape ({ finalScore, questionScores }) and the
 * harness shape ({ criteria:[...] }).
 */
function harnessOutput(ctx, parsed, { runId, input }) {
  if (parsed && Array.isArray(parsed.criteria)) {
    return {
      rubric: parsed.rubric || ctx.rubric,
      criteria: parsed.criteria,
      feedback: parsed.feedback || "",
      submissionId: parsed.submissionId || null,
      promptForHash: ctx.promptForHash || null,
      contextHash: ctx.contextHash || null,
      contextVersion: ctx.contextVersion || null,
    };
  }
  const qs = Array.isArray(parsed && parsed.questionScores) ? parsed.questionScores : [];
  if (qs.length === 0) {
    throw new Error(
      "Respons model tidak mengandung array 'criteria' maupun 'questionScores'. " +
        "Output model: " + JSON.stringify(parsed || {}).slice(0, 300)
    );
  }
  // Legacy fallback: convert questionScores into criteria (one per question).
  const rubric = ctx.rubric || {
    id: "rubric-v1",
    criteria: qs.map((q, i) => ({
      id: `q${i + 1}`,
      name: q.question || `Question ${i + 1}`,
      weight: 1 / Math.max(1, qs.length),
      scale: 100,
    })),
  };
  const criteria = qs.map((q, i) => ({
    criterionId: `q${i + 1}`,
    score: q.score,
    evidence: (q.matched || []).map((m) => ({ text: m, location: "answer" })),
    rationale: [...(q.strengths || []), ...(q.gaps || [])].join(". "),
    confidence: 0.8,
  }));
  return {
    rubric,
    criteria,
    feedback: parsed.feedback || "",
    submissionId: parsed.submissionId || null,
    promptForHash: ctx.promptForHash || null,
    contextHash: ctx.contextHash || null,
    contextVersion: ctx.contextVersion || null,
  };
}

module.exports = { AssessmentHarness, defaultPrompt, buildPromptParts, buildSystemPrompt };

/**
 * Build the question ↔ rubric mapping for the trace.
 *
 * Each question declares which rubric categories it actually measures
 * (question.criteria, stamped at generation time by enforceRubricAlignment).
 * The rubric criteria (id/name/weight) are matched so the trace can display
 * every question alongside the rubric category it falls into.
 *
 * When a question declares nothing (legacy), every rubric criterion applies —
 * mirroring the evaluation fallback in buildQuestionScores.
 */
function buildQuestionRubricMap(input, rubric) {
  const questions = (input && input.assessment && input.assessment.questions) || [];
  const criteria = (rubric && rubric.criteria) || [];
  const byKey = new Map();
  for (const c of criteria) {
    const id = String(c.id || "").toLowerCase().trim();
    const name = String(c.name || "").toLowerCase().trim();
    if (id) byKey.set(id, c);
    if (name) byKey.set(name, c);
  }
  const toEntry = (c) => ({
    id: c.id,
    name: c.name || c.id,
    weight: Number(c.weight || 0),
  });
  return questions.map((q, idx) => {
    const declared = Array.isArray(q.criteria) ? q.criteria : [];
    const mapped = [];
    for (const d of declared) {
      const key = String(typeof d === "object" ? d.id || d.name || d.criterionId : d)
        .toLowerCase()
        .trim();
      const def = key ? byKey.get(key) : null;
      if (def) mapped.push(toEntry(def));
    }
    return {
      index: idx,
      prompt: (q && q.prompt && String(q.prompt).trim()) || `Soal ${idx + 1}`,
      criteria: mapped.length > 0 ? mapped : criteria.map(toEntry),
    };
  });
}