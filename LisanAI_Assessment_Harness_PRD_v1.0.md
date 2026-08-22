# PRD — LisanAI Assessment Harness v1.0

**Product:** LisanAI  
**Component:** Assessment Harness  
**Version:** 1.0  
**Status:** Implementation Specification  
**Primary Developer:** AI-assisted development via VS Code + DeepSeek  
**Repository:** `Hi-Day/LisanAI`

---

# 1. Executive Summary

LisanAI Assessment Harness adalah lapisan orchestration yang mengontrol bagaimana Large Language Model (LLM) melakukan assessment terhadap jawaban siswa.

Harness bertindak sebagai abstraction layer antara:

```text
LisanAI Assessment
        ↓
Assessment Harness
        ↓
LLM Provider
```

Harness bertanggung jawab terhadap:

- context assembly
- rubric injection
- evidence extraction
- evaluation
- verification
- output validation
- provenance
- telemetry
- traceability
- model/provider abstraction

LLM tidak menjadi sumber kebenaran tunggal.

Prinsip utama:

> **The model generates judgments; the harness controls, validates, and records the judgment process.**

---

# 2. Problem Statement

Implementasi AI assessment tradisional cenderung memiliki pola:

```text
Question
   ↓
Prompt
   ↓
LLM
   ↓
Score
```

Pendekatan tersebut memiliki beberapa masalah:

1. Sulit menjamin konsistensi.
2. Sulit melakukan audit terhadap score.
3. Rubric dapat bercampur dengan prompt.
4. Evidence tidak selalu terhubung dengan score.
5. Perubahan model/prompt sulit dilacak.
6. Output LLM dapat malformed.
7. Final score dapat dipengaruhi langsung oleh LLM.
8. Eksperimen AI assessment sulit direproduksi.

LisanAI membutuhkan layer yang memisahkan:

```text
Assessment Logic
        ≠
LLM Reasoning
        ≠
Score Calculation
        ≠
Audit Trail
```

---

# 3. Product Vision

Membangun **composable, traceable, model-agnostic assessment harness** untuk AI-powered assessment.

Target architecture:

```text
                     LisanAI
                        │
                        ▼
              ┌──────────────────┐
              │ Assessment API   │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ Assessment       │
              │ Harness          │
              └────────┬─────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
     Context       Evaluation      Runtime
      Layer           Layer          Layer
        │              │              │
        ▼              ▼              ▼
     Rubric         Evidence        Model
     Persona        Scoring         Session
     Question       Verification    Telemetry
     Student        Calibration     Trace
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                      LLM
```

---

# 4. Design Principles

## 4.1 Model ≠ Harness

LLM adalah reasoning engine.

Harness adalah control layer.

```text
Model
= generate / reason

Harness
= control / validate / trace
```

## 4.2 Everything Important Is Composable

Komponen assessment harus dapat diganti tanpa mengubah core engine.

Contoh:

```text
Rubric v1
Rubric v2

Evidence v1
Evidence v2

Verification v1
Verification v2
```

## 4.3 Every Evaluation Is Traceable

Setiap evaluation harus memiliki trace yang memungkinkan sistem menjawab:

> Mengapa score ini dihasilkan?

Trace minimal:

```text
Assessment
Question
Student Answer
Context
Rubric
Prompt
Model
Raw Output
Evidence
Criterion Score
Verification
Final Score
```

## 4.4 Server Is the Source of Truth

Client hanya mengirim:

```json
{
  "assessmentId": "...",
  "answers": [...]
}
```

Server mengambil questions, rubric, learning outcomes, dan assessment metadata dari database.

Client tidak boleh menentukan evaluation context.

## 4.5 LLM Does Not Calculate the Final Weighted Score

LLM menghasilkan criterion score, evidence, rationale, dan confidence.

Server melakukan weighted score calculation.

---

# 5. Goals

## Primary Goals

- [ ] Membuat abstraction `AssessmentHarness`.
- [ ] Memisahkan LLM provider dari assessment logic.
- [ ] Membuat composable plugins.
- [ ] Membuat structured rubric.
- [ ] Membuat evidence-based evaluation.
- [ ] Membuat deterministic score calculation.
- [ ] Membuat output schema validation.
- [ ] Membuat evaluation trace.
- [ ] Membuat versioning.
- [ ] Membuat deterministic mock evaluator.
- [ ] Memungkinkan eksperimen baseline vs harness.

