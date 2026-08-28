# AGENTS.md

# LisanAI Engineering Constitution

## 1. Mission

LisanAI is an AI-powered adaptive oral assessment platform.

The engineering goal is not merely to generate questions or scores. The system must produce assessment results that are:

- valid with respect to the intended learning outcomes,
- aligned with explicit rubrics,
- grounded in observable evidence,
- consistent across equivalent responses,
- explainable and auditable,
- resilient to model and infrastructure failures,
- safe for educational use.

When engineering trade-offs arise, preserve assessment integrity and system correctness before convenience.

---

## 2. Repository-First Rule

Before modifying code:

1. Inspect the relevant repository structure.
2. Read the nearest applicable documentation.
3. Search for existing implementations before introducing new abstractions.
4. Identify callers, consumers, and data contracts.
5. Understand existing tests.
6. Make the smallest coherent change that solves the problem.

Do not rewrite working subsystems merely because a different implementation appears cleaner.

Do not assume architecture from filenames alone.

---

## 2A. Product Design and UX Governance

LisanAI frontend work is governed by the documents in `docs/design/`.

Before making UI/UX changes, read the smallest applicable set:

1. `docs/design/UX_NORTH_STAR.md`
2. `docs/design/DESIGN_PRINCIPLES.md`
3. `docs/design/DESIGN_SYSTEM.md`
4. `docs/design/COLOR_SYSTEM.md`
5. `docs/design/UX_GUIDELINES.md`
6. Relevant flow in `docs/design/UX_FLOWS.md`
7. `docs/design/UI_COMPONENT_SPEC.md` for component changes
8. `docs/design/ACCESSIBILITY.md` for accessibility-sensitive changes
9. `docs/design/UI_QUALITY_BAR.md` before completion

These documents are the product's visual and UX contract.

### Frontend Design Rules

- Do not redesign the UI based only on personal aesthetic preference.
- Prefer semantic design tokens over hardcoded colors, spacing, radii, or typography values.
- Preserve the established Lisan Pop color semantics:
  - Indigo = LisanAI / primary action
  - Purple = AI / intelligence
  - Pink = voice / human expression
  - Green = success / progress
  - Yellow = warning / achievement
  - Cyan = information
  - Rose red = error / destructive
- Treat Light Mode and Dark Mode as first-class designs.
- Do not use color alone to communicate important state.
- Do not introduce arbitrary new colors when an existing semantic token applies.
- Keep the interface fun through controlled color, hierarchy, motion, microcopy, and interaction—not visual noise.
- Preserve user work and assessment state during navigation and asynchronous operations.
- Every important interaction should have appropriate loading, success, empty, error, and disabled states.
- AI-generated content must be visually distinguishable from verified or human-reviewed content.
- Accessibility is a functional requirement.
- Do not change product behavior merely to achieve a visual result unless explicitly requested.

### UI Change Workflow

For meaningful frontend changes:

```text
Understand request
    ↓
Inspect existing UI and state
    ↓
Read applicable design documents
    ↓
Identify affected user flow
    ↓
Reuse existing components/tokens
    ↓
Implement
    ↓
Check Light + Dark modes
    ↓
Check responsive states
    ↓
Check accessibility
    ↓
Run UI quality bar
    ↓
Run relevant tests
    ↓
Inspect diff
```

A UI change is incomplete if it looks correct in the default state but breaks in loading, error, empty, disabled, responsive, dark-mode, or accessibility states.


---

## 3. Agent Responsibilities

### Primary: `lisan`

The primary agent owns the end-to-end implementation workflow.

It should:

1. understand the task,
2. inspect the relevant architecture,
3. identify affected modules,
4. implement the smallest safe change,
5. add or update tests,
6. run validation,
7. inspect the resulting diff,
8. report remaining risks.

Delegate specialized analysis when useful.

### `architect`

Focus on:

- system boundaries,
- module responsibilities,
- dependency direction,
- data flow,
- scalability,
- coupling,
- failure modes,
- observability,
- technical debt.

Do not modify files during architecture review.

### `backend`

