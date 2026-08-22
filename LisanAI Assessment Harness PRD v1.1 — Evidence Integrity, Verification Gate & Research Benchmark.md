# LisanAI Assessment Harness PRD v1.1

## Evidence Integrity, Verification Gate & Research Benchmark

**Product:** LisanAI  
**Repository:** `Hi-Day/LisanAI`  
**Version:** 1.1  
**Status:** Implementation Specification  
**Audience:** Software Engineer, AI Engineer, Researcher, LLM Coding Agent  
**Primary Implementation Environment:** VS Code + LLM Coding Agent  
**Primary Goal:** Mengubah existing LisanAI Harness menjadi evidence-grounded, verification-gated, reproducible, dan research-ready assessment engine.

---

# 1. Executive Summary

LisanAI saat ini telah memiliki:

- Assessment Engine
- Rubric Engine
- LLM Evaluation
- Harness Pipeline
- Evidence Plugin
- Verification Plugin
- Deterministic Scoring
- Trace
- Versioning
- Automated Tests
- Baseline/Harness feature switching

Architecture tersebut sudah cukup matang untuk dijadikan fondasi penelitian.

Namun terdapat lima gap utama:

1. Evidence grounding masih berpotensi terkontaminasi oleh ideal answer.
2. Verification masih bersifat diagnostic, belum menjadi decision gate.
3. Evidence belum memiliki provenance yang cukup kuat.
4. Belum terdapat benchmark dengan human ground truth.
5. Belum terdapat pipeline eksperimen formal untuk membandingkan Baseline vs Harness.

PRD ini menyelesaikan kelima gap tersebut tanpa melakukan rewrite terhadap LisanAI.

---

# 2. Product Vision

LisanAI harus berkembang dari:

```text
LLM → Score
```

menjadi:

```text
Student Answer
      ↓
Evidence
      ↓
Criterion Judgment
      ↓
Verification
      ↓
Deterministic Score
      ↓
Reliability
      ↓
Auditable Result
```

Prinsip inti:

> **The model proposes; the harness verifies; the scoring engine decides; the trace explains.**

---

# 3. Objectives

## Primary Objectives

### O1 — Evidence Integrity

Memastikan setiap evidence berasal dari jawaban mahasiswa yang sebenarnya.

### O2 — Verification Governance

Memastikan evaluation yang tidak memenuhi verification criteria tidak dapat diperlakukan sebagai valid final result.

### O3 — Provenance

Memungkinkan setiap score ditelusuri kembali ke:

```text
Final Score
→ Criterion
→ Judgment
→ Evidence
→ Student Answer
```

### O4 — Research Reproducibility

Setiap evaluation harus dapat direproduksi berdasarkan configuration dan version metadata.

### O5 — Empirical Validation

Membangun benchmark untuk membandingkan:

```text
Single-Prompt Baseline
vs
LisanAI Harness
```

terhadap human assessment.

---

# 4. Non-Goals

PRD ini tidak mencakup:

- rewrite frontend;
- migrasi database;
- multi-model consensus;
- agentic evaluation;
- calibration model;
- embedding-based grounding sebagai default;
- billing;
- advanced analytics dashboard;
- marketplace;
- deployment architecture overhaul.

Fitur-fitur tersebut dapat menjadi roadmap berikutnya.

---

# 5. Current Architecture

Architecture existing dipertahankan:

```text
server/harness/
├── harness.js
├── harness-evaluator.js
├── pipeline.js
├── registry.js
├── trace.js
├── validator.js
├── config.js
└── plugins/
    ├── persona.js
    ├── assessmentContext.js
    ├── rubric.js
    ├── evidence.js
    ├── evaluation.js
    └── verification.js
```

Tidak diperlukan refactor folder besar.

---

# 6. Target Architecture