## Secondary Goals

- [ ] Model/provider dapat diganti.
- [ ] Prompt dapat versioned.
- [ ] Harness dapat dikonfigurasi.
- [ ] Evaluation dapat direplay.
- [ ] Evaluation dataset dapat diekspor.

---

# 6. Non-Goals

Versi v1 tidak akan membuat:

- [ ] Microservices.
- [ ] Multi-agent architecture.
- [ ] Autonomous agents.
- [ ] Redis wajib.
- [ ] Kubernetes.
- [ ] Distributed workers.
- [ ] Complex plugin marketplace.
- [ ] Real-time collaborative assessment authoring.

Prinsip:

> **Build the smallest architecture that enables rigorous AI assessment research.**

---

# 7. Core Architecture

```text
api/
│
├── assessment.js
│
server/
│
├── harness/
│   ├── harness.js
│   ├── pipeline.js
│   ├── registry.js
│   ├── context.js
│   ├── trace.js
│   ├── validator.js
│   └── config.js
│
├── harness/plugins/
│   ├── persona.js
│   ├── assessment-context.js
│   ├── rubric.js
│   ├── evidence.js
│   ├── evaluation.js
│   ├── verification.js
│   ├── calibration.js
│   ├── safety.js
│   └── output.js
│
├── ai/
│   ├── provider.js
│   ├── openrouter.js
│   ├── model-router.js
│   └── response-parser.js
│
├── evaluation/
│   ├── evaluator.js
│   ├── scoring.js
│   ├── evidence.js
│   └── verification.js
│
└── telemetry/
    └── evaluation-trace.js
```

---

# 8. Harness Core

Implement:

```javascript
class AssessmentHarness {
  constructor(config) {}

  register(plugin) {}

  async evaluate(input) {}

  async trace(runId) {}

  async validate(output) {}
}
```

Pipeline:

```text
input
 ↓
load assessment
 ↓
build context
 ↓
assemble rubric
 ↓
invoke model
 ↓
parse output
 ↓
extract evidence
 ↓
validate scores
 ↓
verify
 ↓
calculate final score
 ↓
persist trace
 ↓
return result
```

---

# 9. Plugin Architecture

Each plugin harus memiliki lifecycle yang sederhana.

Recommended interface:

```javascript
{
  name: "rubric",
  version: "1.0.0",

  async before(context) {
    return context;
  },

  async after(context, result) {
    return result;
  }
}
```

Plugin tidak boleh langsung mengubah database kecuali plugin memang merupakan persistence plugin.

---

# 10. Required Plugins

## 10.1 Persona Plugin

Menentukan role evaluator.

Contoh:

```text
You are an expert academic assessor.
Evaluate the student's answer according to the supplied rubric.
Do not invent evidence.
```

## 10.2 Assessment Context Plugin

Memasukkan course, topic, learning outcome, question, dan expected competency.

Context harus berasal dari server.

## 10.3 Rubric Plugin

Rubric harus structured.

```json
{
  "id": "rubric-v1",
  "criteria": [
    {
      "id": "concept",
      "name": "Conceptual Understanding",
      "weight": 0.4,
      "scale": 100
    },
    {
      "id": "application",
      "name": "Application",
      "weight": 0.3,
      "scale": 100
    },
    {
      "id": "communication",
      "name": "Communication",
      "weight": 0.3,
      "scale": 100
    }
  ]
}
```

Validation:

```text
sum(weight) === 1
```

---

# 11. Evidence Plugin

LLM harus mengidentifikasi evidence dari student answer.

```json
{
  "criterionId": "concept",
  "evidence": [
    {
      "text": "...",
      "location": "answer"
    }
  ]
}
```

Rule:

> Evidence must be grounded in the student's actual response.

---

# 12. Evaluation Plugin

LLM menghasilkan criterion-level evaluation.

```json
{
  "criterionId": "concept",
  "score": 82,
  "rationale": "...",
  "confidence": 0.87
}
```

LLM tidak menghasilkan final weighted score.

---

# 13. Verification Plugin

Verification memeriksa:

1. Score valid.
2. Evidence tersedia.
3. Evidence berasal dari answer.
4. Rationale sesuai evidence.
5. Criterion lengkap.
6. Output sesuai schema.

```json
{
  "valid": true,
  "issues": []
}
```

