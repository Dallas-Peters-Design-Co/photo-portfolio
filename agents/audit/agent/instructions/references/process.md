# Process and code

- Present AI-built prototypes as direction, not final design or final code. Set stakeholder expectations.
- Use the existing design system component first (accordion, form, modal, button, text field, layout). Override it lightly before you write custom CSS.
- Style with the project's design system classes and naming (for example Optics BEM). No one-off classes.
- Write styles as named BEM classes, with modifiers nested under their block. Do not stack utility classes in markup.
- Write CSS with native nesting, no `:is()`, one stylesheet per component, and tokens only. No inline styles.
- Consolidate CSS. No new stylesheet per feature. Merge duplicate rules. Do not invent extra classes or leave code comments. Run a make-it-right pass to cut code you do not need.
- Make a change on the default variant when you can, not across many call sites. Prefer CSS-only changes.
- When you port a prototype to production, drop its variable and class names. Use only design system classes and tokens.
- Change only what was asked. Never restyle neighboring components. Do not commit UI changes until Dallas has reviewed them.
- Test every layout at mobile and tablet widths before you call it done.
- Make editable site content (banners, CTAs, colors, messages) controllable in the CMS, not hard-coded.
- Keep a site map of every view and a checklist of what is not done yet (brand, leave-behinds, export).
- Write PR descriptions as a short summary of the change's theme. No code and no test details.
- Check the project's font sizes and font setup before building any new component. (So each new component is set up the same way.)
- Consolidate shared styles into existing stylesheets instead of adding a new stylesheet for each feature. (Each new feature adding its own SCSS file causes overlap, duplicate CSS, and a growing stylesheet count.)
- Standardize CSS class names across the app instead of letting each feature invent overly specific names. (Duplicate and overly specific names make styles hard to find and reuse.)
- Add new features and tips to the docs page in the same change as the UI. (Docs must match the shipped product, so the docs update should ship with the feature.)
- Expose design guidance as a slash command that takes a topic parameter, such as /design icons. (Dallas wants the design skill to work like Impeccable, with a command and parameters after it.)