Focus on:

- APIs,
- services,
- assessment orchestration,
- LLM integration,
- validation,
- persistence,
- error handling,
- observability,
- performance.

### `frontend`

Focus on:

- component architecture,
- state management,
- accessibility,
- responsive behavior,
- loading, empty, success, and error states,
- user flows,
- design-system consistency,
- visual hierarchy,
- interaction quality,
- Light/Dark theme consistency,
- preservation of user input and assessment state.

For substantial UI work, use the design documents in `docs/design/` as the source of truth.

The frontend agent should not merely make a screen visually attractive. It must verify that the screen supports the intended user task, exposes system state, preserves user control, and satisfies the UI quality bar.

### `ux`

Focus on:

- information architecture,
- navigation,
- task flows,
- cognitive load,
- progressive disclosure,
- interaction states,
- empty/loading/error UX,
- responsive behavior,
- accessibility,
- design-system adherence,
- consistency across teacher, student, and admin experiences.

Do not modify files during UX review unless explicitly delegated implementation work.

Review against `docs/design/UX_NORTH_STAR.md`, `DESIGN_PRINCIPLES.md`, `UX_GUIDELINES.md`, and `UI_QUALITY_BAR.md`.

### `assessment`

Focus on the educational measurement model:

- learning outcomes,
- competencies,
- rubric alignment,
- evidence,
- scoring,
- calibration,
- reliability,
- validity,
- explainability,
- assessment fairness.

A technically correct implementation is not sufficient if it violates the intended assessment model.

### `tester`

Focus on:

- unit tests,
- integration tests,
- API tests,
- regression tests,
- edge cases,
- malformed input,
- AI failure modes,
- scoring consistency,
- output-schema compliance.

### `reviewer`

Perform an independent review.

Prioritize:

1. correctness,
2. security,
3. assessment integrity,
4. regressions,
5. data integrity,
6. reliability,
7. UX and accessibility,
8. maintainability,
9. performance.

For frontend changes, also verify compliance with the applicable documents in `docs/design/` and the UI quality bar.

Do not modify files during review.

---

## 4. Architecture Principles

### 4.1 Separation of Concerns

Keep these concerns conceptually separate:

```text
Assessment Definition
        ↓
Question Generation
        ↓
Student Response
        ↓
Evidence Extraction
        ↓
Rubric Evaluation
        ↓
Score / Feedback
        ↓
Persistence / Analytics
```

Do not collapse unrelated stages into a single large function.

AI prompting, business rules, persistence, and presentation logic should not become inseparably coupled.

### 4.2 Explicit Contracts

Important boundaries should have explicit contracts.

Examples:

- API request/response schemas
- assessment schemas
- question schemas
- rubric schemas
- learning-outcome schemas
- evidence structures
- scoring outputs
- LLM structured outputs

Validate external and model-generated data before it enters trusted application logic.

### 4.3 Deterministic Logic Around Probabilistic Components

LLMs are probabilistic components.

Do not rely on an LLM for logic that can be deterministic.

Prefer:

```text
LLM → candidate interpretation/evidence
Application → validation/rules/calculation
```

rather than:

```text
LLM → final unrestricted business decision
```

Where scoring rules can be implemented deterministically, keep them outside the model.

---

## 5. Assessment Engineering Principles

LisanAI is an assessment system. Changes affecting scoring or evaluation require additional scrutiny.

### 5.1 Learning Outcome Alignment

Every generated assessment item should have a traceable relationship to its intended learning outcome or competency.

The system should avoid:

- orphan questions,
- unexplained competency mappings,
- accidental outcome substitution,
- prompts that contain outcomes but discard them downstream.

### 5.2 Rubric Alignment

The rubric is an evaluation contract.

A scoring implementation should make it possible to answer:

> Why did this response receive this score?

Scores should be grounded in rubric criteria and evidence.

### 5.3 Evidence Before Judgment

Prefer the conceptual pipeline:

```text
Response
   ↓
Observable Evidence
   ↓
Rubric Criterion
   ↓
Judgment
   ↓
Score
```

