# LisanAI Accessibility Guidelines

## Target

Aim for WCAG 2.2 AA.

## Keyboard

All interactive elements must be keyboard accessible.

Required:

- logical tab order
- visible focus
- Escape closes dismissible dialogs
- Enter/Space activates appropriate controls
- no keyboard traps

## Focus

Use:

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

## Color

Do not communicate meaning by color alone.

Pair color with:

- text
- icon
- shape
- label
- position

## Contrast

Check text, controls, status labels, and focus indicators against their actual background in both themes.

## Forms

Every form control must have an accessible label.

Errors must identify:

- the field
- the problem
- how to fix it

## Audio

Recording controls need accessible names and clear state announcements.

Example:

- Start recording
- Stop recording
- Recording in progress
- Processing response
- Recording completed

## Motion

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

Avoid essential information being communicated through animation only.

## Screen Readers

Use semantic HTML before ARIA.

ARIA should supplement—not replace—native semantics.

Dynamic AI processing and important result updates should use appropriate live regions.

## Responsive Accessibility

Touch targets should be sufficiently large.

Do not hide essential actions on mobile.

## Testing

At minimum verify:

- keyboard-only navigation
- focus visibility
- contrast
- form labels
- modal focus behavior
- recording control accessibility
- dynamic status announcements
