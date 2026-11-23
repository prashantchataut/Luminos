---
name: ui-design
description: "Load before designing, building or reviewing any UI screen or component, web or mobile: layout, spacing, type, color, shadows, buttons, forms, cards, icons, navigation, imagery, copy, motion, accessibility, empty/error states. The rules every screen follows are here, with one reference file per topic: read only the ones the task touches."
---

# UI design: rules for building interfaces

These rules are distilled from *UI Design Principles* by Michael Filipiuk (2021 edition). This file holds the rules that apply to every screen. `references/` (next to this file) holds the detail, one file per topic; read only the files your task touches.

Rules without a tag come from the book. **(WCAG)** marks an accessibility standard the book does not state. **(convention)** marks a common industry value added to fill a gap. **(derived)** marks a value computed with the book's own method. 1 pt in the book = 1 CSS px = 1 iOS pt = 1 Android dp.

## The repo's design system wins

If the repo already has tokens or a theme (a Tailwind config, CSS variables, a shadcn/MUI theme, a `components/ui/` library), use those. This skill only fills what they don't define.

- **Never introduce a second set of tokens** next to the repo's own.
- **Reuse an existing component** rather than building a parallel one.
- **When the repo itself breaks one of the rules below** (a contrast that fails, a 32 px button), keep the repo's value and report the conflict. Don't silently override it.

**Priority when rules conflict:** usability > accessibility > consistency > simplicity > looks.

## Quick path

1. **Personality first:** playful, neutral or serious, based on the brand and the audience (`references/personality-and-copy.md`). Never your own taste.
2. **Tokens before screens:** colors, type scale and spacing scale, from the repo or `references/tokens.md`. Use nothing outside them.
3. **Grayscale first:** get hierarchy, layout and spacing right, then add color only where it has a job.
4. **Components with every state** (default, hover, pressed, focus, disabled, error, success), and **every screen state** (empty, loading, error, 404).
5. **Before reporting done:** go through `references/checklist.md` for what you built. If you can screenshot it, check the screenshot, not the code.

## Non-negotiables

1. **Spacing comes from the scale.** Use a 4 pt scale on mobile and an 8 pt scale on web. No 5, 13 or 22 px values.
2. **Body text is 16–17 px.** Never go below 10 px for any text, and prefer 12 px or more. Never use a Light weight on small text.
3. **One typeface,** a sans serif by default. Use about 5 sizes.
4. **Never use `#000000`** for text or shadows. Use a dark tinted gray such as `#1F1F1F`.
5. **One primary color,** applied only to what must stand out. If everything stands out, nothing stands out.
6. **Contrast:** 4.5:1 for body text, and 3:1 for large text and UI parts **(WCAG)**.
7. **Never use color alone** to carry meaning. Errors, success messages and links also get an icon, text, weight or an underline.
8. **Every tap or click target is at least 44×44,** even when the visible glyph is smaller.
9. **Buttons are 40–60 px tall,** with one primary button per group. When buttons come in pairs, the primary goes on the right. The label says exactly what happens.
10. **Inputs always have a visible label.** A placeholder alone is not a label. Use a single-column form with inline validation, and never wipe what the user entered.
11. **Shadows are soft** (large Y offset, large blur, 5–10% opacity), and only on interactive or elevated elements.
12. **Icons come from one pack,** in one style, with the same stroke width and roundness. Icons that aren't universally known get a label.
13. **Animations give feedback,** last under 1000 ms, and are eased (never linear).
14. **No Lorem Ipsum.** Write real, short, human copy. Errors say how to fix the problem. Dialogs name the object and the consequence.
15. **Same thing, same look, same behavior** across screens. Follow platform patterns for behavior.

## Which reference to read

| The task touches | Read |
|---|---|
| A new project or theme, choosing values | `tokens.md` (spacing, type scale, color roles, radius, shadow, motion, starter CSS) |
| A page or screen layout, grid, spacing, hierarchy | `layout.md` |
| Text styles, headings, paragraphs | `typography.md` |
| Palette, dark mode, shadows, gradients | `color-and-depth.md` |
| Buttons and CTAs | `buttons.md` |
| Forms, inputs, selects, checkboxes, validation | `forms.md` |
| Cards, lists of items | `cards.md` |
| Icons | `icons.md` |
| Tab bar, top nav, sidebar, links | `navigation.md` |
| Photos, illustrations, empty-state and 404 art | `imagery.md` |
| Brand feel, button labels, dialogs, errors, tone | `personality-and-copy.md` |
| Transitions, hover, loading, feedback | `motion.md` |
| Contrast, alt text, targets, captions | `accessibility.md` |
| Components to reuse, states, empty/404 screens, a design system | `system-and-states.md` |
| Reviewing a finished screen | `checklist.md` |

All paths are under this skill's `references/` folder.
