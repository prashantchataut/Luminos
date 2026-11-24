#!/usr/bin/env python3
"""Worst-case WCAG contrast of text on the launcher's glass panels. Writes docs/design/CONTRAST.md. Run: python3 tools/contrast.py"""
import re, os
css = open(os.path.join(os.path.dirname(__file__), "..", "app", "src", "index.css")).read()
hx = lambda n: tuple(int(re.search(rf"--color-{n}: #([0-9a-f]{{6}})", css).group(1)[i:i + 2], 16) for i in (0, 2, 4))
lin = lambda c: (c / 255) / 12.92 if c / 255 <= .03928 else (((c / 255) + .055) / 1.055) ** 2.4
L = lambda r: .2126 * lin(r[0]) + .7152 * lin(r[1]) + .0722 * lin(r[2])
over = lambda t, a, b: tuple(t[i] * a + b[i] * (1 - a) for i in range(3))
def cr(a, b):
    la, lb = L(a), L(b); return (max(la, lb) + .05) / (min(la, lb) + .05)
fg, mute, sky, scrim = hx("fg"), hx("mute"), (59, 108, 240), (2, 4, 13)
rows = [(n, cr(fg, bg), cr(mute, bg)) for n, bg in [(f"glass {p}% (tint {a})", over((160, 190, 255), a, over(scrim, .5, sky))) for p, a in ((100, .18), (60, .14), (0, .08))] + [("solid panels (0.94 navy)", over((12, 20, 48), .94, sky))]]
t = "\n".join(f"| {n} | {a:.1f}:1 | {b:.1f}:1 | {'pass' if a >= 4.5 and b >= 4.5 else 'FAIL'} |" for n, a, b in rows)
open(os.path.join(os.path.dirname(__file__), "..", "docs", "design", "CONTRAST.md"), "w").write(f"""# Contrast, worst case (computed by tools/contrast.py)

Method: the brightest large region of the dithered sky is `#3b6cf0`; the app puts a `rgba(2,4,13,.5)` scrim over it; a glass panel adds `rgba(160,190,255,a)` on top. Text colours are read from `app/src/index.css` (`--color-fg`, `--color-mute`). WCAG 2.x relative luminance. Blur only softens extremes, so the un-blurred composite is the pessimistic case.

| surface | fg text | muted text | verdict (>= 4.5:1) |
|---|---|---|---|
{t}

History: the first run failed (muted text 4.2:1 at 100% intensity with `#b4c0e0`); `--color-mute` was lightened to `#c6d0ea` and this table is the re-run.

`prefers-reduced-transparency`, `prefers-contrast: more`, the Solid panels switch and an `@supports not (backdrop-filter)` fallback all collapse `.glass` to a translucent navy solid (`app/src/index.css`). Not tested against a real Windows/macOS reduced-transparency setting (UNVERIFIED); the Solid path was exercised by the switch in the render.
""")
print(t)
