# Product Requirements Document (PRD)

## LisanAI — Trustworthy AI Assessment Engine & Harness Engineering v2

**Version:** 1.0  
**Date:** 22 August 2026  
**Status:** Proposed  
**Repository:** `Hi-Day/LisanAI`  
**Primary Objective:** Mengembangkan LisanAI dari AI assessment application menjadi evidence-grounded, auditable, dan research-ready AI assessment engine.

---

# 1. Executive Summary

LisanAI adalah platform asesmen kompetensi lisan dan tertulis berbasis AI. Arsitektur saat ini telah memiliki komponen penting seperti multi-tenancy, RBAC, assessment generation, LLM evaluation, harness pipeline, evidence extraction, verification, deterministic scoring, telemetry, serta automated tests.

Tahap pengembangan berikutnya bukan rewrite aplikasi, melainkan memperkuat **assessment intelligence layer**.

Masalah utama yang hendak diselesaikan adalah memastikan bahwa nilai yang dihasilkan AI:

1. didasarkan pada jawaban aktual mahasiswa;
2. dapat ditelusuri ke evidence tertentu;
3. dipetakan secara eksplisit ke rubric criterion;
4. dihitung secara deterministic;
5. diverifikasi sebelum diterbitkan;
6. memiliki reliability information;
7. dapat dibandingkan secara empiris dengan human assessment.

Target akhirnya adalah:

> **LisanAI sebagai Trustworthy AI Assessment Engine: LLM digunakan sebagai reasoning component, sementara evidence, rubric, scoring, verification, dan auditability dikendalikan oleh assessment architecture.**

---

# 2. Product Vision

## Current State

```text
Student Answer
      ↓
      LLM
      ↓
   Evaluation
      ↓
     Score
```

## Target State

```text
Student Answer
      ↓
Assessment Context
      ↓
Rubric
      ↓
Evidence Extraction
      ↓
Criterion Mapping
      ↓
LLM Judgment
      ↓
Verification
      ↓
Deterministic Scoring
      ↓
Reliability Assessment
      ↓
Final Result
      ↓
Audit Trace
```

Prinsip utama:

> **LLM tidak menjadi sumber kebenaran tunggal.**

LLM menghasilkan interpretasi dan reasoning; sistem assessment menentukan bagaimana reasoning tersebut divalidasi dan diterjemahkan menjadi keputusan.

---

# 3. Problem Statement

LLM-based assessment menghadapi beberapa masalah fundamental:

### 3.1 Score reliability

LLM dapat memberikan skor berbeda untuk jawaban yang sama ketika evaluation diulang.

### 3.2 Evidence grounding

LLM dapat menghasilkan rationale yang terdengar benar tetapi tidak benar-benar didukung oleh jawaban mahasiswa.

### 3.3 Rubric alignment

LLM dapat memberikan penilaian umum tanpa menunjukkan hubungan eksplisit antara evidence dan criterion.

### 3.4 Score justification

Nilai numerik dapat tidak proporsional terhadap evidence yang tersedia.

### 3.5 Auditability

Sulit mengetahui:

- input apa yang digunakan;
- rubric versi berapa;
- model apa yang digunakan;
- evidence apa yang menjadi dasar keputusan;
- bagaimana score dihitung;
- mengapa evaluation dinyatakan valid.

### 3.6 Research reproducibility

Sistem belum memiliki evaluation benchmark yang memungkinkan perbandingan formal:

```text
Single-Prompt Baseline
vs
Harness-Based Evaluation
```

terhadap human ground truth.

---

# 4. Objectives

## Primary Objectives

1. Memperkuat evidence grounding.
2. Membuat criterion-evidence mapping eksplisit.
3. Menambahkan verification gate.
4. Memastikan score-evidence consistency.
5. Memisahkan model confidence dari system reliability.
6. Membangun research evaluation dataset.
7. Membandingkan baseline LLM dengan Harness Evaluation.
8. Menyediakan audit trace yang reproducible.

## Secondary Objectives