Jika invalid:

```text
Evaluation
    ↓
Verification
    ↓
INVALID
    ↓
Retry / Repair
```

Default:

```text
maxRetries = 1
```

---

# 14. Output Plugin

Canonical output:

```json
{
  "evaluationId": "...",
  "assessmentId": "...",
  "submissionId": "...",
  "criteria": [
    {
      "criterionId": "concept",
      "score": 82,
      "evidence": [],
      "rationale": "...",
      "confidence": 0.87
    }
  ],
  "finalScore": 81,
  "verification": {
    "valid": true
  }
}
```

---

# 15. Deterministic Scoring Engine

Implement:

```javascript
calculateFinalScore(criteria, rubric)
```

Formula:

```text
Final Score = Σ (criterionScore × criterionWeight)
```

Example:

```text
Concept       82 × 0.40 = 32.8
Application   76 × 0.30 = 22.8
Communication 85 × 0.30 = 25.5

Final = 81.1
```

Final rounding harus dilakukan oleh server.

---

# 16. Trace System

Setiap evaluation memiliki `runId`.

Trace bersifat append-only.

Contoh event:

```json
{
  "runId": "run_001",
  "events": [
    { "type": "ASSESSMENT_LOADED" },
    { "type": "CONTEXT_BUILT" },
    { "type": "RUBRIC_LOADED" },
    { "type": "MODEL_REQUEST" },
    { "type": "MODEL_RESPONSE" },
    { "type": "EVIDENCE_EXTRACTED" },
    { "type": "SCORE_VALIDATED" },
    { "type": "VERIFICATION" },
    { "type": "FINAL_SCORE" }
  ]
}
```

Trace harus memungkinkan reconstruction:

```text
What happened?
Why?
Which model?
Which prompt?
Which rubric?
Which harness?
Which evidence?
Which score?
```

---

# 17. Versioning

Setiap evaluation menyimpan:

```text
modelVersion
promptVersion
rubricVersion
harnessVersion
engineVersion
```

---

# 18. AI Provider Abstraction

```javascript
class AIProvider {
  async generate(request) {}
}
```

Provider dapat berupa:

```text
AIProvider
   │
   ├── OpenRouter
   ├── DeepSeek
   ├── OpenAI
   ├── Bedrock
   └── Local vLLM
```

Assessment Harness tidak boleh mengetahui detail provider.

---

# 19. Configuration

Contoh:

```json
{
  "version": "1.0",
  "model": {
    "provider": "openrouter",
    "model": "deepseek"
  },
  "plugins": {
    "persona": "v1",
    "rubric": "v1",
    "evidence": "v1",
    "evaluation": "v1",
    "verification": "v1",
    "output": "v1"
  },
  "verification": {
    "enabled": true,
    "maxRetries": 1
  }
}
```

Tujuannya:

```text
Change configuration
        ↓
Change harness behavior
        ↓
No core rewrite
```

---

# 20. Research Mode

Harness menyediakan mode eksperimen.

## Baseline

```text
Question
 ↓
Student Answer
 ↓
LLM
 ↓
Score
```

## Harness v1

```text
Question
 ↓
Rubric
 ↓
LLM
 ↓
Score
```

## Harness v2

```text
Question
 ↓
Rubric
 ↓
Evidence
 ↓
LLM
 ↓
Verification
 ↓
Score
```

## Harness v3

```text
Context
 ↓
Rubric
 ↓
Evidence
 ↓
Evaluation
 ↓
Verification
 ↓
Deterministic Scoring
```

Konfigurasi eksperimen harus dapat menentukan plugin yang aktif.

---

# 21. Evaluation Metrics

## Validity

- Human-AI agreement
- Pearson correlation
- Spearman correlation
- MAE
- RMSE

## Reliability

- Inter-run variance
- Score standard deviation
- Exact agreement
- Adjacent agreement

## Rubric Compliance

- Criterion coverage
- Evidence coverage
- Output schema compliance

## Operational

- Latency
- Input tokens
- Output tokens
- Estimated cost
- Error rate
- Retry rate

---

# 22. Human Evaluation

Untuk submission yang sama, simpan:

```text
AI Score
Human Score
```

Tambahkan:

```text
humanScore
humanFeedback
reviewedAt
```

Tujuan: membangun dataset AI-vs-Human evaluation.

---

# 23. Security Requirements