```text
                     Student Answer
                           │
                           ▼
                  Assessment Context
                           │
                           ▼
                        Rubric
                           │
                           ▼
                   Evidence Extraction
                           │
                           ▼
                 Criterion-Evidence Map
                           │
                           ▼
                   LLM Criterion Judgment
                           │
                           ▼
                     Verification
                           │
                   ┌───────┴───────┐
                   │               │
                 PASS            FAIL/REVIEW
                   │               │
                   ▼               ▼
          Deterministic Score   Re-evaluation/
                   │             Human Review
                   ▼
              Reliability
                   │
                   ▼
              Final Result
                   │
                   ▼
               Audit Trace
```

---

# 7. Design Principle: Evidence Is Not Judgment

Sistem harus memisahkan:

## Evidence

Apa yang benar-benar dikatakan mahasiswa?

## Judgment

Seberapa baik pernyataan tersebut memenuhi criterion?

## Score

Berapa nilai numeriknya?

Contoh:

```text
Student Answer
"Fotosintesis menggunakan cahaya untuk menghasilkan makanan."
```

Evidence:

```text
"menggunakan cahaya untuk menghasilkan makanan"
```

Judgment:

```text
Criterion:
Memahami mekanisme dasar fotosintesis

Judgment:
Partial-to-strong evidence
```

Score:

```text
82
```

Final score:

```text
Σ criterion_score × criterion_weight
```

---

# 8. Functional Requirements

# FR-01 — Evidence Contamination Prevention

## Requirement

Evidence grounding **MUST** menggunakan student answer sebagai satu-satunya source corpus.

Ideal answer/reference answer:

- boleh digunakan sebagai evaluation context;
- boleh digunakan untuk memahami expected answer;
- tidak boleh digunakan untuk membuktikan student evidence.

## Forbidden

```text
studentAnswer + idealAnswer
        ↓
grounding
```

## Required

```text
studentAnswer ONLY
        ↓
grounding
```

## Acceptance Criteria

- Evidence yang hanya muncul pada ideal answer tidak dapat menjadi `grounded=true`.
- Unit test tersedia.
- Regression test tersedia.
- Existing evaluation tetap berjalan.

## Priority

**P0**

---

# 9. FR-02 — Evidence Provenance

Evidence harus memiliki provenance minimal.

## Target Schema

```json
{
  "criterionId": "C1",
  "text": "menggunakan cahaya untuk menghasilkan makanan",
  "answerIndex": 0,
  "grounded": true,
  "groundingMethod": "lexical",
  "confidence": 0.91
}
```

Optional:

```json
{
  "start": 42,
  "end": 86
}
```

## Required Fields

- `criterionId`
- `text`
- `answerIndex`
- `grounded`
- `groundingMethod`

## Optional Fields

- `start`
- `end`
- `confidence`

---

# 10. FR-03 — Grounding Methods

Phase 1 hanya menggunakan deterministic lexical grounding.

Supported:

```text
lexical
```

Potential future:

```text
semantic
hybrid
```

Jangan mengimplementasikan embedding-based grounding pada phase ini.

Tujuan phase ini adalah mendapatkan baseline yang reproducible.

---

# 11. FR-04 — Criterion-Evidence Mapping

Setiap criterion harus memiliki evidence yang eksplisit.

## Required structure

```json
{
  "criterionId": "C1",
  "evidence": [
    {
      "text": "...",
      "grounded": true
    }
  ],
  "judgment": {
    "score": 82,
    "rationale": "..."
  }
}
```

## Rule

Criterion tidak boleh menggunakan evidence global yang tidak memiliki mapping.

---

# 12. FR-05 — Missing Evidence

Jika criterion tidak memiliki evidence:

```text
evidence = []
```

maka sistem harus menghasilkan:

```text
evidenceStatus = "MISSING"
```

dan tidak boleh menganggap criterion tersebut fully supported.

---

# 13. FR-06 — Evidence Grounding Status

Evidence harus memiliki status:

```text
GROUNDED
UNSUPPORTED
MISSING
```

### GROUNDED

Evidence dapat ditemukan dalam student answer.

### UNSUPPORTED

Evidence diklaim oleh LLM tetapi tidak ditemukan dalam student answer.

### MISSING

Tidak ada evidence untuk criterion.

---

# 14. FR-07 — Criterion Judgment

LLM menghasilkan criterion-level judgment.