1. Mempertahankan architecture yang sudah ada.
2. Menghindari rewrite besar.
3. Menjaga backward compatibility.
4. Menjadikan setiap improvement dapat diuji secara terisolasi.
5. Mempersiapkan platform untuk publikasi ilmiah.

---

# 5. Non-Goals

Tahap ini **tidak** bertujuan untuk:

- membangun billing system;
- membangun marketplace;
- mengganti database;
- mengganti frontend framework;
- menambahkan banyak fitur administratif;
- membangun multi-model orchestration kompleks;
- membangun calibration model machine learning;
- mengoptimalkan UI secara besar-besaran;
- mengganti OpenRouter;
- melakukan rewrite total terhadap harness.

Fokus utama adalah:

> **Assessment correctness, reliability, evidence grounding, verification, dan research evaluation.**

---

# 6. Target Users

## 6.1 Student

Mengerjakan assessment dan menerima:

- score;
- feedback;
- evidence-based explanation;
- criterion-level feedback.

## 6.2 Teacher / Assessor

Membuat assessment dan:

- mendefinisikan rubric;
- melihat hasil;
- memahami alasan AI memberikan score;
- melakukan review terhadap hasil yang memiliki reliability rendah.

## 6.3 Administrator

Mengelola:

- tenant;
- users;
- classes;
- assessments;
- system configuration.

## 6.4 Researcher

Menganalisis:

- human-AI agreement;
- consistency;
- evidence grounding;
- rubric compliance;
- output validity;
- auditability.

---

# 7. Core Design Principles

## Principle 1 — Evidence First

Tidak boleh ada criterion judgment tanpa evidence yang dapat ditelusuri.

## Principle 2 — Student Answer Is the Ground Truth Corpus

Evidence grounding hanya boleh memanfaatkan jawaban mahasiswa sebagai sumber evidence.

Ideal answer/reference answer tidak boleh digunakan sebagai sumber evidence mahasiswa.

## Principle 3 — Deterministic Score

Final score dihitung oleh application layer.

```text
Final Score =
Σ Criterion Score × Criterion Weight
```

LLM tidak menentukan weighted final score secara langsung.

## Principle 4 — Verification Before Publication

Hasil evaluation harus melewati verification gate sebelum dianggap valid.

## Principle 5 — Explainability Through Provenance

Setiap criterion score harus dapat ditelusuri:

```text
Score
 ↓
Criterion
 ↓
Judgment
 ↓
Evidence
 ↓
Student Answer
```

## Principle 6 — Research Reproducibility

Evaluation harus dapat direplikasi berdasarkan:

```text
model
model_version
prompt_version
rubric_version
harness_version
engine_version
temperature
input
timestamp
```

---

# 8. Target Architecture

```text
                       LisanAI
                          │
                ┌─────────┴─────────┐
                │ Assessment Engine │
                └─────────┬─────────┘
                          │
             ┌────────────┴────────────┐
             │                         │
        Assessment                 Student
         Context                   Answers
             │                         │
             └────────────┬────────────┘
                          ↓
                    Rubric Harness
                          ↓
                   Evidence Harness
                          ↓
                 Criterion Mapping
                          ↓
                 Evaluation Harness
                          ↓
                  Verification Layer
                          ↓
                    Verification Gate
                     /           \
                   PASS          REVIEW
                    │              │
                    ↓              ↓
              Deterministic    Re-evaluation
                 Scoring
                    │
                    ↓
              Reliability Engine
                    │
                    ↓
               Final Result
                    │
             ┌──────┴──────┐
             ↓             ↓
          Feedback      Audit Trace
```

---

# 9. Harness Architecture

Target conceptual architecture:

```text
server/harness/

├── core/
│   ├── harness.js
│   ├── pipeline.js
│   ├── registry.js
│   └── trace.js
│
├── plugins/
│   ├── persona.js
│   ├── assessmentContext.js
│   ├── rubric.js
│   ├── evidence.js
│   ├── evaluation.js
│   └── verification.js
│
├── scoring/
│   ├── scoring-engine.js
│   └── reliability.js
│
├── verification/
│   ├── evidence-grounding.js
│   ├── criterion-coverage.js
│   ├── score-consistency.js
│   └── gate.js
│
└── config.js
```