- [ ] Assessment context di-load server-side.
- [ ] Client tidak dapat mengubah rubric.
- [ ] Client tidak dapat mengubah question.
- [ ] Client tidak dapat mengubah learning outcome.
- [ ] Tenant isolation wajib.
- [ ] Authorization wajib.
- [ ] CSRF protection tetap aktif.
- [ ] Session validation tetap aktif.
- [ ] Trace tidak boleh dapat dimodifikasi student.

---

# 24. Testing Strategy

## Unit Tests

- [ ] Rubric validation.
- [ ] Weight calculation.
- [ ] Score calculation.
- [ ] Output validation.
- [ ] Evidence validation.
- [ ] Version resolution.
- [ ] Plugin lifecycle.

## Integration Tests

- [ ] Full evaluation pipeline.
- [ ] OpenRouter mock.
- [ ] Database persistence.
- [ ] Trace persistence.

## Security Tests

- [ ] Tenant isolation.
- [ ] Unauthorized assessment.
- [ ] Rubric manipulation.
- [ ] Question manipulation.
- [ ] Submission manipulation.

## Research Tests

- [ ] Same answer produces stable result under fixed configuration.
- [ ] Different rubric produces expected differences.
- [ ] Evidence corresponds to answer.
- [ ] Invalid output triggers verification.
- [ ] Baseline and harness can be compared.

---

# 25. Mock Mode

Mock evaluator harus deterministic.

Contoh:

```text
answer_001 → 85
answer_002 → 72
answer_003 → 91
```

Tidak boleh menggunakan `Math.random()`.

Mock mode digunakan untuk unit tests, integration tests, CI/CD, dan frontend development.

---

# 26. Database Changes

Minimum entities:

```text
evaluation_runs
evaluation_events
evaluation_results
evaluation_criteria
evaluation_evidence
evaluation_versions
```

Relationship:

```text
Assessment
    │
    ▼
Submission
    │
    ▼
Evaluation Run
    │
    ├── Events
    ├── Criteria
    ├── Evidence
    └── Result
```

---

# 27. Backward Compatibility

Harness v1 harus dapat berjalan dengan assessment yang sudah ada.

Migration strategy:

```text
Existing Assessment
        ↓
Adapter
        ↓
Canonical Assessment
        ↓
Harness
```

Jangan melakukan database rewrite besar sekaligus.

---

# 28. Implementation Strategy

## Phase 1 — Foundation

- [ ] Create `server/harness`.
- [ ] Implement `AssessmentHarness`.
- [ ] Implement plugin registry.
- [ ] Implement pipeline.
- [ ] Implement configuration.
- [ ] Implement trace.

## Phase 2 — Evaluation

- [ ] Implement rubric plugin.
- [ ] Implement evidence plugin.
- [ ] Implement evaluation plugin.
- [ ] Implement verification plugin.
- [ ] Implement output validation.
- [ ] Implement deterministic scoring.

## Phase 3 — Provider

- [ ] Extract AI provider abstraction.
- [ ] Adapt OpenRouter.
- [ ] Add DeepSeek provider if required.
- [ ] Add mock provider.

## Phase 4 — Research

- [ ] Add experiment configuration.
- [ ] Add baseline mode.
- [ ] Add harness modes.
- [ ] Add evaluation metrics.
- [ ] Add human score.

## Phase 5 — Integration

- [ ] Connect existing `/api/assessment`.
- [ ] Replace direct evaluator call.
- [ ] Preserve existing frontend contract where possible.
- [ ] Run existing security tests.
- [ ] Add new harness tests.

---

# 29. Recommended Development Order

Jangan meminta DeepSeek membangun seluruh PRD sekaligus.

Gunakan urutan:

```text
1. Inspect repository
        ↓
2. Understand existing architecture
        ↓
3. Implement Harness Core
        ↓
4. Implement deterministic scoring
        ↓
5. Implement rubric
        ↓
6. Implement evidence
        ↓
7. Implement verification
        ↓
8. Implement trace
        ↓
9. Implement provider abstraction
        ↓
10. Integrate with assessment API
        ↓
11. Add tests
        ↓
12. Research mode
```

Setiap fase harus menghasilkan code yang tetap runnable.

---

# 30. Acceptance Criteria

## Functional

