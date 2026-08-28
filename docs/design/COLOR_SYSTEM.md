# LisanAI Color System

## Direction

> Lisan Pop — Playful EdTech + AI

The product should feel energetic and approachable without becoming childish.

## Color Roles

- Indigo = LisanAI brand / primary action
- Purple = AI / intelligence
- Pink = voice / human expression
- Green = success / progress
- Yellow = warning / achievement
- Cyan = information
- Rose red = error / destructive

## Light Mode

```css
--bg: #FFFDF7;
--surface: #FFFFFF;
--surface-elevated: #FFFFFF;

--text: #202235;
--text-muted: #73778C;
--text-subtle: #9699AA;

--border: #E9E7F2;
--border-strong: #D9D6E6;

--brand: #635BFF;
--brand-hover: #5148E8;
--brand-active: #453BC7;
--brand-soft: #EEECFF;

--ai: #A855F7;
--ai-hover: #9333EA;
--ai-soft: #F3E8FF;

--voice: #FF6B9D;
--voice-hover: #F05289;
--voice-soft: #FFE8F0;

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
```

## Dark Mode

```css
--bg: #11121A;
--surface: #1A1C27;
--surface-elevated: #202331;

--text: #F5F5FA;
--text-muted: #A3A6B8;
--text-subtle: #777B90;

--border: #2B2E3D;
--border-strong: #3A3E50;

--brand: #8B83FF;
--brand-hover: #A19AFF;
--brand-active: #B0AAFF;
--brand-soft: #27254A;

--ai: #C084FC;
--ai-hover: #D0A0FF;
--ai-soft: #332044;

--voice: #FF7EAA;
--voice-hover: #FF96BA;
--voice-soft: #432334;

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
```

## Rules

Use approximately 80% neutral surfaces, 15% primary brand, and 5% playful accents.

Do not make every card colorful.

Do not use color alone to communicate state.

Do not introduce arbitrary hardcoded colors when a semantic token exists.

## Brand Gradient

Use selectively:

```css
linear-gradient(135deg, #635BFF 0%, #A855F7 100%);
```

Suitable for special AI/hero moments, not generic UI.
