const crypto = require("node:crypto");
const { PluginRegistry } = require("./registry");
const { Pipeline } = require("./pipeline");
const { Trace } = require("./trace");
const { defaultConfig, validateConfig } = require("./config");
const { validateOutput } = require("./validator");

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

    // Build the pipeline from configured+registered plugins.
    const enabled = {};
    const map = this.config.pipeline || {};
    const registered = this.registry.list();
    for (const p of registered) {
      enabled[p.name] = typeof map[p.name] === "boolean" ? map[p.name] : true;
    }
    const pipeline = new Pipeline(registered, { enabled });

    const context = {
      runId,
      trace,
      input,
      tenantId: input.tenantId,
      userId: input.userId,
      assessment: input.assessment || null,
      rubric: null,
      prompt: null,
    };

    trace.event("ASSESSMENT_LOADED", { assessmentId: input.assessmentId });
    trace.setContext("assessmentId", input.assessmentId);
    trace.setContext("answerCount", input.answers.length);

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
      let effectivePrompt = ctx.prompt || defaultPrompt(evidencePlan);
      if (ctx.buildPrompt) effectivePrompt = await ctx.buildPrompt(ctx);

      const rawContent = await this.provider.generate({
        prompt: effectivePrompt,
        model: this.config.model.model,
        tenantId: input.tenantId,
        userId: input.userId,
        runId,
      });
      trace.event("MODEL_RESPONSE", { modelTokenEstimate: rawContent ? rawContent.length : 0 });
      trace.setContext("rawContentLength", rawContent ? rawContent.length : 0);

      const parsed = await this.parser.parse(rawContent, { prompt: effectivePrompt, context: ctx });
      trace.event("OUTPUT_PARSED");

      // Standardize: harness always produces criteria on the canonical shape.
      return harnessOutput(ctx, parsed, { runId, input });
    });

    // Final validation + compute score if plugin didn't already supply criteria-only.
    const finalResult = await this.finalize(result, { runId, input, trace });
    trace.event("VERIFICATION", { valid: finalResult.verification.valid });

    if (this.persistTrace) {
      const snap = trace.snapshot({
        model: this.config.model.model,
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
      versioning: {
        modelVersion: this.config.model.model,
        promptVersion: "v1",
        rubricVersion: (rubric && rubric.id) || "v1",
        harnessVersion: this.config.version,
        engineVersion: this.config.engineVersion,
      },
      trace: trace.snapshot({ result: undefined }).events,
    };
    trace.setContext("finalScore", output.finalScore);
    return output;
  }

  runVerification(result, rubric, weighted) {
    const issues = [];
    if (!rubric || !Array.isArray(rubric.criteria)) issues.push("Rubric tidak tersedia/tidak valid");
    if (!Array.isArray(result.criteria) || result.criteria.length === 0) issues.push("Tidak ada criterion score");
    const out = validateOutput({
      evaluationId: "pending",
      criteria: result.criteria,
      finalScore: weighted.finalScore,
    });
    if (!out.valid) issues.push(...out.issues);
    return { valid: issues.length === 0, issues };
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
 * Default evaluator prompt used when no persona/context plugin overrides it.
 */
function defaultPrompt(plan) {
  return JSON.stringify({
    role: "expert-academic-assessor",
    instruction:
      "Evaluate the student answer against each rubric criterion. " +
      "For every criterion return: score (0-100), evidence (exact text from the answer), confidence.",
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
    };
  }
  // Legacy fallback: convert questionScores into criteria (one per question).
  const rubric = ctx.rubric || {
    id: "rubric-v1",
    criteria: (parsed.questionScores || []).map((q, i) => ({
      id: `q${i + 1}`,
      name: q.question || `Question ${i + 1}`,
      weight: 1 / Math.max(1, (parsed.questionScores || []).length),
      scale: 100,
    })),
  };
  const criteria = (parsed.questionScores || []).map((q, i) => ({
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
  };
}

module.exports = { AssessmentHarness };