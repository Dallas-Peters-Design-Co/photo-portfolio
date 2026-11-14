# Color

- Write every theme color in OKLCH.
- Keep all colors in one central theme file, so brand colors, logos, and marks change in one place.
- Use only colors from the theme, at their base step unless you mean a different step. Use the tokens directly, never hard-coded values.
- When users can change a background, set the text color with `contrast-color()` or similar, not a fixed color.
- Never use a red primary for positive or confirming actions. Red reads as negative.