Target schema:

```json
{
  "criterionId": "C1",
  "score": 82,
  "evidence": [],
  "rationale": "...",
  "confidence": 0.84
}
```

LLM **MUST NOT** menghasilkan final weighted score.

---

# 15. FR-08 — Deterministic Scoring

Final score harus dihitung application layer.

Formula:

```text
FinalScore =
Σ(score_i × weight_i)
```

Requirements:

- total rubric weight = 1;
- score range valid;
- rounding deterministic;
- calculation tidak menggunakan LLM.

---

# 16. FR-09 — Verification Engine

Verification harus melakukan minimal lima pemeriksaan:

### V1 — Schema Validity

Output sesuai expected schema.

### V2 — Evidence Grounding

Evidence benar-benar berasal dari student answer.

### V3 — Criterion Coverage

Semua criterion memiliki judgment.

### V4 — Score Validity

Score berada dalam range yang valid.

### V5 — Evidence/Judgment Consistency

Score dan judgment tidak bertentangan secara obvious dengan evidence.

---

# 17. FR-10 — Verification Gate

Verification harus menghasilkan:

```text
PASS
REVIEW
FAIL
```

## PASS

Evaluation dapat diterbitkan secara otomatis.

## REVIEW

Evaluation valid secara teknis tetapi memiliki reliability concern.

## FAIL

Evaluation tidak boleh diterbitkan sebagai final result.

---

# 18. Verification Decision Matrix

| Condition | Status |
|---|---|
| Schema invalid | FAIL |
| Evidence unsupported | REVIEW/FAIL |
| Missing critical criterion | FAIL |
| Invalid score | FAIL |
| Evidence weak + high score | REVIEW |
| All criteria valid | PASS |
| Non-critical warning | REVIEW |
| No issue | PASS |

Status final harus configurable.

---

# 19. FR-11 — Verification Gate Behavior

Target flow:

```text
LLM Evaluation
      ↓
Verification
      ↓
 ┌────┼────┐
 ↓    ↓    ↓
PASS REVIEW FAIL
 ↓     ↓     ↓
Score Human Retry
       Review
```

`FAIL` dapat memicu re-evaluation.

`REVIEW` dapat diteruskan tetapi harus diberi status review.

---

# 20. FR-12 — Re-evaluation

Jika verification menghasilkan `FAIL`:

```text
Evaluation
 ↓
Verification
 ↓
FAIL
 ↓
Re-evaluation
 ↓
Verification
```

Maximum retry:

```text
MAX_EVALUATION_RETRIES=1
```

Tidak boleh terjadi infinite loop.

---

# 21. FR-13 — Score Publication Rule

Final score tidak boleh dianggap `published` sebelum verification selesai.

Target:

```json
{
  "score": 82,
  "verification": {
    "status": "PASS"
  },
  "published": true
}
```

Untuk:

```json
{
  "score": 82,
  "verification": {
    "status": "FAIL"
  },
  "published": false
}
```

Untuk REVIEW:

```json
{
  "score": 82,
  "verification": {
    "status": "REVIEW"
  },
  "published": false,
  "requiresHumanReview": true
}
```

---

# 22. FR-14 — Audit Trace

Setiap evaluation harus memiliki trace.

Minimal:

```json
{
  "evaluationId": "...",
  "runId": "...",
  "model": "...",
  "modelVersion": "...",
  "provider": "...",
  "promptVersion": "...",
  "rubricVersion": "...",
  "harnessVersion": "...",
  "engineVersion": "...",
  "temperature": 0,
  "inputHash": "...",
  "rubricHash": "...",
  "promptHash": "...",
  "configHash": "...",
  "criteria": [],
  "verification": {},
  "scoring": {},
  "reliability": {}
}
```

---

# 23. FR-15 — Reproducibility Hashes

Sistem harus menghasilkan hash untuk:

```text
inputHash
rubricHash
promptHash
configHash
```

Tujuan:

> memastikan bahwa dua evaluation run benar-benar menggunakan input dan configuration yang sama.

---

# 24. FR-16 — Model Metadata

