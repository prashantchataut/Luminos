# Color, shadows, gradients

## Color

### Building the palette

- **Start in grayscale,** then add color where it has a function.
- **Choose by meaning:**

| Color | Meaning | Best for | Note |
|---|---|---|---|
| Blue | Trust, calm, security | Finance, social | The safest default; hard to stand out |
| Red | Energy, danger | Errors, entertainment, sports | — |
| Yellow | The most visible color; warmth | Warnings, food, travel | Light saturated yellow strains the eyes, so avoid large areas |
| Orange | Creativity, enthusiasm | Sales, sports | — |
| Green | Health, growth | Success, finance, fitness | — |
| Purple | Luxury, mystery | Tech, luxury | — |

- **A monochromatic palette is the easiest to get right.** Use one primary plus its tints (backgrounds, card fills) and shades (text). Several bold colors need much more hierarchy work.
- **Don't trust 4-color palette generators.** They have no grays, no roles and no reasoning behind the choices.
- **Grays make up most of the surface** in a good UI.

### Using it

- **Dark mode:** show elevation with lighter surfaces, not white shadows or glows.
- **Test on a real, cheap screen** and in sunlight when you can. About 4.5% of people have some form of color blindness.

## Depth: shadows and gradients

### Shadows

- **Use drop shadows to elevate** clickable or higher-layer elements, such as buttons, cards and popovers.
- **Avoid inner shadows** almost always: they read as holes.
- **No shadows** on text, disabled elements or non-interactive elements.
- **Always replace the default shadow** (`0 4 4` at 25%, black) with a soft one (see `tokens.md`).

### Gradients

- **Linear only,** unless there is a reason for another kind. Radial is for 3D-looking objects. Angular and mesh gradients are experiments, not routine choices.
- **Recipe:** put the same color at both ends, then shift the hue of one end by about 20–25.
- **No muddy gray center.** Don't blend very different hues.
- **Use gradients sparingly,** on the primary CTA or the brand mark. Gradients everywhere cause cognitive overload.
- A gradient plus a matching colored shadow makes a strong primary element.
