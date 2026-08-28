# LisanAI — Visual Color System Guide

## 1. Purpose

This document defines the visual color system for LisanAI.

The goal is to evolve the current visual language from a conventional blue SaaS dashboard into a **fun, modern, approachable AI education product** while preserving:

- readability
- accessibility
- professional credibility
- clear information hierarchy
- semantic meaning of status colors
- consistency between Light and Dark modes

The intended design direction is:

> **Lisan Pop — Playful EdTech + AI**

The interface should feel energetic and friendly, but not childish.

---

## 2. Design Principles

### 2.1 Fun, not childish

Use bright accent colors selectively. Do not make the entire interface colorful.

Recommended visual balance:

- ~80% neutral surfaces
- ~15% primary brand color
- ~5% playful accent colors

### 2.2 Semantic colors must remain predictable

Color meaning should remain stable across the application:

- Indigo = primary action / navigation
- Purple = AI / intelligence
- Pink = human / voice / expressive interaction
- Green = success / improvement
- Yellow = attention / achievement
- Cyan = informational
- Red/Pink-red = error / destructive action

### 2.3 Light and Dark must be designed as separate surfaces

Do not simply invert Light Mode.

Dark Mode should use a deep charcoal/navy foundation and slightly brighter accents.

### 2.4 Avoid excessive saturation

Bright colors should primarily appear on:

- CTA buttons
- active navigation
- badges
- charts
- AI indicators
- progress states
- recording states
- meaningful highlights

Large page backgrounds should remain neutral.

---

# 3. Core Color Tokens

## 3.1 Light Mode

```css
:root {
  /* Surfaces */
  --bg: #FFFDF7;
  --surface: #FFFFFF;
  --surface-elevated: #FFFFFF;

  /* Text */
  --text: #202235;
  --text-muted: #73778C;
  --text-subtle: #9699AA;

  /* Borders */
  --border: #E9E7F2;
  --border-strong: #D9D6E6;

  /* Brand */
  --brand: #635BFF;
  --brand-hover: #5148E8;
  --brand-active: #453BC7;
  --brand-soft: #EEECFF;

  /* AI */
  --ai: #A855F7;
  --ai-hover: #9333EA;
  --ai-soft: #F3E8FF;

  /* Human / Voice */
  --voice: #FF6B9D;
  --voice-hover: #F05289;
  --voice-soft: #FFE8F0;

  /* Semantic */
  --success: #20C997;
  --success-hover: #12B886;
  --success-soft: #E6FCF5;

  --warning: #FFB547;
  --warning-hover: #F59E0B;
  --warning-soft: #FFF4D6;

  --info: #38BDF8;
  --info-hover: #0EA5E9;
  --info-soft: #E0F5FF;

  --danger: #E85D75;
  --danger-hover: #D9485F;
  --danger-soft: #FFE8ED;
}
```

---

## 3.2 Dark Mode

```css
html.dark-mode {
  /* Surfaces */
  --bg: #11121A;
  --surface: #1A1C27;
  --surface-elevated: #202331;

  /* Text */
  --text: #F5F5FA;
  --text-muted: #A3A6B8;
  --text-subtle: #777B90;

  /* Borders */
  --border: #2B2E3D;
  --border-strong: #3A3E50;

  /* Brand */
  --brand: #8B83FF;
  --brand-hover: #A19AFF;
  --brand-active: #B0AAFF;
  --brand-soft: #27254A;

  /* AI */
  --ai: #C084FC;
  --ai-hover: #D0A0FF;
  --ai-soft: #332044;

  /* Human / Voice */
  --voice: #FF7EAA;
  --voice-hover: #FF96BA;
  --voice-soft: #432334;

  /* Semantic */
  --success: #34D399;
  --success-hover: #6EE7B7;
  --success-soft: #163B32;

  --warning: #FFC866;
  --warning-hover: #FFD98A;
  --warning-soft: #43351A;

  --info: #5DD3FF;
  --info-hover: #82DEFF;
  --info-soft: #16394A;

  --danger: #FB7185;
  --danger-hover: #FF91A0;
  --danger-soft: #47202A;

  color-scheme: dark;
}
```

---

# 4. Color Roles

## Brand — Indigo

`#635BFF` Light  
`#8B83FF` Dark

Use for:

- primary buttons
- active navigation
- selected tabs
- links
- focus indicators
- primary progress
- important controls

Do NOT use it for every highlighted element.

---

## AI — Purple

`#A855F7` Light  
`#C084FC` Dark

Use exclusively or predominantly for AI-related functionality:

- AI recommendation
- AI-generated feedback
- AI analysis
- AI processing state
- AI insight cards
- AI badges
- AI assistant surfaces

Example:

```text
AI sedang menganalisis jawaban...
```

should visually use the AI purple system rather than the primary indigo.

---

## Voice / Human — Pink

`#FF6B9D` Light  
`#FF7EAA` Dark

Use for voice-oriented or expressive interaction:

- recording
- microphone state
- speaking activity
- voice waveform
- oral assessment interaction
- human-centered highlights