- [ ] Assessment dapat dievaluasi melalui Harness.
- [ ] Student hanya mengirim answer.
- [ ] Server mengambil canonical assessment.
- [ ] Rubric diproses secara structured.
- [ ] Evidence dihasilkan.
- [ ] Criterion score dihasilkan.
- [ ] Final score dihitung deterministic.
- [ ] Output tervalidasi.

## Traceability

- [ ] Setiap evaluation memiliki `runId`.
- [ ] Model tercatat.
- [ ] Prompt version tercatat.
- [ ] Rubric version tercatat.
- [ ] Harness version tercatat.
- [ ] Evidence tersimpan.
- [ ] Verification tersimpan.

## Security

- [ ] Client tidak dapat memanipulasi rubric.
- [ ] Client tidak dapat memanipulasi question.
- [ ] Tenant isolation tetap bekerja.

## Research

- [ ] Baseline dapat dijalankan.
- [ ] Harness dapat dijalankan.
- [ ] Kedua konfigurasi dapat dibandingkan.
- [ ] AI score dapat dibandingkan dengan human score.
- [ ] Trace dapat diekspor.

---

# 31. Definition of Done

Feature dianggap selesai hanya jika:

```text
Code
 ↓
Unit Test
 ↓
Integration Test
 ↓
Security Test
 ↓
Trace Verification
 ↓
Documentation
```

Tidak boleh dianggap selesai hanya karena API berhasil return 200.

---

# 32. Key Architectural Constraint

Jangan membuat:

```text
LLM
 ↓
Final Score
```

Harus:

```text
LLM
 ↓
Evidence
 ↓
Criterion Scores
 ↓
Verification
 ↓
Deterministic Scoring
 ↓
Final Score
```

---

# 33. Research Hypothesis

> **H1: A composable assessment harness improves the reliability, consistency, rubric compliance, and explainability of LLM-based assessment compared with a single-prompt baseline.**

Variabel:

```text
Independent Variable
= Harness configuration

Dependent Variables
= Agreement
= Consistency
= Evidence quality
= Rubric compliance
= Format compliance
= Latency
= Cost
```

---

# 34. Strategic Positioning

LisanAI bukan sekadar:

```text
LLM Grading System
```

tetapi:

```text
AI Assessment
      +
Assessment Harness
      +
Evidence
      +
Verification
      +
Auditability
```

Target positioning:

> **LisanAI is an evidence-based, traceable AI assessment platform powered by a composable assessment harness.**

---

# 35. Important Implementation Rule for DeepSeek

DeepSeek digunakan sebagai **software engineering agent**, bukan sebagai architectural authority.

Setiap implementasi harus mengikuti:

```text
PRD
 ↓
Inspect current code
 ↓
Plan
 ↓
Implement smallest change
 ↓
Run tests
 ↓
Inspect diff
 ↓
Fix
 ↓
Commit
```

Jangan meminta agent mengimplementasikan seluruh PRD sekaligus. Berikan satu milestone pada satu waktu.

---

# 36. First Implementation Task

Task pertama yang diberikan kepada DeepSeek:

> **Do not modify application behavior yet. Inspect the existing LisanAI repository and produce an architecture map showing the current assessment flow, database entities, AI invocation points, authentication/authorization boundaries, and the minimum integration points required to introduce `AssessmentHarness`. Do not write code until the architecture map is complete.**

Setelah architecture map selesai, baru implement:

```text
AssessmentHarness
PluginRegistry
Pipeline
Trace
```

tanpa mengubah scoring behavior terlebih dahulu.

---

# 37. Success Metric for v1

Target utama bukan jumlah fitur.

Target utama:

> **One existing LisanAI assessment can pass through the new Harness and produce exactly the same functional result as the existing evaluator, while additionally producing a complete, versioned, auditable evaluation trace.**

---

# 38. Recommended Strategy

Gunakan DeepSeek untuk implementasi, tetapi **jangan menjadikan DeepSeek Harness sebagai dependency inti LisanAI**.

Yang dipinjam:

- composability
- plugin architecture
- configuration-driven behavior
- traceability
- model/harness separation

Yang tetap dibangun sendiri:

- assessment domain model
- rubric engine
- evidence engine
- verification
- deterministic scoring
- research instrumentation

Dengan demikian eksperimen dapat membedakan pengaruh:

```text
Model
vs
Harness
vs
Harness + Model
```

dan LisanAI tetap model-agnostic.
