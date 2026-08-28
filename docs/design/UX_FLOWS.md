# LisanAI UX Flows

## Teacher: Create and Publish Assessment

```text
Login
  ↓
Dashboard
  ↓
Buat Penilaian
  ↓
Konteks
  ↓
Kompetensi
  ↓
AI Recommendation (optional)
  ↓
Generate / Configure Questions
  ↓
Review
  ↓
Publish
  ↓
Assessment Ready
```

### UX requirements

The user should always know:

- where they are
- what remains
- what is required
- whether AI is working
- whether the assessment is saved

## Teacher: Review Student Assessment

```text
Dashboard
  ↓
Penilaian Terbaru
  ↓
Assessment Detail
  ↓
Student Result
  ↓
AI Evaluation
  ↓
Teacher Review
  ↓
Verified Result
```

AI-generated evaluation must be distinguishable from teacher verification.

## Student: Oral Assessment

```text
Login
  ↓
Assessment
  ↓
Pre-exam
  ↓
Microphone Check
  ↓
Ready
  ↓
Question
  ↓
Record Answer
  ↓
Submit
  ↓
Next Question
  ↓
Completion
```

Recording states:

```text
Ready
  ↓
Recording
  ↓
Processing
  ↓
Evaluated
```

Use the semantic color system:

- Ready = brand
- Recording = voice
- Processing = AI
- Evaluated = success

## Admin

```text
Login
  ↓
Admin Dashboard
  ↓
Observability / Research / API
  ↓
Detailed operational view
```

Advanced operational data should not overwhelm ordinary teacher workflows.

## Flow Quality Rules

At every step:

- provide a clear next action
- preserve user input
- provide feedback
- avoid unnecessary navigation
- prevent accidental data loss
- show system state