File movement/refactoring bersifat opsional.

**Functional behavior lebih penting daripada struktur folder.**

---

# 10. Feature Requirements

# FR-01 — Evidence Contamination Fix

### Problem

Evidence extraction saat ini berpotensi menggunakan ideal answer/reference answer sebagai bagian dari grounding corpus.

### Requirement

Evidence grounding harus menggunakan:

```text
Student Answer ONLY
```

Ideal answer boleh digunakan untuk:

- evaluation context;
- comparison;
- criterion interpretation;

tetapi tidak boleh digunakan untuk membuktikan bahwa mahasiswa menyatakan sesuatu.

### Acceptance Criteria

- Evidence dari ideal answer tidak pernah menghasilkan `grounded=true`.
- Test khusus tersedia.
- Existing evaluation behavior tetap berjalan.
- Student answer menjadi satu-satunya source of truth untuk evidence grounding.

### Priority

**P0**

---

# FR-02 — Evidence Object v2

Evidence harus memiliki provenance yang lebih lengkap.

### Target schema

```json
{
  "criterionId": "C1",
  "text": "student evidence",
  "answerIndex": 0,
  "start": 42,
  "end": 87,
  "grounded": true,
  "groundingMethod": "lexical",
  "confidence": 0.91
}
```

### Required Fields

- `criterionId`
- `text`
- `answerIndex`
- `grounded`
- `groundingMethod`

### Optional

- `start`
- `end`
- `confidence`

### Grounding methods

Initial:

```text
lexical
```

Future:

```text
semantic
hybrid
```

---

# 11. FR-03 — Criterion-Evidence Mapping

Setiap criterion harus memiliki evidence sendiri.

Target:

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

Bukan:

```text
global evidence
    ↓
global score
```

melainkan:

```text
Criterion C1
 ├── Evidence
 ├── Judgment
 └── Score

Criterion C2
 ├── Evidence
 ├── Judgment
 └── Score
```

### Acceptance Criteria

- Semua scored criteria memiliki evidence atau explicit `no_evidence`.
- Evidence dapat ditelusuri ke criterion.
- Criterion tanpa evidence tidak boleh diam-diam memperoleh score tinggi.

### Priority

**P0**

---

# 12. FR-04 — Criterion Judgment

LLM tidak langsung menghasilkan final assessment score.

LLM menghasilkan criterion-level judgment.

Target:

```json
{
  "criterionId": "C1",
  "score": 82,
  "evidence": [],
  "rationale": "...",
  "confidence": 0.84
}
```

Score criterion masih berasal dari LLM pada tahap awal.

Final weighted score tetap deterministic.

---

# 13. FR-05 — Deterministic Scoring Engine

Formula:

```text
Final Score =
Σ(score_i × weight_i)
```

Requirements:

- rubric weights harus valid;
- total weight = 1.0;
- score range harus valid;
- rounding policy deterministic;
- score calculation tidak menggunakan LLM.

### Example

```text
Concept Accuracy      80 × 0.40 = 32
Reasoning             75 × 0.30 = 22.5
Relevance             90 × 0.20 = 18
Communication         85 × 0.10 = 8.5
------------------------------------
Final Score                  81
```

### Priority

**P0**

---

# 14. FR-06 — Evidence-Score Consistency

Sistem harus mendeteksi ketidaksesuaian antara:

```text
Evidence
Criterion Coverage
Criterion Score
```

Contoh:

```text
Evidence Coverage = 35%
Criterion Score = 95
```

harus menghasilkan warning atau review.

### Initial heuristic

Sistem dapat menggunakan rule-based validation:

```text
if evidenceCoverage < threshold
and score > highScoreThreshold
→ REVIEW
```

Threshold harus configurable.

