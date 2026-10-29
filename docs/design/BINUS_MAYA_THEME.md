# BINUS Maya Theme Tokens

This document records the first implementation pass based on the supplied BM Design Guide screenshots.

> Calibration note: the screenshots establish the visual direction, but do not expose inspectable color values or measurements. The HEX values below are implementation approximations and should be checked against the source XD assets or exported PDF before pixel-level sign-off.

## Color roles

| Token | Value | Usage |
|---|---|---|
| Primary blue | `#078FCB` | Navigation, links, selected states, focus |
| Deep blue | `#064B70` | Strong headings and table headers |
| Cyan | `#079BD3` | Supporting brand accent |
| Orange | `#F39200` | Primary calls to action |
| Orange hover | `#DD8100` | Hover state |
| Brand gradient | `#078FCB → #3159A8 → #70439A` | Login/hero surfaces |

AI purple and voice pink remain separate semantic colors. Success, warning, info, and danger retain their existing semantic tokens.

## Component rules

- Primary action: orange fill, white text, minimum 42px height.
- Secondary action: neutral surface, visible border, blue hover treatment.
- Navigation: blue active state; pale blue hover state.
- Form controls: consistent 42px minimum height, 8px radius, visible blue focus ring.
- Cards and panels: neutral surface, subtle border, 10–12px radius, restrained shadow.
- Tables: pale blue header, clear row separators, hover feedback.
- Status badges: retain semantic colors; never rely on color alone.

## Implementation

- `public/binus-theme.css` is an additive theme layer loaded after `public/styles.css`.
- Existing component styles and application logic remain in place.
- Dark-mode overrides are included.
- Reduced-motion preferences are respected.

## Next calibration pass

Obtain source color tokens and component measurements from the XD design guide. Then refine typography, spacing, sidebar dimensions, table density, modal geometry, and responsive behavior against representative LisanAI screens.
