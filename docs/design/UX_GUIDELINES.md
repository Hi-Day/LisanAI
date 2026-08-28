# LisanAI UX Guidelines

## Navigation

Navigation must reflect user role and primary jobs-to-be-done.

Teacher-oriented navigation should prioritize:

1. Dashboard
2. Penilaian
3. Siswa
4. Kelas

Admin-oriented navigation may expose:

- Observability
- Research
- API
- Tenant / administration

Do not expose advanced administrative functions to users who do not need them.

## Page Structure

Each page should have:

1. page title
2. concise description
3. primary action
4. relevant filters/tools
5. main content
6. supporting information

## Actions

Every important action needs appropriate states:

- default
- hover
- active
- focus
- disabled
- loading
- success
- error

Loading must preserve layout and button dimensions.

## Forms

Forms should:

- group related fields
- explain unfamiliar fields
- validate near the source of the error
- preserve entered values
- distinguish required from optional fields
- avoid unnecessary steps

## Wizard

The assessment creation wizard should clearly communicate:

Context → Questions → Review & Publish.

Users must be able to understand:

- current step
- completed steps
- unavailable future steps
- what is required to continue

Do not allow a later step to appear completed when its data is incomplete.

## Destructive Actions

Deletion and irreversible operations require confirmation.

Confirmation must explain the consequence.

## Feedback

Use:

- inline feedback for field-level errors
- toast for short-lived system feedback
- persistent panel for important processing states
- empty state for missing content

## Empty States

Every data-heavy page needs an intentional empty state.

An empty state should contain:

- what is empty
- why it matters
- what the user can do next

## AI UX

AI output should visibly indicate:

- generated content
- processing
- confidence or verification state when applicable
- user review opportunity

Avoid presenting AI-generated assessment results as unquestionable facts.

## Tables

Tables should prioritize:

- student
- assessment
- date
- score
- status
- action

Avoid excessive columns.

On small screens, prioritize critical columns and provide a detail view.

## Responsive UX

Desktop and mobile should not be treated as the same layout at different widths.

On mobile:

- collapse secondary navigation
- stack filters
- preserve primary actions
- make tables scroll or transform into cards
- ensure recording controls remain prominent