### Future

Dapat digantikan dengan learned calibration model.

### Priority

**P1**

---

# 15. FR-07 — Verification Layer

Verification harus memeriksa minimal:

### A. Schema validity

Apakah output sesuai schema?

### B. Evidence validity

Apakah evidence berasal dari student answer?

### C. Criterion coverage

Apakah semua criterion memiliki judgment?

### D. Score validity

Apakah score berada dalam range?

### E. Evidence-score consistency

Apakah score masuk akal terhadap evidence?

### F. Rubric alignment

Apakah judgment benar-benar mengevaluasi criterion?

---

# 16. FR-08 — Verification Gate

Verification tidak hanya menghasilkan diagnostics.

Ia harus menghasilkan:

```text
PASS
REVIEW
FAIL
```

### PASS

Assessment dapat diterbitkan.

### REVIEW

Assessment harus ditandai sebagai low-confidence / membutuhkan review.

### FAIL

Evaluation tidak boleh diterbitkan sebagai final result.

Target flow:

```text
Evaluation
    ↓
Verification
    ↓
 ┌───────────────┐
 │ Verification  │
 └───────┬───────┘
         │
   ┌─────┼─────┐
   ↓     ↓     ↓
 PASS  REVIEW FAIL
   │     │     │
   ↓     ↓     ↓
 Score  Human  Retry
        Review
```

### Priority

**P0**

---

# 17. FR-09 — Re-evaluation Loop

Untuk `FAIL` atau critical verification error:

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

Maximum retry harus configurable.

Contoh:

```text
MAX_EVALUATION_RETRIES=1
```

Tidak boleh terjadi infinite loop.

---

# 18. FR-10 — Reliability Vector

Sistem tidak menggunakan satu confidence score sebagai satu-satunya reliability indicator.

Target:

```json
{
  "evidenceGrounding": 0.95,
  "criterionCoverage": 1.0,
  "rubricAlignment": 0.88,
  "scoreConsistency": 0.82,
  "outputValidity": 1.0
}
```

Kemudian menghasilkan:

```text
overallReliability
```

### Important distinction

```text
modelConfidence
```

berbeda dari:

```text
systemReliability
```

---

# 19. FR-11 — Audit Trace

Setiap evaluation harus menyimpan trace minimal:

```json
{
  "evaluationId": "...",
  "model": "...",
  "modelVersion": "...",
  "promptVersion": "...",
  "rubricVersion": "...",
  "harnessVersion": "...",
  "engineVersion": "...",
  "temperature": 0,
  "criteria": [],
  "evidence": [],
  "verification": {},
  "scoring": {},
  "reliability": {},
  "latency": {},
  "tokenUsage": {}
}
```

Tujuannya adalah:

> **setiap final score harus dapat direkonstruksi secara audit.**

---

# 20. FR-12 — Baseline Evaluation Mode

Sistem harus mempertahankan dua evaluation modes.

## Mode A — Baseline

```text
Question
 ↓
Student Answer
 ↓
Single-Prompt LLM
 ↓
Score
```

## Mode B — Harness

