# LisanAI UI Quality Bar

A frontend UI change is not complete until the following quality bar is satisfied.

## Visual

- [ ] Uses the design system tokens
- [ ] Uses the Lisan Pop color system
- [ ] Typography is consistent
- [ ] Spacing follows the scale
- [ ] Radius is consistent
- [ ] Visual hierarchy is obvious
- [ ] There is a clear primary action
- [ ] No unnecessary visual noise

## Interaction

- [ ] Hover state exists where appropriate
- [ ] Active state exists where appropriate
- [ ] Focus state is visible
- [ ] Disabled state is understandable
- [ ] Loading state exists
- [ ] Success feedback exists
- [ ] Error feedback exists
- [ ] Empty state exists for data views
- [ ] Destructive actions are protected

## UX

- [ ] User knows where they are
- [ ] User knows what to do next
- [ ] User input is preserved
- [ ] Important system state is visible
- [ ] AI-generated content is identifiable
- [ ] AI does not obscure human review
- [ ] No unnecessary modal usage

## Accessibility

- [ ] Keyboard navigation works
- [ ] Focus is visible
- [ ] Labels are accessible
- [ ] Color is not the only status signal
- [ ] Contrast is acceptable
- [ ] Reduced motion is respected
- [ ] Dynamic updates are announced appropriately

## Responsive

- [ ] Desktop checked
- [ ] Tablet checked
- [ ] Mobile checked
- [ ] No horizontal overflow except intentional tables
- [ ] Primary actions remain accessible
- [ ] Navigation remains usable

## Theme

- [ ] Light Mode checked
- [ ] Dark Mode checked
- [ ] Both themes preserve semantic meaning
- [ ] No accidental low-contrast states

## Engineering

- [ ] No arbitrary new colors without justification
- [ ] No duplicated design tokens
- [ ] Existing behavior preserved
- [ ] Existing tests pass
- [ ] E2E or visual checks run when relevant

## Final Question

Before merging, ask:

> Does this change make LisanAI clearer, calmer, more trustworthy, or more delightful?

If the answer is no, reconsider the change.
