# LisanAI Design System

## Purpose

Single source of truth for visual primitives and reusable UI conventions.

## Typography

Primary font: Outfit.

Recommended hierarchy:

- Display: 40–48px / 700–800
- H1: 32–40px / 700–800
- H2: 24–28px / 700
- H3: 18–20px / 600–700
- Body: 15–16px / 400–500
- Small: 13–14px / 400–500
- Caption: 12px / 500

Use line-height generously for instructional and assessment content.

## Spacing

Use a consistent 4px base scale:

- 4px: micro
- 8px: tight
- 12px: compact
- 16px: default
- 24px: section
- 32px: major section
- 48px: page
- 64px: hero

Avoid arbitrary spacing unless required by a specific component.

## Radius

Recommended:

- 6px: small controls
- 10px: buttons and inputs
- 12px: cards
- 16px: major cards and panels
- 999px: pills and avatars

## Elevation

Prefer borders and surface contrast over heavy shadows.

- Level 0: background
- Level 1: card
- Level 2: elevated card / dropdown
- Level 3: modal

Shadows should remain subtle.

## Motion

Default transition: 150–250ms.

Use motion to communicate:

- state change
- hierarchy
- progress
- feedback

Respect prefers-reduced-motion.

Avoid decorative animation that competes with assessment tasks.

## Iconography

Use one consistent icon family.

Icons must support meaning rather than replace necessary text.

Interactive icon-only controls require accessible labels.

## Layout

Prefer:

- strong page headings
- clear section grouping
- generous whitespace
- predictable content widths
- responsive grids
- consistent card alignment

Avoid excessive nested cards.

## Components

Reusable components should have consistent:

- dimensions
- typography
- spacing
- states
- focus behavior
- semantic colors

See UI_COMPONENT_SPEC.md.