```text
Question
 ↓
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

Kedua mode harus menerima input identik.

---

# 21. FR-13 — Research Dataset

Dataset minimal:

```text
100–300 student responses
```

Setiap sample:

```json
{
  "questionId": "...",
  "question": "...",
  "rubric": {},
  "studentAnswer": "...",
  "humanScore": 82
}
```

Idealnya juga:

```json
{
  "humanCriterionScores": {},
  "humanFeedback": "...",
  "annotatorId": "..."
}
```

Jika memungkinkan, gunakan dua human raters untuk subset dataset.

---

# 22. FR-14 — Evaluation Metrics

## Agreement

- Pearson correlation
- Spearman correlation
- MAE
- RMSE

## Agreement bands

```text
Exact Agreement
±5 points
±10 points
```

## Consistency

Repeated evaluation terhadap input yang sama:

```text
mean
std
variance
range
```

## Reliability

- evidence grounding rate;
- criterion coverage;
- verification pass rate;
- score-evidence consistency.

## Output

- JSON validity;
- schema compliance;
- missing field rate.

## Justification

- evidence-supported rationale;
- criterion relevance;
- unsupported claim rate.

---

# 23. Research Experiment Design

## Independent Variable

Evaluation architecture:

```text
Baseline
vs
Harness
```

## Controlled Variables

- LLM model;
- temperature;
- question;
- rubric;
- student answer;
- output schema;
- evaluation dataset.

## Dependent Variables

```text
Human agreement
Consistency
Evidence grounding
Format compliance
Justification quality
Reliability
Latency
Token cost
```

---

# 24. Experimental Pipeline

```text
                     Dataset
                        │
              ┌─────────┴─────────┐
              │                   │
              ▼                   ▼
          Baseline             Harness
              │                   │
              ▼                   ▼
             LLM             Evidence
              │                   │
              │              Criterion
              │               Judgment
              │                   │
              │              Verification
              │                   │
              │          Deterministic Score
              │                   │
              └─────────┬─────────┘
                        ↓
                  Human Ground Truth
                        ↓
                     Metrics
                        ↓
                   Statistical
                    Analysis