Avoid opaque:

```text
Response → Score
```

when evidence can reasonably be represented.

### 5.4 Traceability

Important assessment outputs should retain enough information to support audit and debugging.

Where appropriate, preserve relationships such as:

```text
Assessment
  ├── Learning Outcome
  ├── Question
  │    ├── Rubric
  │    └── Evidence
  └── Evaluation
       ├── Criterion Scores
       ├── Overall Score
       └── Explanation
```

### 5.5 Calibration and Consistency

Do not assume that a single successful model response demonstrates reliability.

When modifying evaluation logic, consider:

- equivalent responses,
- borderline responses,
- malformed responses,
- incomplete responses,
- contradictory evidence,
- model uncertainty,
- rubric ambiguity.

---

## 6. AI / LLM Engineering

### 6.1 Treat Prompts as Software

Prompts are part of the application behavior.

When changing a prompt:

- identify affected outputs,
- inspect the output schema,
- check downstream consumers,
- update tests where appropriate,
- document meaningful behavioral changes.

### 6.2 Structured Outputs

Prefer constrained, machine-readable outputs for application-facing model calls.

Never blindly trust model-generated JSON.

Validate:

- required fields,
- types,
- enums,
- ranges,
- relationships,
- semantic constraints.

### 6.3 Failure Handling

Assume the model can:

- return malformed output,
- omit fields,
- invent information,
- misunderstand instructions,
- produce contradictory judgments,
- exceed expected lengths,
- refuse a task,
- time out.

The application must fail safely.

### 6.4 Prompt Injection

Treat student/user-provided text as untrusted input.

Do not allow response content to override:

- system instructions,
- rubric definitions,
- assessment policy,
- application rules,
- security constraints.

Keep trusted instructions structurally separate from untrusted content.

### 6.5 Model Independence

Avoid scattering provider-specific assumptions throughout the codebase.

Prefer an abstraction such as:

```text
Assessment Service
      ↓
LLM Interface
      ↓
Provider Adapter
      ↓
Model
```

This allows evaluation of different models without rewriting assessment logic.

---

## 7. Coding Standards

### General

Prefer:

- clear names,
- small functions,
- explicit control flow,
- predictable data structures,
- single responsibility,
- minimal dependencies.

Avoid:

- speculative abstractions,
- unnecessary framework changes,
- giant utility modules,
- hidden global state,
- duplicated business rules.

### Error Handling

Errors should be:

- meaningful,
- actionable,
- appropriately classified,
- safe to expose.

Do not silently swallow exceptions.

Avoid returning successful responses when a critical operation actually failed.

### Logging

Logs should help answer:

- what happened,
- where it happened,
- why it happened,
- which operation was affected.

Do not log:

- secrets,
- API keys,
- passwords,
- unnecessary personal data,
- sensitive student responses unless explicitly required and appropriately protected.

---

## 8. Testing Strategy

Tests should protect behavior, not implementation details.

### Unit Tests

Use for:

- pure business logic,
- validation,
- scoring,
- transformations,
- rubric calculations,
- deterministic utilities.

### Integration Tests

Use for:

- service boundaries,
- database interaction,
- assessment workflows,
- LLM adapters,
- API contracts.

### End-to-End Tests

Use for critical user journeys such as:

```text
Create Assessment
      ↓
Generate Questions
      ↓
Student Responds
      ↓
Evaluate Response
      ↓
View Result
```

### AI Evaluation Tests

Where practical, maintain representative evaluation cases.

Include:

- strong responses,
- weak responses,
- borderline responses,
- incomplete responses,
- irrelevant responses,
- adversarial responses,
- ambiguous responses.

Evaluate more than whether the request succeeds.

Consider:

- rubric alignment,
- score agreement,
- consistency,
- evidence quality,
- output compliance.

---

## 9. Security

Never commit:

- API keys,
- credentials,
- tokens,
- private certificates,
- production secrets.

Use environment variables or the project's secret-management mechanism.

Validate user-controlled identifiers and payloads.

Do not trust client-side authorization decisions.

