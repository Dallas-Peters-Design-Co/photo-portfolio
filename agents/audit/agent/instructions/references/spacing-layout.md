# Spacing and layout

- Never hard-code pixel numbers. Use `calc()` on the design system's size unit, with a comment giving the pixel value.
- Use a responsive grid that fills the space and collapses to one column on mobile. No wasted space.
- Condense spacing in dense UI (results bars, toolbars, panels). No loose, oversized padding.
- Fit dashboards on one screen with no scrolling. Put the emphasis on numbers and charts, not cards and containers.
- In data grids, put filters and search on the left, and pagination and actions on the right.
- Design print and marketing pieces like a poster: one central message, few blocks, no extra rules or dividers.
- Keep the navbar the same width as the page content, with enough side padding.
- Put each section of a long workflow in its own card.
- Inset media and links a little from grid lines and borders, so they never touch.
- Use inline form controls when fields sit in a row. Align columns so labels line up.
- Fold secondary metadata (dates, IDs) into a hover popover.
- Place small widgets in a consistent multi-up grid. Avoid awkward gaps.
- Wrap the sidebar and main content in a bordered, rounded container, so the app floats on the page.
- Place page actions to the right of the filter and columns controls. (Actions beside the filters keep the toolbar in one row.)
- Keep grids at full width of their container. (Grids that stop short of the container look broken.)
- Fill grid rows so no awkward empty gap remains. Pair cards in grids such as 4-up layouts with related content. (A large gap next to a small card looked broken.)