```

---

# 25. Research Hypotheses

## H1 — Human Agreement

Harness-based evaluation menghasilkan agreement dengan human score yang lebih tinggi daripada baseline.

## H2 — Consistency

Harness menghasilkan variance score yang lebih rendah pada repeated evaluation.

## H3 — Evidence Grounding

Harness menghasilkan lebih banyak justifikasi yang benar-benar didukung oleh student answer.

## H4 — Rubric Alignment

Harness memiliki criterion-level alignment yang lebih tinggi terhadap rubric.

## H5 — Output Compliance

Harness menghasilkan structured output yang lebih konsisten.

## H6 — Auditability

Harness menghasilkan provenance dan evaluation trace yang lebih lengkap.

---

# 26. API Requirements

Evaluation endpoint harus mendukung:

```text
POST /api/assessment/evaluate
```

dengan parameter:

```json
{
  "mode": "baseline"
}
```

atau:

```json
{
  "mode": "harness"
}
```

Mode tidak boleh mengubah dataset input.

Response harus membedakan:

```json
{
  "score": 81,
  "evaluationMode": "harness",
  "verification": {
    "status": "PASS"
  },
  "reliability": {},
  "traceId": "..."
}
```

---

# 27. Feature Flags

Existing feature flag architecture dipertahankan.

Target:

```text
HARNESS_EVALUATION
HARNESS_EVIDENCE
HARNESS_VERIFICATION
HARNESS_SCORING
HARNESS_RELIABILITY
```

Feature flags harus memungkinkan rollback tanpa redeploy architecture besar.

---

# 28. Observability

Metrics yang perlu dicatat:

```text
evaluation_count
evaluation_latency
llm_latency
token_usage
estimated_cost
verification_pass_rate
verification_review_rate
verification_fail_rate
evidence_grounding_rate
average_reliability
baseline_score
harness_score
```

Untuk research:

```text
experiment_id
sample_id
run_id
model
temperature
prompt_version
harness_version
```

---

# 29. Security Requirements

Tidak boleh ada perubahan yang menurunkan existing security.

Tetap mempertahankan:

- tenant isolation;
- RBAC;
- session security;
- CSRF protection;
- secure headers;
- password hashing;
- authorization checks.

Research traces tidak boleh mengekspos data student ke tenant lain.

---

# 30. Testing Strategy

## Unit Tests

```text
scoring-engine.test.js
evidence-grounding.test.js
criterion-mapping.test.js
verification.test.js
reliability.test.js
gate.test.js
```

## Integration Tests

```text
baseline-evaluation.test.js
harness-evaluation.test.js
verification-flow.test.js
retry-flow.test.js
```

## Regression Tests

Existing tests harus tetap pass.

## Research Tests

```text
consistency.test.js
agreement.test.js
format-compliance.test.js
evidence-quality.test.js
```

---

# 31. Test Cases Prioritas

### TC-01 — Ideal answer contamination

Input:

```text
Student answer ≠ ideal answer
```

Expected:

```text
ideal-answer evidence = grounded false
```

### TC-02 — Exact evidence

Expected:

```text
grounded = true
```

### TC-03 — Paraphrased evidence

Initial implementation boleh menghasilkan:

```text
groundingMethod = lexical
```

Future implementation:

```text
groundingMethod = semantic
```

### TC-04 — Missing criterion

Expected:

```text
verification = REVIEW/FAIL
```

### TC-05 — High score with weak evidence

Expected:

```text
verification = REVIEW
```

### TC-06 — Invalid rubric weight

Expected:

```text
evaluation rejected
```

### TC-07 — Verification failure

Expected:

```text
re-evaluation
```

### TC-08 — Retry limit

Expected:

```text
no infinite loop
```

---

# 32. Implementation Roadmap

## Phase 0 — Baseline Stabilization

**Goal:** memastikan kondisi repository saat ini dapat direproduksi.

Tasks:

- run all existing tests;
- document current evaluation behavior;
- freeze baseline version;
- capture current metrics.

Deliverable:

```text
Baseline Evaluation v1
```

---

# Phase 1 — Evidence Integrity

**Priority: P0**

Tasks:

1. Remove ideal-answer contamination.
2. Implement Evidence Object v2.
3. Add answer provenance.
4. Add evidence tests.
5. Add regression tests.

Deliverable:

```text
Evidence Harness v1.1
```

---

# Phase 2 — Criterion Grounding

**Priority: P0**

Tasks:

1. Criterion IDs.
2. Criterion-evidence mapping.
3. Criterion-level judgment.
4. Missing evidence detection.
5. Criterion coverage metric.

Deliverable:

```text
Evidence → Criterion Mapping
```

---

# Phase 3 — Verification Gate

**Priority: P0**

Tasks:

1. Verification engine.
2. PASS / REVIEW / FAIL.
3. Retry mechanism.
4. Verification trace.
5. Failure reasons.

Deliverable:

```text
Verification Gate v1
```

---

# Phase 4 — Score Consistency

**Priority: P1**

Tasks:

1. Evidence coverage.
2. Score-evidence consistency.
3. Rubric alignment checks.
4. Score anomaly detection.

Deliverable:

```text
Assessment Reliability Layer
```

---

# Phase 5 — Reliability Vector

**Priority: P1**

Tasks:

1. Reliability dimensions.
2. Overall reliability calculation.
3. Student/teacher-facing interpretation.
4. Research telemetry.

Deliverable:

```text
Reliability Engine v1
```

---

# Phase 6 — Research Dataset

**Priority: P1**

Tasks:

1. Prepare 100–300 samples.
2. Human scoring.
3. Rubric normalization.
4. Dataset versioning.
5. Train/test split if needed.

Deliverable:

```text
LisanAI Assessment Benchmark v1
```

---

# Phase 7 — Baseline vs Harness Experiment

**Priority: P1**

Run:

```text
Baseline
vs
Harness
```

Metrics:

```text
MAE
RMSE
Pearson
Spearman
Consistency
Grounding
Compliance
Justification Quality
Latency
Cost
```

Deliverable:

```text
Experimental Results
```

---

# Phase 8 — Calibration

**Priority: P2**

Only dilakukan setelah benchmark menghasilkan sufficient evidence.

Potential approaches:

```text
bias correction
score calibration
criterion calibration
confidence calibration
```

Calibration tidak boleh dimasukkan ke MVP sebelum baseline evidence tersedia.

---

# 33. PR Breakdown

Development harus dilakukan sebagai small PRs.

## PR-01

**Fix Evidence Contamination**

Scope:

```text
server/harness/plugins/evidence.js
tests/
```

---

## PR-02

**Evidence Provenance**

Scope:

```text
Evidence schema
answerIndex
location
groundingMethod
```

---

## PR-03

**Criterion-Evidence Mapping**

Scope:

```text
criterionId
evidence[]
```

---

## PR-04

**Verification Gate**

Scope:

```text
PASS
REVIEW
FAIL
```

---

## PR-05

**Score-Evidence Consistency**

Scope:

```text
coverage
alignment
score anomaly
```

---

## PR-06

**Reliability Vector**

Scope:

```text
evidenceGrounding
criterionCoverage
rubricAlignment
scoreConsistency
outputValidity
```

---

## PR-07

**Research Dataset Infrastructure**

Scope:

```text
dataset schema
dataset loader
evaluation runner
```

---

## PR-08

**Baseline Evaluation Runner**

Scope:

```text
baseline runner
```

---

## PR-09

**Harness Evaluation Runner**

Scope:

```text
harness runner
```

---

## PR-10

**Experiment Metrics**

Scope:

```text
agreement
consistency
grounding
compliance
```

---

# 34. Definition of Done

Feature dianggap selesai jika:

- implementation selesai;
- unit tests tersedia;
- integration tests tersedia bila relevan;
- regression tests pass;
- output schema terdokumentasi;
- feature dapat dimatikan melalui configuration/feature flag;
- tidak merusak baseline behavior;
- audit trace tersedia;
- failure mode terdokumentasi.

Untuk research feature, tambahan:

- experiment reproducible;
- dataset version dicatat;
- model version dicatat;
- prompt version dicatat;
- harness version dicatat.

---

# 35. Success Criteria

LisanAI Harness v2 dianggap berhasil jika:

### Technical

- ≥95% evaluation menghasilkan valid structured output;
- evidence grounding dapat diverifikasi;
- 100% final scores dihitung deterministic;
- verification gate bekerja;
- tidak ada evidence contamination;
- semua evaluation dapat menghasilkan audit trace.

### Research

Target awal:

- measurable improvement terhadap baseline;
- human agreement meningkat;
- repeated-run variance menurun;
- evidence grounding meningkat;
- justification quality meningkat.

Target numerik final harus ditentukan setelah baseline experiment, bukan ditetapkan secara arbitrer sebelumnya.

---

# 36. Product Metrics

## Assessment Quality

```text
Human Agreement
MAE
RMSE
Correlation
```

## Reliability

```text
Verification Pass Rate
Evidence Grounding Rate
Score-Evidence Consistency
```

## Operational

```text
Latency
Token Usage
Cost / Assessment
Failure Rate
Retry Rate
```

## Research

```text
Effect Size
Confidence Interval
Inter-rater Agreement
Baseline vs Harness Improvement
```

---

# 37. Future Architecture — Calibration Harness

Setelah Harness v2 tervalidasi:

```text
Student Answer
      ↓
