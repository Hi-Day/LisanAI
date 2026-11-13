# BINUS Maya Theme

`public/binus-theme.css` aligns LisanAI with the BINUS Maya design guide. It is loaded after `public/styles.css` and overrides tokens and a small set of component rules; application logic is unchanged.

Source of truth: **BM Design Guide** (Adobe XD share, 70 screens) — <https://xd.adobe.com/view/6f71f561-5c54-428c-be9f-d4e8fb7acea7-3a22/grid>. Values below were read in XD Specs mode from *Atom - Colors*, *Atom - Button*, and *layout-1*. Values marked *derived* fill gaps the guide does not define.

## Color tokens

### Component (guide)

| Role | Value | LisanAI token |
|---|---|---|
| Primary (OR50) | `#F3931B` | primary button fill (see Buttons) |
| Secondary (N110) | `#333333` | `--text` |
| Tertiary (N100) | `#666666` | `--text-muted` |
| Placeholder (N80) | `#999999` | `--text-subtle` |
| Border (N50) | `#CCCCCC` | `--border-strong` (text fields) |
| Background | `#F2F2F2` | table header |
| Page background (layout-1) | `#F5F5F5` | `--bg` |
| Card stroke (layout-1) | `#D9D9D9` | `--border` |

### Blue (guide: BL scale / Info)

| Role | Value | LisanAI token |
|---|---|---|
| BL70 / IF20 | `#0171A9` | `--brand`, `--info` — links, focus ring, active tabs |
| BL80 | `#016394` | `--brand-hover` |
| BL100 | `#014769` | `--brand-active` |
| Soft tint | `#E6F3FA` *(derived)* | `--brand-soft` |

### Side menu (guide: layout-1)

| Role | Value |
|---|---|
| Background | `#0097DA` |
| Hover | `#0F7DB6` |
| Selected | `#075581` |
| Text | `#FFFFFF` |
| Width / row height | 240px / 34px *(LisanAI keeps its 260px column)* |

### System (guide)

| Role | Value | LisanAI token |
|---|---|---|
| Success SC20 | `#53802E` | `--success` |
| Warning WR20 | `#A95E01` | `--warning` |
| Error ER20 | `#D12119` | `--danger` |
| Info IF20 | `#0171A9` | `--info` |

The `*-strong` text tokens keep their LisanAI values: the guide defines no text-on-soft pairing, and SC20/WR20 drop below 4.5:1 on the soft badge backgrounds.

AI purple (`--ai`) and voice pink (`--voice`) are LisanAI semantics with no BINUS equivalent and are unchanged.

## Components

- **Typography:** Open Sans (guide). Buttons use Open Sans Semibold 14px, uppercase.
- **Primary button:** gradient `#F18700 → #F39F33` (guide), text N110 `#333333`, 6px radius, 40px height.
- **Secondary button:** N100 `#666666`, white text, 6px radius, 40px height.
- **Hover/active:** *derived* — `brightness(.92)` / `brightness(.84)`. The guide's hover/click rows were not yet read; replace with exact values.
- **Text fields:** white, 1px `#CCCCCC`, 6px radius, 40px height.
- **Cards and panels:** white, 1px `#D9D9D9`, 6px radius, no shadow.
- **Tables:** header `#F2F2F2` with `#333333` text.
- **Header:** white with a bottom border.
- **Login panel gradient:** *derived* `#05658F → #3159A8 → #70439A` (the guide's *layout-login* screen has not been calibrated yet).

## Accessibility (was: exception by owner decision)

**Current state:** the three pairs below now use the AA-passing alternatives from the same palette,
applied when the product was prepared for production use: primary button text `#333333` on the guide's
orange fill (4.9:1 or better), secondary button white on N100 `#666666` (5.7:1), side menu white on BL70
`#0171A9` (5.3:1) with BL80 hover and BL100 selected. To return to the exact guide values, restore
`--binus-primary-text`, `--binus-secondary-fill` and the three `--sidebar-*` tokens in
`public/binus-theme.css`.

**Guide values and why they were replaced:**

The product owner chose to follow the guide exactly for component colors. These pairs are below WCAG 2.1 AA (4.5:1 for normal text):

| Element | Pair | Contrast |
|---|---|---|
| Primary button | white on `#F18700 → #F39F33` | 2.6 → 2.1 |
| Secondary button | white on `#999999 → #B3B3B3` | 2.9 → 2.1 |
| Side menu items | white on `#0097DA` | 3.3 |

Everything else in the theme was checked in the browser and meets AA (light, explicit dark, and system dark). Before using LisanAI where WCAG AA conformance is required, revisit these three pairs; AA-passing alternatives from the same palette are white on OR80 `#A95E01` (4.9), N100 `#666666` (5.7), and BL70 `#0171A9` (5.3), or `#333333` text on the existing orange fill (4.9).

## Dark mode

The guide defines no dark mode. In dark mode the theme keeps LisanAI dark surfaces, uses BINUS blue `#35B4E8` as the accent, renders the side menu on the dark surface, and keeps the guide's button fills. The same tokens apply to `html.dark-mode` and to system dark mode (`prefers-color-scheme: dark`) when the user has not chosen a theme.

## Not yet calibrated

- Button hover/click/disabled colors from *Atom - Button*.
- Tabs, chips, badges, alerts, snackbar, tooltip, pagination, popup, and empty-state atoms.
- Text style scale (guide: H3 48/56, H4 34/36, H5 24/24, H6 20/24, Body 16/24 and 14/20, Caption 12/16, Overline 10/16) — LisanAI headings still use the existing sizes.
- *layout-login* and the remaining layout screens.
- University division colors (not used by LisanAI).
