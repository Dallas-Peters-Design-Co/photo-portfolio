# Accessibility

- Meet WCAG AA contrast (4.5:1) for all text, including small helper and error text.
- Check legibility in light and dark mode. Run axe-core on every view.
- Give every logo image alt text.
- Make touch targets at least 44px. Use `pointer: coarse` to enlarge them, not width guesses.
- Use `aria-current`, `aria-expanded`, `role=status`, and real headings.
- Modals trap focus, close on Escape, and return focus to the trigger.
- Use pointer media queries to enlarge controls and touch targets when the pointer is coarse. (Touch screens need larger targets than mouse pointers.)