Evidence
      ↓
Criterion Judgment
      ↓
Verification
      ↓
Calibration
      ↓
Deterministic Score
```

Calibration dapat mempelajari systematic bias:

```text
Human = 70
LLM = 84

Bias = +14
```

Tetapi calibration harus berbasis benchmark, bukan asumsi.

---

# 38. Future Architecture — Multi-Model Evaluation

Tahap lebih lanjut:

```text
Student Answer
      │
 ┌────┼─────┐
 ↓    ↓     ↓
LLM A LLM B LLM C
 │    │     │
 └────┼─────┘
      ↓
Evidence Consensus
      ↓
Verification
      ↓
Score
```

Namun ini **bukan bagian MVP Harness v2**.

---

# 39. Future Architecture — Human-in-the-Loop

Untuk low-reliability cases:

```text
AI Evaluation
      ↓
Reliability
      ↓
 ┌────┴────┐
 │         │
High      Low
 │         │
 ↓         ↓
Auto     Human
Publish  Review
```

Ini akan menjadi fondasi penting untuk deployment pada assessment high-stakes.

---

# 40. Research Positioning

LisanAI tidak diposisikan sekadar sebagai:

> AI-based oral examination application.

Positioning yang lebih kuat:

> **An evidence-grounded and auditable LLM assessment architecture based on modular AI Harness Engineering.**

Kontribusi ilmiah potensial:

1. modular assessment harness architecture;
2. evidence-grounded LLM evaluation;
3. deterministic rubric scoring;
4. verification-gated assessment;
5. reliability vector;
6. empirical comparison against single-prompt baseline.

---

# 41. Proposed Research Paper Structure

## 1. Introduction

Problem:

```text
LLM assessment
↓
high capability
but
↓
low reliability / auditability
```

## 2. Related Work

- LLM-as-a-Judge;
- automated assessment;
- rubric-based grading;
- explainable AI;
- AI safety;
- evaluation harnesses.

## 3. Proposed Framework

```text
Persona
Context
Rubric
Evidence
Evaluation
Verification
Scoring
Reliability
```

## 4. Experimental Method

```text
Baseline
vs
Harness
```

## 5. Results

Human agreement, consistency, grounding, compliance.

## 6. Discussion

Trade-offs:

```text
quality
vs
latency
vs
cost
```

## 7. Limitations

- dataset size;
- model dependence;
- domain dependence;
- human scoring variability.

## 8. Conclusion

Harness engineering improves trustworthiness of LLM-based assessment.

---

# 42. Final Product Architecture

Target end state:

```text
                         ┌─────────────────────┐
                         │      LisanAI        │
                         │ Assessment Platform │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
              Product Layer                  Research Layer
                    │                               │
        ┌───────────┼───────────┐           ┌───────┴────────┐
        │           │           │           │                │
     Student      Teacher     Admin      Benchmark       Experiment
        │           │           │           │                │
        └───────────┴───────────┘           └───────┬────────┘
                                                    │
                         ┌──────────────────────────┘
                         ↓
                 Assessment Engine
                         │
        ┌────────────────┼─────────────────┐
        ↓                ↓                 ↓
     Rubric           Evidence          Evaluation
        │                │                 │
        └────────────────┼─────────────────┘
                         ↓
                    Verification
                         ↓
                  Verification Gate
                         ↓
              Deterministic Scoring
                         ↓
                  Reliability Engine
                         ↓
                   Final Result
                         │
              ┌──────────┴──────────┐
              ↓                     ↓
          Feedback              Audit Trace
