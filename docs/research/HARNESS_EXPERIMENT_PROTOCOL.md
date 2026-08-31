# LisanAI Harness Experiment Protocol

## Objective

Measure whether additional assessment-harness controls improve agreement with human assessment and reduce evaluation risk without unacceptable cost or latency.

## Experimental design

Use the same student answers, questions, rubric, model, model parameters, and evaluation input across conditions. Change only the harness configuration.

Default ablation conditions:

1. `baseline` — LLM evaluation without harness controls.
2. `rubric` — rubric-aware evaluation.
3. `rubric-evidence` — rubric + evidence grounding.
4. `rubric-evidence-verification` — rubric + evidence + verification.
5. `full-harness` — full production harness including reliability and risk controls.

## Primary outcomes

- Human-score absolute error.
- Agreement with human scores.
- Verification pass rate.
- Publication/review decision rate.
- Reliability score.

## Secondary outcomes

- Latency.
- Token/cost consumption when provider telemetry is available.
- Failure/retry rate.
- Risk level distribution.
- Evidence completeness and validity.

## Reproducibility requirements

Every run should retain:

- experiment ID;
- condition ID;
- evaluation run ID;
- harness manifest and component versions;
- model and provider version;
- rubric/prompt/config/context hashes;
- raw result and trace according to the repository's privacy policy.

## Interpretation

Do not treat a higher score as improvement by itself. The preferred harness configuration is one that improves agreement/reliability while maintaining valid evidence and acceptable operational cost. Human scores remain the reference for agreement analysis, not a claim of absolute ground truth.