Protect administrative and assessment-management operations with server-side authorization.

---

## 10. Data and Privacy

Student assessment data should be treated as sensitive application data.

Minimize unnecessary collection and retention.

Avoid exposing student data in:

- logs,
- error messages,
- URLs,
- analytics payloads,
- development fixtures.

When adding telemetry, explicitly consider whether the data is necessary.

---

## 11. API Design

API changes should consider:

- backwards compatibility,
- validation,
- authentication,
- authorization,
- error semantics,
- pagination where appropriate,
- stable response contracts.

Do not silently change the meaning of an existing field.

For breaking changes, explicitly identify:

```text
Old contract
New contract
Migration requirement
Affected consumers
```

---

## 12. Database and Persistence

Before changing persistence:

1. inspect existing schema/model conventions,
2. identify existing consumers,
3. consider migration requirements,
4. preserve existing data,
5. consider rollback.

Never casually delete or rename persisted fields.

Prefer additive migrations when compatibility matters.

---

## 13. Frontend Principles

The UI should reflect the actual state of the assessment system.

Represent explicitly:

- loading,
- success,
- empty,
- validation error,
- authorization error,
- system error,
- model/evaluation failure.

Do not display fabricated success states.

Assessment results should distinguish between:

- score,
- evidence,
- rubric interpretation,
- feedback,
- system status.

Accessibility is a functional requirement, not a cosmetic enhancement.

---

## 13A. Product UX Quality

LisanAI is used for consequential educational workflows. UX quality is therefore part of system quality.

### User-control principles

The UI must make clear:

- what is happening,
- why it is happening,
- what the user can do,
- what the system has already done,
- what remains to be reviewed,
- whether the result is AI-generated or human-verified.

### Assessment UX principles

Do not hide consequential information behind decorative interaction.

Do not present an AI score as final when human verification is required.

Do not make a teacher reconstruct assessment context from disconnected screens.

Do not discard entered data because of navigation, refresh, validation failure, or asynchronous model processing when preservation is reasonably possible.

### UX Definition of Done

For UI changes, the implementation is not complete until the relevant items in `docs/design/UI_QUALITY_BAR.md` have been checked.

At minimum verify:

- visual hierarchy,
- primary action,
- interaction states,
- loading state,
- empty state,
- error state,
- accessibility,
- responsive behavior,
- Light Mode,
- Dark Mode,
- AI-state clarity,
- absence of arbitrary design-token violations.

### Visual Validation

When browser or E2E tooling is available, inspect the actual rendered result rather than relying only on source code.

For substantial UI changes, validate at least:

- desktop,
- mobile,
- Light Mode,
- Dark Mode,
- normal state,
- loading/processing state,
- empty/error state where applicable.

Do not claim visual validation was performed unless it was actually performed.

---

## 14. Observability

Critical assessment workflows should be observable.

Useful events include:

```text
assessment.created
assessment.questions_generated
response.submitted
evaluation.started
evaluation.completed
evaluation.failed
assessment.completed
```

Prefer correlation/request IDs so a single assessment workflow can be traced across services.

Do not expose sensitive content merely to improve observability.

---

## 15. Performance

Optimize only after understanding the bottleneck.

Pay particular attention to:

- LLM latency,
- repeated model calls,
- unnecessary database queries,
- N+1 patterns,
- large payloads,
- frontend re-rendering,
- synchronous work in request paths.

For LLM workflows, consider:

- prompt size,
- context size,
- number of model calls,
- caching where semantically safe,
- parallelization where ordering is not required.

Do not optimize by weakening assessment quality without explicitly identifying the trade-off.

---

## 16. Change Management

For every meaningful change, ask:

### Before implementation

- What behavior is changing?
- Which modules are affected?
- What contracts are involved?
- What could regress?
- Is this an architectural change or local change?

### During implementation

- Am I reusing existing patterns?
- Is validation at the correct boundary?
- Is business logic deterministic where possible?
- Is the AI component appropriately constrained?

### After implementation

Run the most relevant checks available:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Only run commands that actually exist in the repository.

Then inspect:

