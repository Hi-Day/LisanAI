# LisanAI Design Documentation Index

The documents in `docs/design/` define the frontend visual and UX contract.

## Required reading before UI changes

1. `UX_NORTH_STAR.md`
2. `DESIGN_PRINCIPLES.md`
3. `DESIGN_SYSTEM.md`
4. `COLOR_SYSTEM.md`
5. Relevant sections of `UX_GUIDELINES.md`
6. Relevant flow in `UX_FLOWS.md`
7. `UI_QUALITY_BAR.md`

For component changes, also read `UI_COMPONENT_SPEC.md`.
For accessibility-sensitive changes, read `ACCESSIBILITY.md`.

## Agent rules

- Do not make arbitrary visual decisions when the design documents already define the answer.
- Prefer semantic tokens over hardcoded colors.
- Preserve existing product behavior unless the task explicitly changes behavior.
- Treat Light and Dark Mode as first-class designs.
- Before finishing UI work, evaluate the UI against `UI_QUALITY_BAR.md`.