Trace harus menyimpan:

```text
provider
model
modelVersion
temperature
topP
```

Jika provider tidak menyediakan model snapshot, field tersebut harus bernilai:

```text
null
```

bukan fabricated value.

---

# 25. FR-17 — Evaluation Modes

LisanAI harus menyediakan dua mode.

## Baseline

```text
Student Answer
 ↓
Single Prompt
 ↓
LLM
 ↓
Score
```

## Harness

```text
Student Answer
 ↓
Rubric
 ↓
Evidence
 ↓
Criterion Judgment
 ↓
Verification
 ↓
Deterministic Score
```

Input harus identik.

---

# 26. FR-18 — Benchmark Dataset

Minimal:

```text
100–300 responses
```

Dataset harus menyimpan:

```json
{
  "sampleId": "S001",
  "questionId": "Q001",
  "question": "...",
  "rubric": {},
  "studentAnswer": "...",
  "humanScore": 82
}
```

Ideal:

```json
{
  "humanCriterionScores": {},
  "humanFeedback": "...",
  "raterId": "R1"
}
```

---

# 27. FR-19 — Human Ground Truth

Human score menjadi external reference.

Architecture:

```text
Student Answer
      │
 ┌────┴────┐
 ↓         ↓
Human      AI
 ↓         ↓
Score      Score
 └────┬────┘
      ↓
 Comparison
```

AI tidak boleh digunakan untuk membuat ground truth bagi eksperimen utamanya.

---

# 28. FR-20 — Inter-Rater Reliability

Jika terdapat dua atau lebih human raters, sistem harus menghitung agreement.

Possible metrics:

- Cohen's Kappa;
- weighted Kappa;
- ICC.

Metric final dipilih berdasarkan karakteristik scoring scale.

---

# 29. FR-21 — Research Runner

Diperlukan command/tool yang dapat menjalankan:

```text
dataset
 ↓
baseline
 ↓
harness
 ↓
metrics
 ↓
report
```

Output:

```text
results/
├── baseline.jsonl
├── harness.jsonl
├── metrics.json
└── report.json
```

---

# 30. FR-22 — Evaluation Metrics

## Agreement

- Pearson correlation
- Spearman correlation
- MAE
- RMSE

## Agreement Bands

- exact agreement;
- ±5;
- ±10.

## Consistency

Repeated runs:

- mean;
- standard deviation;
- variance;
- range.

## Evidence

- grounding rate;
- unsupported evidence rate;
- missing evidence rate.

## Output

- schema validity;
- format compliance;
- missing field rate.

## Operational

- latency;
- token usage;
- cost.

---

# 31. FR-23 — Reliability Metrics

Phase 1 reliability dimensions:

```text
evidenceGrounding
criterionCoverage
outputValidity
verificationStatus
```

Future:

```text
rubricAlignment
scoreConsistency
```

---

# 32. FR-24 — Research Experiment

## Independent Variable

```text
Evaluation Architecture
```

Levels:

```text
Baseline
Harness
```

## Controlled Variables

- model;
- temperature;
- question;
- rubric;
- student answer;
- schema;
- dataset.

## Dependent Variables

```text
human agreement
consistency
grounding
format compliance
justification quality
latency
cost
```

---

# 33. Research Hypotheses

## H1

Harness evaluation memiliki human agreement lebih tinggi dibanding baseline.

## H2

Harness evaluation memiliki repeated-run variance lebih rendah.

## H3

Harness evaluation memiliki evidence grounding rate lebih tinggi.

## H4

Harness evaluation memiliki rubric/criterion alignment lebih baik.

## H5

Harness evaluation memiliki output schema compliance lebih tinggi.

## H6

Harness evaluation menghasilkan audit trace yang lebih lengkap.

---

# 34. Research Experiment Matrix

| Dimension | Baseline | Harness |
|---|---|---|
| LLM | Same | Same |
| Model | Same | Same |
| Temperature | Same | Same |
| Question | Same | Same |
| Rubric | Same | Same |
| Answer | Same | Same |
| Prompt | Single | Modular |
| Evidence | No explicit layer | Explicit |
| Verification | No | Yes |
| Final scoring | LLM/legacy | Deterministic |
| Trace | Basic | Full |

