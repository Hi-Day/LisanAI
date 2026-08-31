const crypto = require("node:crypto");
const { PluginRegistry } = require("./registry");
const { Pipeline } = require("./pipeline");
const { Trace } = require("./trace");
const { defaultConfig, validateConfig } = require("./config");
const { validateOutput } = require("./validator");
const { buildReproducibilityHashes } = require("./reproducibility");
const { buildHarnessManifest } = require("./manifest");
const contextCache = require("./context-cache");

/**
 * AssessmentHarness — controls, validates, and records the judgment process.
 * The harness is the canonical evaluation boundary; plugins are versioned
 * components and every run records the active component manifest.
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
    this.provider = provider;
    return this;
  }

  setParser(parser) {
    this.parser = parser;
    return this;
  }

  setTracePersister(fn) {
    this.persistTrace = fn;
    return this;
  }

  getManifest() {
    return buildHarnessManifest({ config: this.config, plugins: this.registry.list() });
  }

  async evaluate(input) {
    validateConfig(this.config);
    if (!this.provider) throw new Error("Harness membutuhkan provider (setProvider)");
    if (!this.parser) throw new Error("Harness membutuhkan output parser (setParser)");
    if (!input || !Array.isArray(input.answers)) {
      throw new Error("input harus berisi answers array");
    }

    const runId = AssessmentHarness.createRunId();
    const trace = new Trace(runId, { tenantId: input.tenantId, userId: input.userId });
    const manifest = this.getManifest();
    trace.setContext("harnessManifest", manifest);

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
      harnessManifest: manifest,
    };

    trace.event("ASSESSMENT_LOADED", { assessmentId: input.assessmentId });
    trace.setContext("assessmentId", input.assessmentId);
    trace.setContext("answerCount", input.answers.length);

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
        harnessManifest: manifest,
        result: finalResult,
      });
      try {
        await this.persistTrace(snap);
      } catch (err) {
        trace.event("TRACE_PERSIST_ERROR", { message: err.message });
      }
    }

    return finalResult;
  }

  async runOnce(context, input, runId) {
    const trace = context.trace;
    const enabled = {};
    const map = this.config.pipeline || {};
    const registered = this.registry.list();
    for (const p of registered) {
      enabled[p.name] = typeof map[p.name] === "boolean" ? map[p.name] : true;
    }
    const pipeline = new Pipeline(registered, { enabled });

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

      const parts = (ctx.promptParts && (await ctx.promptParts(ctx))) || buildPromptParts(evidencePlan);
      const combined = defaultPrompt(evidencePlan);
      ctx.systemPrompt = parts.system || ctx.prompt || "";
      ctx.userMessage = parts.user || "";
      ctx.promptForHash = combined;

      const { computeContextHash, computeContextVersion, getWithPersistence, persistToDb } = contextCache;
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
      const cachedContext = await getWithPersistence(input.tenantId, ctxHash);
      if (cachedContext) {
        trace.event("CONTEXT_CACHE_HIT", { contextHash: ctxHash, contextVersion: ctxVersion });
        if (cachedContext.systemPrompt) ctx.systemPrompt = cachedContext.systemPrompt;
        if (cachedContext.rubric) ctx.rubric = cachedContext.rubric;
      } else {
        trace.event("CONTEXT_CACHE_MISS", { contextHash: ctxHash, contextVersion: ctxVersion });
        const artifact = {
          contextHash: ctxHash,
          contextVersion: ctxVersion,
          systemPrompt: ctx.systemPrompt,
          rubric: ctx.rubric,
          compiledAt: new Date().toISOString(),
        };
        contextCache.set(input.tenantId, ctxHash, artifact);
        await persistToDb(input.tenantId, ctxHash, ctxVersion, artifact);
      }

      const rawContent = await this.provider.generate({
        prompt: combined,
        systemPrompt: ctx.systemPrompt,
        userMessage: ctx.userMessage,
        model: this.config.model.model,
        tenantId: input.tenantId,
        userId: input.userId,
        runId,
        schemaHint: ctx.evaluationHint || "Balas JSON valid.",
        temperature: this.config.model.temperature,
        topP: this.config.model.topP,
        maxTokens: this.config.model.maxTokens,
      });
      trace.event("MODEL_RESPONSE", { modelTokenEstimate: rawContent ? rawContent.length : 0 });
      trace.setContext("rawContentLength", rawContent ? rawContent.length : 0);

      const parsed = await this.parser.parse(rawContent, { prompt: combined, context: ctx });
      trace.event("OUTPUT_PARSED");
      return harnessOutput(ctx, parsed, { runId, input });
    });

    return this.finalize(result, { runId, input, trace });
  }

  async finalize(result, { runId, input, trace }) {
    const rubric = result.rubric || {};
    const criteria = result.criteria || [];
    const scoring = require("../evaluation/scoring");
    const weighted = scoring.calculateFinalScore(criteria, rubric);
    trace.event("FINAL_SCORE", { finalScore: weighted.finalScore, formula: weighted.formula });

    const verificationResult = this.runVerification(result, rubric, criteria);
    let reliability = null;
    if (this.config.pipeline && this.config.pipeline.reliability !== false && verificationResult) {
      const { reliabilityVector } = require("./scoring/reliability");
      reliability = reliabilityVector({ criteria, rubricCriteria: (rubric && rubric.criteria) || [], verification: verificationResult, valid: verificationResult.status === "FAIL" ? false : true });
      trace.event("RELIABILITY", { overall: reliability.overallReliability, dimensions: reliability.dimensions });
      trace.setContext("overallReliability", reliability.overallReliability);
    }

    const hashes = buildReproducibilityHashes({ answers: (input && input.answers) || [], rubric, prompt: result.promptForHash || input.promptForHash || null, config: this.config });
    trace.setContext("reproducibility", hashes);

    const status = verificationResult.status;
    let published = status === "PASS";
    let requiresHumanReview = status === "REVIEW";
    let risk = this.computeRisk(criteria, verificationResult, input);
    if (risk) {
      risk = { ...risk, ...this.applyRiskPolicy(risk) };
      const policy = risk.policy;
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
      harnessManifest: contextManifest(trace),
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

  runVerification(result, rubric, weighted) {
    const pluginVerification = (result && result.verification) || {};
    if (pluginVerification.status && pluginVerification.valid !== undefined) {
      return { valid: pluginVerification.valid, issues: pluginVerification.issues || [], status: pluginVerification.status, reasons: pluginVerification.reasons || [], scoreConsistency: pluginVerification.scoreConsistency };
    }
    const fatalIssues = [];
    if (!rubric || !Array.isArray(rubric.criteria)) fatalIssues.push("Rubric tidak tersedia/tidak valid");
    if (!Array.isArray(result.criteria) || result.criteria.length === 0) fatalIssues.push("Tidak ada criterion score");
    const out = validateOutput({ evaluationId: "pending", criteria: result.criteria, finalScore: weighted.finalScore });
    if (!out.valid) fatalIssues.push(...out.issues);
    return { valid: fatalIssues.length === 0, issues: fatalIssues, status: fatalIssues.length === 0 ? "PASS" : "FAIL", reasons: fatalIssues, scoreConsistency: null };
  }

  computeRisk(criteria, verification, input) {
    const riskCfg = this.config.risk;
    if (!riskCfg || riskCfg.enabled === false) return null;
    const { computeRiskScore } = require("./risk");
    const score = computeRiskScore({ criteria, verification, difficulty: input && input.assessment ? input.assessment.difficulty : null }, riskCfg.weights);
    return { score };
  }

  applyRiskPolicy(risk) {
    const { classifyRisk, applyPolicy } = require("./risk");
    const riskCfg = this.config.risk || {};
    const level = classifyRisk(risk.score, riskCfg.thresholds);
    const policy = applyPolicy(level, {}, riskCfg.policy);
    return { score: risk.score, level, policy };
  }

  async trace(runId) {
    if (!this.persistTrace) return { runId, available: false };
    const saved = await this.persistTrace({ mode: "read", runId });
    return saved ?? { runId, available: false };
  }

  async validate(runOrOutput) {
    if (runOrOutput && runOrOutput.criteria) return validateOutput(runOrOutput);
    return { valid: false, issues: ["tidak ada output untuk divalidasi"] };
  }
}

function contextManifest(trace) {
  return trace.getContext("harnessManifest") || null;
}

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

function buildPromptParts(plan) {
  return { system: buildSystemPrompt(plan), user: JSON.stringify({ task: "Evaluate the student's oral exam answers below against the rubric criteria.", studentName: plan.studentName || null, answers: plan.answers || [] }) };
}

function defaultPrompt(plan) {
  const criteriaIds = (plan.rubric && plan.rubric.criteria && plan.rubric.criteria.map((c) => c.id)) || [];
  return JSON.stringify({ role: "expert-academic-assessor", instruction: "Evaluate student ORAL EXAM answers against rubric.", rubric: plan.rubric, questions: plan.questions, criteriaIds, answers: plan.answers, output: "STRICT JSON with criteria and questionScores; do not compute finalScore." });
}

function harnessOutput(ctx, parsed, { runId, input }) {
  return { ...parsed, runId, submissionId: input.submissionId || null, rubric: ctx.rubric, promptForHash: ctx.promptForHash, contextHash: ctx.contextHash, contextVersion: ctx.contextVersion };
}

module.exports = { AssessmentHarness, buildSystemPrompt, buildPromptParts, defaultPrompt };
