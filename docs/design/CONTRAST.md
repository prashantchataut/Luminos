# Contrast, worst case (computed by tools/contrast.py)

Method: the brightest large region of the dithered sky is `#3b6cf0`; the app puts a `rgba(2,4,13,.5)` scrim over it; a glass panel adds `rgba(160,190,255,a)` on top. Text colours are read from `app/src/index.css` (`--color-fg`, `--color-mute`). WCAG 2.x relative luminance. Blur only softens extremes, so the un-blurred composite is the pessimistic case.

| surface | fg text | muted text | verdict (>= 4.5:1) |
|---|---|---|---|
| glass 100% (tint 0.18) | 6.9:1 | 5.0:1 | pass |
| glass 60% (tint 0.14) | 7.5:1 | 5.4:1 | pass |
| glass 0% (tint 0.08) | 8.4:1 | 6.0:1 | pass |
| solid panels (0.94 navy) | 15.4:1 | 11.1:1 | pass |

History: the first run failed (muted text 4.2:1 at 100% intensity with `#b4c0e0`); `--color-mute` was lightened to `#c6d0ea` and this table is the re-run.

`prefers-reduced-transparency`, `prefers-contrast: more`, the Solid panels switch and an `@supports not (backdrop-filter)` fallback all collapse `.glass` to a translucent navy solid (`app/src/index.css`). Not tested against a real Windows/macOS reduced-transparency setting (UNVERIFIED); the Solid path was exercised by the switch in the render.