---

# 35. Statistical Analysis

Minimal:

```text
Mean
Median
Std Dev
MAE
RMSE
Pearson
Spearman
```

Untuk comparison:

```text
paired statistical test
effect size
confidence interval
```

Pemilihan statistical test harus disesuaikan dengan distribusi data.

Jangan mengklaim improvement hanya berdasarkan mean difference.

---

# 36. Testing Requirements

## Unit Tests

Required:

```text
evidence-grounding.test.js
criterion-mapping.test.js
verification.test.js
verification-gate.test.js
scoring.test.js
trace.test.js
hashing.test.js
```

## Integration Tests

Required:

```text
baseline-evaluation.test.js
harness-evaluation.test.js
verification-flow.test.js
retry-flow.test.js
publication-gate.test.js
```

## Research Tests

Required:

```text
consistency.test.js
grounding-quality.test.js
benchmark-runner.test.js
metrics.test.js
```

---

# 37. Mandatory Test Cases

## TC-01 — Exact Student Evidence

Expected:

```text
grounded = true
```

## TC-02 — Ideal Answer Only

Evidence hanya muncul di ideal answer.

Expected:

```text
grounded = false
```

## TC-03 — Student + Ideal Answer

Evidence hanya muncul di ideal answer.

Expected:

```text
grounded = false
```

## TC-04 — Empty Evidence

Expected:

```text
status = MISSING
```

## TC-05 — Unsupported Evidence

Expected:

```text
status = UNSUPPORTED
```

## TC-06 — Missing Criterion

Expected:

```text
verification = FAIL
```

## TC-07 — High Score / Weak Evidence

Expected:

```text
verification = REVIEW
```

## TC-08 — Invalid Score

Expected:

```text
verification = FAIL
```

## TC-09 — Verification PASS

Expected:

```text
published = true
```

## TC-10 — Verification FAIL

Expected:

```text
published = false
```

## TC-11 — Verification REVIEW

Expected:

```text
published = false
requiresHumanReview = true
```

## TC-12 — Retry Limit

Expected:

```text
no infinite evaluation loop
```

---

# 38. Backward Compatibility

Existing API contracts harus dipertahankan sejauh memungkinkan.

Existing clients yang tidak memahami:

```text
verification.status
reliability
traceId
```

tidak boleh crash.

Additional fields harus additive.

---

# 39. Feature Flags

Gunakan existing feature flag mechanism.

Target:

```text
HARNESS_EVALUATION
HARNESS_EVIDENCE
HARNESS_VERIFICATION
HARNESS_GATE
HARNESS_TRACE
```

Feature flags harus dapat digunakan untuk rollback.

---

# 40. Observability

Metrics minimum:

```text
evaluation_count
verification_pass_count
verification_review_count
verification_fail_count
evidence_grounding_rate
unsupported_evidence_rate
retry_rate
evaluation_latency
llm_latency
token_usage
estimated_cost
```

Research-specific:

```text
experimentId
sampleId
runId
evaluationMode
model
harnessVersion
```

---

# 41. Security

Semua existing security controls harus tetap berlaku:

- tenant isolation;
- RBAC;
- authentication;
- authorization;
- session security;
- CSRF protection;
- secure headers.

Research trace tidak boleh membocorkan student data lintas tenant.

---

# 42. Privacy

Student answer termasuk educational data dan harus diperlakukan sebagai protected application data.

Research dataset harus:

- menggunakan pseudonymous IDs;
- menghindari unnecessary PII;
- memisahkan identity dari response data;
- memiliki access control.

---

# 43. Implementation Roadmap

# Phase 0 — Baseline Freeze

### Tasks

- Jalankan seluruh existing test.
- Catat baseline behavior.
- Simpan sample evaluation.
- Tag baseline version.

### Deliverable

```text
LisanAI Harness Baseline
```

---

# Phase 1 — PR-01 Evidence Integrity

### Scope

```text
server/harness/plugins/evidence.js
tests/
```

