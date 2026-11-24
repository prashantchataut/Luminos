# Skill notes, v0.9.1

Skills opened this session (read, then used): **taste-skill** (checklist ids in brackets), **ui-ux-pro-max** (`color-dark-mode`, `error-clarity`), **uihall** (palette-to-token and contrast approach), **reanimate** / emil-kowalski animate (motion vocabulary: ease-out-expo enter, overshoot on equip), **game-ui-design**, **minecraft-pixel-art** (UV layout for the skins), **visual-design-foundations** (type scale, iconography: one 24 px / 1.6 stroke family), **ux-copy** (labels are nouns, buttons are verbs), **accessibility-review** (contrast table, focus rings, names on controls). `rea` is a reverse-engineering skill; it was not applicable to UI work and was not run.

Before each screen, the rule line; after each screen, the anti-slop check (taste-skill section 5). "Pass" means checked by me in the render or the code; no tool scored it.

| Screen | Rules applied | Anti-slop check |
|---|---|---|
| Theme tokens, shell | [grounds] flat grounds, [button-styles], [card-family], [heading-scale], [text-contrast]; ui-ux-pro-max `color-dark-mode` (tokens not inverted copies); uihall token export | Pass. One fill and one border per panel, no shadow, blur, gradient or texture. `tools/contrast.test.mjs`: Clean 5.89:1, Lunar 6.93:1, Light 5.98:1 minimum text ratio. The serif display face and italic accent word were removed |
| Skins | [card-family], [hover], [a11y-name], [focus-visible], [reduced-motion]; game-ui-design (preview is the hero); minecraft-pixel-art (UV table) | Pass. Every icon button has an aria-label. Errors are plain sentences under the control (`error-clarity`) |
| Skin editor | [a11y-name], [nesting] (one modal, panels two deep at most); ux-copy | Pass. Tools are icon buttons with names and titles; undo and redo on Ctrl+Z / Ctrl+Shift+Z |
| Locker | [card-family], [hover], [motion-layer], [reduced-motion]; reanimate (overshoot-in, ease-out-out); visual-design-foundations (one icon family) | Pass, with one open item: the Back camera orientation was judged by eye only |
| Copy | ux-copy; taste [copy-slop-word], [copy-buttons] | `grep -E "seamless|elevate|experience|next-gen|powered by|built for|AI"` over `app/src` is clean (a sample-data string was reworded) |

Slop found and removed: the glass system, the Bayer-dithered sky and cover art, the translucent "liquid" highlights, the serif italic accent word, blue-tinted greys that moved with the accent.
