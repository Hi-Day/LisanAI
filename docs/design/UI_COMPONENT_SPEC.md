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