Avoid using pink for generic buttons.

---

## Success — Green

Use for:

- successful submission
- published assessment
- score improvement
- completed workflow
- healthy system status

Green should communicate positive state, not merely decoration.

---

## Warning / Achievement — Yellow

Use for:

- attention required
- moderate risk
- achievement
- milestones
- noteworthy performance

Do not use yellow for errors.

---

## Info — Cyan

Use for:

- informational messages
- explanations
- contextual hints
- system information

---

## Danger — Rose Red

Use for:

- destructive actions
- validation errors
- failed operations
- critical warnings

Avoid using pure red everywhere. The rose-red direction should feel consistent with the playful brand.

---

# 5. Component Mapping

## Buttons

### Primary

```css
background: var(--brand);
color: white;
```

Hover:

```css
background: var(--brand-hover);
```

Use for the most important action on a screen.

Examples:

- Buat Penilaian
- Simpan
- Publish
- Mulai Penilaian

### Secondary

Use neutral surfaces:

```css
background: var(--surface);
color: var(--text);
border: 1px solid var(--border);
```

### AI Button

Only for AI-specific actions:

```css
background: var(--ai);
color: white;
```

Examples:

- Rekomendasikan kompetensi
- Analisis dengan AI
- Generate feedback

### Destructive

```css
background: var(--danger);
color: white;
```

Use sparingly.

---

# 6. Navigation

Inactive:

```css
color: var(--text-muted);
background: transparent;
```

Active:

```css
color: var(--brand);
background: var(--brand-soft);
```

Hover:

```css
color: var(--brand);
background: var(--brand-soft);
```

Do not introduce a different accent color for every navigation item.

---

# 7. Cards

Default card:

```css
background: var(--surface);
border: 1px solid var(--border);
```

AI card:

```css
background: var(--ai-soft);
border-color: color-mix(in srgb, var(--ai) 25%, var(--border));
```

Success card:

```css
background: var(--success-soft);
```

Warning card:

```css
background: var(--warning-soft);
```

The semantic background should be subtle. Avoid highly saturated full-card backgrounds.

---

# 8. Dashboard KPI Cards

Recommended semantic mapping:

| KPI | Color |
|---|---|
| Total Penilaian | Brand Indigo |
| Rata-rata Skor | AI Purple |
| Siswa Aktif | Cyan |
| Peningkatan | Green |
| Perlu Perhatian | Yellow |
| Error / Failed | Rose |

Do not make all KPI cards different saturated colors. Prefer a colored icon, top border, or small accent indicator.

---

# 9. Charts

Charts should use a restrained palette.

Recommended sequence:

1. Brand Indigo
2. AI Purple
3. Voice Pink
4. Cyan
5. Green
6. Yellow

Avoid rainbow charts.

For line charts:

- primary metric → `--brand`
- AI-related metric → `--ai`
- comparison metric → `--voice`
- benchmark → muted neutral

Grid lines should use `--border`, not a saturated color.

---

# 10. Recording / Oral Assessment UI

This is one of the most important opportunities to make LisanAI feel distinctive.

### Idle

Neutral:

```text
--text-muted
--border
```

### Ready

Brand Indigo:

```text
--brand
```

### Recording

Voice Pink:

```text
--voice
```

### Processing

AI Purple:

```text
--ai
```

### Completed

Success Green:

```text
--success
```

The state transition should therefore communicate:

> Ready → Speaking → AI Processing → Evaluated

through a coherent visual language.

---

# 11. AI Streaming UI

For components such as:

- AI recommendation
- AI generation
- AI evaluation
- AI feedback

use Purple as the visual identity.

Recommended:

```css
.ai-stream-panel {
  background: var(--ai-soft);
  border: 1px solid color-mix(
    in srgb,
    var(--ai) 25%,
    var(--border)
  );
}

.ai-stream-spinner {
  background: var(--ai);
}
```

Avoid using the same blue/indigo used for normal navigation.

This distinction helps users understand what is generated by the system versus what is a normal application action.

---

# 12. Focus and Accessibility

All interactive controls must have a visible focus state.

Recommended:

```css
:focus-visible {
  outline: 3px solid color-mix(
    in srgb,
    var(--brand) 45%,
    transparent
  );
  outline-offset: 2px;
}
```

Do not rely on color alone to communicate:

- success
- failure
- active state
- recording state
- AI state

Use icons, labels, shape, or text in addition to color.

Examples:

```text
✓ Berhasil
⚠ Perlu perhatian
● Sedang merekam
✦ AI sedang menganalisis
```

---

# 13. Dark Mode Rules

Dark Mode must preserve hierarchy.

Recommended layer structure:

```text
--bg
  ↓
--surface
  ↓
--surface-elevated
  ↓
interactive state
```

Do not use pure black.

Do not use bright colors as large backgrounds.

Do not reduce text contrast excessively.

Primary and semantic colors should become slightly brighter in Dark Mode, but their semantic identity must remain unchanged.

---

# 14. Brand Gradient

A gradient may be used selectively for hero areas, logo treatments, AI visualizations, and special moments.

