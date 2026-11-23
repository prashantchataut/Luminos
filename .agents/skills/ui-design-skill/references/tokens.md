# Tokens (starter values)

Adapt these to the brand, but keep the structure. Document each token with its specs, not just its name.

## Spacing

| Context | Base | Scale |
|---|---|---|
| Web / large screens | 8 | 8, 16, 24, 32, 40, 48, 56, 64, 80, 96… |
| Mobile | 4 | 4, 8, 12, 16, 20, 24, 28, 32, 40, 48… |

- **Use a soft grid:** spacing (padding, margin, gap) comes from the scale, and element sizes may be free. Don't mix soft and hard grids in one project.
- If you keep needing a value in between two steps, change the base. Don't add one-off values.

## Type scale

The book builds it by hand rather than with a ratio (golden ratio and similar scales leave big gaps). Start at 16, step by ±2 from 10 to 20, by +4 from 20 to 32, then by +8.

| Size | Typical use | Line height | Weight |
|---|---|---|---|
| 10 | Absolute minimum (legal, tiny meta) | 16 | Regular+ |
| 12 | Caption, small label | 20 | Regular / SemiBold if tiny |
| 14 | Secondary text | 22 | Regular |
| 16 | **Body, inputs, buttons** | 26 | Regular |
| 18 | Lead text, small heading | 28 | SemiBold |
| 20 | H4 | 26 (×1.3) | Bold |
| 24 | H3 | 32 | Bold |
| 28 | H2 | 36 | Bold |
| 32 | H1 | 36 (×1.1) | Bold |
| 40 / 48 | Display | 44 / 52 (×1.1, or 1.0) | Bold / ExtraBold |

Line heights are **(derived)** from the book's formula:

- **Body text:** size × 1.6, rounded so that an even size gets an even line height and an odd size an odd one. The book's example is 12 → 19.2 → 20.
- **Headers:** ×1.3.
- **32 px and up:** ×1.1, or ×1.0.

**Use few styles.** Start with about 5 sizes (for example 32 / 24 / 20 / 16 / 12) and add more only when the hierarchy needs them. Seven or more sizes is too many.

## Letter spacing

- 0 by default.
- −3% on large headings (`letter-spacing: -0.03em`).
- +5% on ALL CAPS and on tiny uppercase labels (`0.05em`).
- Never go to ±10%.

## Color roles

| Role | Rule | Book example |
|---|---|---|
| Primary | Buttons, focused inputs, checkboxes, active nav. Usually the brand color. Blue is the safe default. | `#1EA5FC`, `#3E8EF4` |
| Secondary (optional) | Secondary actions only. | — |
| Success | Green. | `#64BC26` |
| Warning | Orange. | `#FD9900` |
| Error | Red. | `#FE2712` |
| Text | The darkest gray, never pure black. | `#1F1F1F` / `#14191F` |
| Background | The lightest gray or white. | — |
| Tints and shades | Per color, in HSL steps of ±10 Lightness (±5 only when needed). | — |
| Grays | Copy the primary, set Saturation 20 and Lightness 10, then add +10 Lightness per step up to white. Saturation 0 gives neutral grays. | `#3E8EF4` → `#14191F` |

- If the primary is green, orange or red, shift the matching notification hue so the two stay distinct. For example, with primary `#64BC26`, use `#3CD797` for success.
- Don't apply 60-30-10 mechanically. Assign each role by hand.
- Save colors as tokens or styles. Don't create one-off grays.

## Radius

Pick **one** radius and use it everywhere for the same kind of component.

| Radius | Feel |
|---|---|
| 0 | Elegant, formal |
| ~8 | Balanced (the default choice) |
| ~20 | Friendly, playful |

A radius of 0 is rare. Even a slight rounding reads friendlier.

## Shadow

| Variant | Value |
|---|---|
| Book's default to avoid | `0 4 4` at 25%, black |
| Book's soft recipe | `box-shadow: 0 30px 50px rgb(61 75 92 / 0.10)` (`#3D4B5C` is a dark gray from the palette) |

- **More elevation means more Y and more blur.** Keep the levels consistent.
- **Colored elements** (for example a primary button) can take a shadow tinted with their own color.

## Motion

- **Duration:** under 1000 ms. **(convention)** 150–300 ms for micro-feedback, up to about 400 ms for larger transitions.
- **Easing:** ease-out or ease-in-out. Never linear.

## Starter CSS

```css
:root {
  /* spacing (8 pt web) */
  --space-1: 8px; --space-2: 16px; --space-3: 24px; --space-4: 32px;
  --space-5: 40px; --space-6: 48px; --space-8: 64px; --space-10: 80px;

  /* type */
  --font-sans: "Inter", system-ui, sans-serif; /* one sans typeface, 4-5+ weights */
  --text-xs: 12px; --text-sm: 14px; --text-base: 16px; --text-lg: 18px;
  --text-xl: 20px; --text-2xl: 24px; --text-3xl: 28px; --text-4xl: 32px;

  /* color (replace with brand; keep roles) */
  --color-primary: #3E8EF4;
  --color-success: #64BC26;
  --color-warning: #FD9900;
  --color-error:   #FE2712;
  --color-text:    #14191F; /* darkest tinted gray, never #000 */
  --color-bg:      #FFFFFF;

  /* shape and depth */
  --radius: 8px;
  --shadow-soft: 0 30px 50px rgb(61 75 92 / 0.10);

  /* motion */
  --ease: cubic-bezier(0.2, 0, 0, 1); /* ease-out family */
  --dur-fast: 150ms; --dur-base: 250ms;

  /* layout */
  --tap-min: 44px;
  --container: 1120px; /* (derived) 1440 - 2 x 160 margin */
}
```
