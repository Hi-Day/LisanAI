# LisanAI UI Component Specification

## Primary Button

- Height: 44px minimum
- Radius: 10px
- Font weight: 600
- Background: `--brand`
- Text: white

States:

- hover: `--brand-hover`
- active: `--brand-active`
- focus: visible focus ring
- disabled: muted surface/text
- loading: preserve width and show progress

Rule: maximum one dominant primary CTA per context.

## Secondary Button

- Surface: `--surface`
- Border: `--border`
- Text: `--text`

Use for secondary actions.

## AI Button

Use only for AI operations.

- Background: `--ai`
- Text: white

## Input

- Minimum height: 44px
- Radius: 10px
- Border: `--border`
- Focus: brand focus ring
- Error: danger border and supporting text

## Select

Follow input dimensions and focus behavior.

## Card

Default:

```text
surface + border + 12–16px radius
```

Avoid excessive shadows.

## Badge

Use semantic colors for meaningful status.

Examples:

- Draft
- Published
- Processing
- Verified
- Needs attention

Never use arbitrary colors for badges.

## Modal

Use for:

- confirmation
- focused secondary task
- information that requires temporary attention

Do not use modal for workflows that require extensive interaction.

## Form Dialog

Use `showFormDialog` (`src/js/toast.js`) whenever the user must enter a value to complete an action,
for example correcting a score, answering a complaint, or renaming a class. Never use the browser's
native `prompt()`, `alert()` or `confirm()`.

- State the consequence in the description (what changes, who will see it).
- Validate next to the field; keep the dialog open and focus the first invalid field.
- Escape and "Batal" cancel without side effects; focus returns to the trigger.

## Toast

Use for short-lived feedback.

Do not use toast as the only indication of critical failure.

## Tabs

Tabs should represent mutually related views, not unrelated navigation.

Active tab uses brand color and clear selected state.

## Table

Header should be visually distinct but subtle.

Rows need hover feedback when clickable.

Do not rely on row color alone to communicate status.

## Wizard

Must communicate:

- current step
- completed step
- disabled future step
- validation state

## Audio Recorder

States:

- idle
- ready
- recording
- paused
- processing
- completed
- failed

Use voice pink for recording and AI purple for processing.

## AI Streaming Panel

Must distinguish:

- AI processing
- generated content
- errors
- completion

Use `--ai` and `--ai-soft`.

## Empty State

Structure:

```text
Icon / illustration
Title
Explanation
Primary or secondary action
```

Avoid generic "No data" without context.

## Question Table

A question may carry a table of data for the student to analyse. The table lives inside the question
prompt as a Markdown pipe table (`| A | B |`, second line `| --- | --- |`), so the prompt stays one plain
string for storage, evaluation and export.

- **Render:** `questionTablesHtml()` in `src/js/question-text.js`. Cells are always escaped; a prompt is never HTML.
- **Placement:** the wording goes in the question heading; tables follow directly under it in a
  `.table-container.question-table` (scrolls sideways when it cannot fit, cell text wraps).
- **Authoring:** the question editor has a "Sisipkan tabel" button that drops a template at the caret and a
  live preview under the field. The AI generator may write a table when the question needs data.
- **Integrity:** wording checks ignore table rows, and any rewrite of a question keeps its table
  (`server/assessment/question-table.js`).