```bash
git diff
git status
```

Do not claim tests passed unless they were actually executed.

---

## 16A. Documentation Hierarchy

Use the following hierarchy when deciding how to implement a change:

1. `AGENTS.md` — engineering constraints and agent behavior
2. `docs/design/UX_NORTH_STAR.md` — product UX north star
3. `docs/design/DESIGN_PRINCIPLES.md` — design principles
4. `docs/design/DESIGN_SYSTEM.md` — visual primitives
5. `docs/design/COLOR_SYSTEM.md` — semantic color system
6. `docs/design/UX_GUIDELINES.md` — interaction and UX rules
7. `docs/design/UX_FLOWS.md` — role-specific flows
8. `docs/design/UI_COMPONENT_SPEC.md` — component contracts
9. `docs/design/ACCESSIBILITY.md` — accessibility requirements
10. `docs/design/UI_QUALITY_BAR.md` — frontend definition of done
11. Existing implementation and tests — repository-specific behavior

If documentation and implementation disagree, do not silently choose one. Inspect the surrounding code and task context, identify the discrepancy, and make the smallest justified change. Update documentation when the intended behavior has changed.

---

## 17. Definition of Done

A feature or fix is considered complete when:

- [ ] The intended behavior is implemented.
- [ ] Existing behavior that should remain unchanged is preserved.
- [ ] Relevant validation is present.
- [ ] Tests are added or updated where appropriate.
- [ ] Relevant tests have been executed.
- [ ] Lint/type checks have been executed when available.
- [ ] Build validation has been executed when relevant.
- [ ] The final diff has been reviewed.
- [ ] No secrets or unnecessary sensitive data were introduced.
- [ ] Documentation is updated when behavior or architecture changes.
- [ ] Remaining risks are explicitly reported.

---

## 18. How Agents Should Reason About Tasks

Use this sequence:

```text
Understand
   ↓
Inspect
   ↓
Model
   ↓
Plan
   ↓
Implement
   ↓
Validate
   ↓
Review
   ↓
Report
```

Do not jump directly from a natural-language request to code.

For ambiguous requirements:

1. identify what is known,
2. identify what is uncertain,
3. inspect the repository for evidence,
4. make the smallest reasonable assumption,
5. state the assumption.

---

## 19. Architectural Decision Heuristic

When choosing between two implementations, prefer the one that maximizes:

```text
Correctness
+ Testability
+ Traceability
+ Maintainability
+ Reversibility
```

while minimizing:

```text
Complexity
+ Coupling
+ Hidden State
+ Vendor Lock-in
+ Irreversible Changes
```

For assessment-critical code, correctness and traceability take precedence over implementation elegance.

---

## 20. Review Checklist

Before considering a change complete, ask:

### Correctness
- Does the implementation actually solve the requested problem?
- Are edge cases handled?

### Architecture
- Does the change respect existing boundaries?
- Does it introduce unnecessary coupling?

### Assessment
- Does it preserve learning-outcome alignment?
- Does it preserve rubric semantics?
- Is the score explainable?
- Is evidence traceable?

### AI
- Are model outputs validated?
- Can prompt injection affect trusted instructions?
- Is model failure handled safely?

### Security
- Are secrets protected?
- Are authorization boundaries preserved?
- Is untrusted input handled safely?

### Quality
- Are tests sufficient?
- Are errors observable?
- Is the code maintainable?

### Regression
- Could an unrelated existing workflow break?
- Was the final diff inspected?

---

## 21. Core Principle

LisanAI should be engineered as an **assessment system that happens to use AI**, not as an AI application that happens to perform assessment.

The distinction matters.

The AI may generate, interpret, and assist. The surrounding system must provide the constraints, evidence, validation, traceability, and safeguards that make the resulting assessment trustworthy.

The same principle applies to the interface:

> LisanAI should be engineered as a **professional educational product with AI capabilities**, not as an AI-generated interface with educational content.

A polished screen is not enough. The product must be understandable, predictable, accessible, state-aware, and trustworthy.

For frontend work, design quality is part of engineering quality.