```

---

# 43. Ultimate Product Principle

LisanAI harus mengikuti prinsip:

> **"The model proposes; the harness verifies; the scoring engine decides; the trace explains."**

Dalam bentuk operational:

```text
LLM
  ↓
Propose evidence & judgment

Harness
  ↓
Verify evidence & rubric alignment

Scoring Engine
  ↓
Calculate deterministic result

Reliability Engine
  ↓
Assess confidence of the decision

Audit Trace
  ↓
Explain how the decision was produced
```

Dengan architecture ini, LisanAI tidak hanya menjawab:

> **"Berapa nilai mahasiswa?"**

tetapi juga:

> **"Apa dasar nilai tersebut, criterion mana yang terpenuhi, evidence mana yang mendukungnya, bagaimana nilai dihitung, seberapa reliable keputusan tersebut, dan apakah keputusan tersebut layak diterbitkan?"**

Itulah transisi utama dari **AI application → trustworthy AI assessment system**.

# 44. Immediate Next Action

Implementasi dimulai **bukan dari seluruh PRD**, melainkan:

```text
PR-01
Fix Evidence Contamination
        ↓
PR-02
Evidence Provenance
        ↓
PR-03
Criterion-Evidence Mapping
        ↓
PR-04
Verification Gate
```

Setelah empat PR tersebut stabil, baru kita membangun benchmark 100–300 responses dan menjalankan eksperimen:

```text
Single Prompt Baseline
              VS
       LisanAI Harness
```

Hasil eksperimen tersebut kemudian menjadi dasar objektif untuk menentukan apakah Harness Engineering benar-benar meningkatkan kualitas assessment, bukan sekadar menambah kompleksitas software.