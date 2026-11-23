# Pre-ship checklist

## Layout and spacing

- [ ] Every padding, margin and gap comes from the 4/8 scale.
- [ ] Web uses a 12-column (or 8-column) grid. Forms and articles have a max-width.
- [ ] Mobile side margins are 20–24 px with nothing inside them.
- [ ] Text never touches screen edges. Mixed sizes align on the baseline.
- [ ] There is a clear first, second and third read. Related items are grouped by proximity or by a container.

## Type

- [ ] One typeface, about 5 sizes, all from the scale.
- [ ] Body is 16–17 px with a line height of about 1.6. Headings are 1.1–1.3.
- [ ] Paragraphs are 50–60 characters wide and left-aligned.
- [ ] Header and body weights are at least two steps apart, and there is no Light on small text.

## Color and depth

- [ ] The hierarchy still works in grayscale.
- [ ] There is one primary, used only on key elements. Success, warning and error are distinct from it.
- [ ] There is no `#000` text and no `#000` shadow.
- [ ] Every text/background pair passes WCAG AA.
- [ ] Shadows are soft, sit only on interactive or elevated elements, and follow consistent levels.
- [ ] Gradients (if any) are linear, similar in hue, free of a muddy center and rare.

## Components

- [ ] Buttons are 40–60 px tall with a 16 px label and one primary per group. The primary sits on the right in pairs.
- [ ] Each button label says exactly what happens. A money action says so and has a note.
- [ ] Every interactive target is at least 44×44.
- [ ] Every component has all its states: hover, pressed, focus, disabled, error and success.
- [ ] Each input has a visible label, the right control type, inline validation and keeps its data on error.
- [ ] Optional fields are marked "(optional)". Forms with 5+ fields are split into steps.
- [ ] Cards show only decision-relevant info, look clickable, have a hover state, truncate long text and have an image placeholder.
- [ ] Icons come from one pack, in one style, with equal stroke and roundness, in a 24 box. Unfamiliar icons have labels.
- [ ] Nav: visible with 5 or fewer items (hidden with 7 or fewer). The tab bar is 60–84 px tall with all or no labels and a safe-area inset.
- [ ] Contextual links look clickable.

## Content and feel

- [ ] Personality signals agree: color, type, radius, icons, imagery and tone.
- [ ] Copy is real (no Lorem Ipsum) and short, in a human tone. Errors offer a fix. Dialogs name the object and the consequence.
- [ ] Photos are authentic, high resolution, have one focal point and an overlay under any text, and crop well.
- [ ] Animations give feedback, are under 1000 ms and eased, and nothing flashes more than 3 times per second.
- [ ] Images have alt text (decorative ones have `alt=""`). Media has captions or transcripts.
- [ ] Empty, loading, error and 404 states exist.
- [ ] Nothing on the screen can be removed without losing function, and the screen still has personality.