Recommended:

```css
linear-gradient(
  135deg,
  #635BFF 0%,
  #A855F7 100%
);
```

Dark mode:

```css
linear-gradient(
  135deg,
  #8B83FF 0%,
  #C084FC 100%
);
```

Do not use this gradient on every button or card.

It should communicate a **special / premium / AI moment**.

---

# 15. Logo

The existing LisanAI logo uses a blue rounded-square background with a white audio waveform.

The waveform concept should be preserved because it directly communicates oral interaction.

Update the brand color from the current blue toward the new brand direction.

Preferred logo background:

```text
#635BFF
```

Optional special/marketing treatment:

```text
#635BFF → #A855F7
```

The standard application logo should preferably remain a solid color for clarity and consistency.

---

# 16. What NOT to Do

Do not:

- use blue, purple, pink, yellow, green simultaneously on every screen
- make every card colorful
- use gradients everywhere
- use pure black in Dark Mode
- use pure white text on yellow backgrounds
- use color alone to communicate state
- introduce new arbitrary hex colors inside individual components
- hardcode colors when an existing semantic token exists
- change semantic meaning of colors between Light and Dark modes
- use AI purple for generic application actions

---

# 17. Migration Strategy

The current code already uses centralized CSS variables such as:

- `--ink`
- `--muted`
- `--line`
- `--paper`
- `--panel`
- `--accent`
- `--accent-strong`
- `--accent-dark`
- `--accent-light`
- `--blue`
- `--sky`
- `--amber`
- `--rose`
- `--emerald`

Migrate these into the new semantic system instead of performing a blind global color replacement.

Recommended mapping:

| Existing | New |
|---|---|
| `--ink` | `--text` |
| `--muted` | `--text-muted` |
| `--line` | `--border` |
| `--paper` | `--bg` |
| `--panel` | `--surface` |
| `--accent` | `--brand` |
| `--accent-strong` | `--brand-hover` |
| `--accent-dark` | `--brand-active` |
| `--accent-light` | `--brand-soft` |
| `--blue` | `--brand` or `--info`, based on usage |
| `--sky` | `--info` |
| `--amber` | `--warning` |
| `--rose` | `--danger` |
| `--emerald` | `--success` |

Introduce `--ai` and `--voice` as new semantic tokens.

Before removing old tokens, inspect their usages and determine whether each occurrence is brand, AI, voice, information, or status.

---

# 18. Implementation Requirements for OpenCode

When implementing this guide:

1. Inspect the entire frontend before modifying styles.
2. Identify every hardcoded color in HTML, CSS, inline styles, SVG, and JavaScript-rendered UI.
3. Replace hardcoded UI colors with semantic tokens where practical.
4. Do not blindly replace all blue values with indigo.
5. Preserve existing layout, spacing, typography, and behavior unless a color-related adjustment is required.
6. Keep Light and Dark Mode visually coherent.
7. Update charts and dynamically rendered components.
8. Update the logo asset if appropriate.
9. Check hover, active, focus, disabled, loading, error, success, recording, and AI-processing states.
10. Verify contrast for text and controls.
11. Run the existing test suite.
12. Use browser/e2e screenshots to visually inspect both themes.
13. Fix visual regressions caused by the palette migration.
14. Do not introduce unnecessary dependencies.
15. Keep the implementation centralized and maintainable.

---

# 19. Acceptance Criteria

The redesign is complete when:

- [ ] Light Mode uses the Lisan Pop palette.
- [ ] Dark Mode uses the corresponding dark palette.
- [ ] Primary actions consistently use Indigo.
- [ ] AI functionality consistently uses Purple.
- [ ] Voice/recording functionality consistently uses Pink.
- [ ] Success uses Green.
- [ ] Warning/achievement uses Yellow.
- [ ] Information uses Cyan.
- [ ] Destructive/error states use Rose Red.
- [ ] No major UI component contains arbitrary hardcoded colors without justification.
- [ ] Charts use the new visual system.
- [ ] Sidebar and navigation use the new brand system.
- [ ] Login/authentication screens use the new brand system.
- [ ] Assessment wizard uses the new brand system.
- [ ] Recording UI uses the voice color system.
- [ ] AI streaming UI uses the AI color system.
- [ ] Dark Mode does not look like an inverted Light Mode.
- [ ] Focus states remain visible.
- [ ] Semantic meaning is not communicated by color alone.
- [ ] Existing application behavior is unchanged.
- [ ] Existing tests pass.
- [ ] Visual inspection shows a coherent, playful, modern edtech identity.

---

# 20. Final Design Direction

The intended emotional progression is:

**LisanAI should feel like:**

> Friendly enough for students.  
> Professional enough for teachers.  
> Trustworthy enough for schools.  
> Modern enough to feel genuinely AI-native.

The palette should communicate:

**Indigo = LisanAI**  
**Purple = AI**  
**Pink = Voice / Human**  
**Green = Progress**  
**Yellow = Achievement / Attention**  
**Cyan = Information**

The visual goal is not “more colors”.

The goal is:

> **More personality through controlled color semantics.**
