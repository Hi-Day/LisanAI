# LisanAI calibration v2 reference-label audit

**Status:** provisional diagnostic audit; not lecturer validation.  
**Scope:** review the existing 12-case synthetic benchmark without changing any v2 score. The follow-up dataset `lisanai-calibration-v3.json` retains all 12 answers, overall reference scores, and criterion-level reference scores from v2; it changes rubric wording to make evidence-state handling explicit.

## Scoring rules made explicit in v3

1. Score evidence actually present in the answer; do not infer unstated knowledge.
2. Distinguish correct-and-supported, correct-but-incomplete, omitted/not addressed, and factually incorrect/contradicted.
3. Omission receives no positive evidence credit for the omitted criterion, but is not itself a false claim.
4. Award partial credit for correct components; a contradiction should affect the criterion it contradicts rather than erase unrelated correct evidence.
5. Accept paraphrases/equivalent notation and ignore ASR, spelling, grammar, punctuation, or capitalization artifacts unless meaning changes.

## Cases requiring lecturer review

| Case | Priority | Audit question | Scores changed? |
|---|---|---|---|
| `cal2-08` | High | The answer describes checking the middle and choosing a side but does not explicitly state the sorted-array precondition, compare target vs. middle, or give O(log n). Are synthetic reference scores of 65 for precondition and 85 for procedure too generous? Is termination credit appropriate for “repeat until found” without the empty-range condition? | No |
| `cal2-11` | High | The answer correctly names 17 August 1945, Soekarno and Hatta, and the broad significance, while explicitly omitting historical context. Does the rubric preserve credit for event/actors while limiting the context criterion? Are the synthetic criterion scores calibrated? | No |
| `cal2-10` | Medium | A strong answer gets synthetic criterion references of 95–100. Does the rubric require further historical detail before awarding those scores? | No |
| `cal2-06` | Medium | The answer uses the incorrect rule of adding numerators and denominators. Is the synthetic answer criterion score of 10 intended as minimal credit, or should it be zero? | No |

## Interpretation and next evaluation

- The earlier v2 live run reported MAE 8.17, RMSE 13.13, and 8/12 within ±5 points. Those metrics compare model scores to synthetic labels and are not a validated measure of agreement with lecturers.
- v3 is a **rubric-wording diagnostic**, not a corrected ground-truth set. The numbers are deliberately unchanged so a v2/v3 comparison isolates rubric-language changes more cleanly.
- After a fresh live run, compare per-case and per-criterion deltas against the prior v2 run. Since model calls can vary, a single run is not sufficient to establish a causal improvement.
- Before making research claims, ask subject-matter lecturers to independently score the same answers using the rubric, reconcile disagreements, and retain annotator identity and adjudication notes. Only then treat human labels as reference scores.