### Tasks

1. Remove ideal answer dari grounding corpus.
2. Ground hanya terhadap student answer.
3. Add contamination tests.
4. Preserve existing interface.

### Deliverable

```text
Evidence Integrity v1
```

---

# Phase 2 — PR-02 Evidence Provenance

### Tasks

1. Evidence schema v2.
2. `answerIndex`.
3. `groundingMethod`.
4. Optional span location.
5. Evidence status.

### Deliverable

```text
Evidence Provenance v1
```

---

# Phase 3 — PR-03 Criterion-Evidence Mapping

### Tasks

1. Add criterion ID.
2. Map evidence → criterion.
3. Missing evidence handling.
4. Criterion coverage tests.

### Deliverable

```text
Criterion Evidence Mapping v1
```

---

# Phase 4 — PR-04 Verification Gate

### Tasks

1. PASS/REVIEW/FAIL.
2. Publication gate.
3. Retry mechanism.
4. Failure diagnostics.

### Deliverable

```text
Verification Gate v1
```

---

# Phase 5 — PR-05 Reproducibility

### Tasks

1. Input hash.
2. Rubric hash.
3. Prompt hash.
4. Configuration hash.
5. Model metadata.
6. Trace enrichment.

### Deliverable

```text
Reproducible Evaluation Trace v1
```

---

# Phase 6 — PR-06 Benchmark

### Tasks

1. Dataset schema.
2. Dataset loader.
3. Human score format.
4. Benchmark versioning.
5. Data validation.

### Deliverable

```text
LisanAI Benchmark v1
```

---

# Phase 7 — PR-07 Baseline Runner

### Tasks

1. Load benchmark.
2. Execute baseline.
3. Save output.
4. Preserve metadata.

### Deliverable

```text
Baseline Runner v1
```

---

# Phase 8 — PR-08 Harness Runner

### Tasks

1. Load identical benchmark.
2. Execute harness.
3. Save trace.
4. Save output.

### Deliverable

```text
Harness Runner v1
```

---

# Phase 9 — PR-09 Metrics

### Tasks

Implement:

```text
MAE
RMSE
Pearson
Spearman
Exact Agreement
±5 Agreement
±10 Agreement
Variance
Grounding Rate
Schema Compliance
```

### Deliverable

```text
Evaluation Metrics v1
```

---

# Phase 10 — PR-10 Experiment

Run:

```text
Baseline
vs
Harness
```

on benchmark.

### Deliverable

```text
Experiment Results v1
```

---

# 44. PR Dependency Graph

```text
PR-01 Evidence Integrity
          │
          ▼
PR-02 Provenance
          │
          ▼
PR-03 Criterion Mapping
          │
          ▼
PR-04 Verification Gate
          │
          ├──────────────┐
          ▼              ▼
PR-05 Trace        PR-06 Benchmark
          │              │
          │        ┌─────┴─────┐
          │        ▼           ▼
          │     PR-07       PR-08
          │   Baseline     Harness
          │        │           │
          │        └─────┬─────┘
          │              ▼
          └────────── PR-09 Metrics
                         │
                         ▼
                     PR-10
                   Experiment
```

---

# 45. Definition of Done

Feature dianggap selesai apabila:

1. Code implementation selesai.
2. Unit tests pass.
3. Integration tests pass.
4. Existing regression tests pass.
5. Output schema terdokumentasi.
6. Failure cases memiliki tests.
7. Feature dapat di-disable.
8. Audit trace tersedia.
9. Tidak ada tenant isolation regression.
10. Tidak ada perubahan API breaking tanpa migration plan.

Research feature membutuhkan tambahan:

11. Dataset version recorded.
12. Model version recorded.
13. Prompt version recorded.
14. Harness version recorded.
15. Experiment reproducible.

---

# 46. Success Criteria

## Technical

Target awal:

```text
≥95% structured output validity
100% deterministic final scoring
100% final result melewati verification
0 known ideal-answer evidence contamination
100% evaluation memiliki trace
```

## Research

Target **tidak boleh ditentukan sebagai angka improvement sebelum baseline experiment**.

Yang harus dibuktikan:

```text
Harness ≥ Baseline
```

pada satu atau lebih:

- human agreement;
- consistency;
- grounding;
- rubric alignment;
- format compliance.

Jika tidak terjadi improvement, hasil tersebut tetap dianggap valid secara ilmiah.

---

# 47. Research Deliverables

Setelah Phase 10, harus tersedia:

```text
research/
├── dataset/
│   ├── benchmark-v1.jsonl
│   └── README.md
│
├── baseline/
│   └── results.jsonl
│
├── harness/
│   └── results.jsonl
│
├── metrics/
│   └── results.json
│
└── report/
    └── experiment-report.md
```

---

# 48. Potential Paper Contribution

Jika eksperimen menghasilkan improvement yang signifikan, framework dapat diposisikan sebagai:

> **Evidence-Grounded Harness Engineering for Trustworthy LLM-Based Automated Assessment**

Potential contributions:

1. Modular LLM assessment harness.
2. Evidence-grounded criterion evaluation.
3. Verification-gated scoring.
4. Deterministic rubric aggregation.
5. Reproducible assessment traces.
6. Empirical comparison against single-prompt LLM assessment.

---

# 49. Future Work — Explicitly Deferred

Fitur berikut tidak boleh dimasukkan ke scope v1.1 kecuali dibutuhkan untuk memperbaiki blocker:

```text
Semantic Evidence Grounding
Calibration Harness
Multi-Model Consensus
Confidence Calibration
Agentic Evaluation
Adaptive Rubric
Safety Harness
Human-in-the-loop Dashboard
```

Urutannya:

```text
Evidence Integrity
        ↓
Verification
        ↓
Benchmark
        ↓
Experiment
        ↓
Evidence of Improvement
        ↓
Only then:
Calibration / Semantic Grounding / Multi-model
```

---

# 50. Final Architecture Principle

LisanAI harus berpegang pada empat lapisan:

```text
┌─────────────────────────────────┐
│             MODEL               │
│     Proposes interpretation     │
└───────────────┬─────────────────┘
                ↓
┌─────────────────────────────────┐
│            HARNESS              │
│     Grounds & structures it     │
└───────────────┬─────────────────┘
                ↓
┌─────────────────────────────────┐
│        VERIFICATION GATE        │
│      Decides if valid enough    │
└───────────────┬─────────────────┘
                ↓
┌─────────────────────────────────┐
│        SCORING ENGINE           │
│      Computes final score       │
└───────────────┬─────────────────┘
                ↓
┌─────────────────────────────────┐
│          AUDIT TRACE            │
│      Explains the decision      │
└─────────────────────────────────┘
```

## Core Principle

> **The model proposes.  
> The harness grounds.  
> Verification controls.  
> The scoring engine decides.  
> The trace explains.**

---

# 51. Immediate Development Instruction

Jangan mengimplementasikan seluruh PRD sekaligus.

Urutan pertama:

```text
1. Freeze current master
2. PR-01 Evidence Integrity
3. Run tests
4. PR-02 Provenance
5. Run tests
6. PR-03 Criterion Mapping
7. Run tests
8. PR-04 Verification Gate
9. Run tests
10. Build benchmark
11. Baseline vs Harness
```

Setiap PR harus:

- kecil;
- isolated;
- testable;
- reversible;
- tidak mengubah behavior yang tidak terkait.

**Do not rewrite the harness. Extend the existing architecture.**

---

# 52. Definition of Research Success

Proyek tidak dianggap berhasil hanya karena:

```text
Harness works.
```

Target sebenarnya adalah membuktikan:

```text
Harness works
        +
Harness is auditable
        +
Harness is reproducible
        +
Harness is evidence-grounded
        +
Harness improves measurable assessment quality
```

Dengan demikian LisanAI dapat bergerak dari:

```text
AI Assessment Application
```

menjadi:

```text
Trustworthy AI Assessment Research Platform
```

yang dapat digunakan sekaligus sebagai **produk, experimental testbed, dan foundation untuk publikasi ilmiah**.