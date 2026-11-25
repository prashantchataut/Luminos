# Render, critique, fix: 3 rounds per screen (1280x800 @2x, Playwright + SwiftShader)
Every capture passes the no-blank gate in `app/tools/rounds.mjs` (luminance sd >= 6 and >= 24 colour buckets). Files: `<screen>-<round>.png` in this folder. Screens: home, mods, hud-studio, cosmetics, themes, instances-accounts (+ extras home-host, mods-drawer). Critiques were written from looking at contact sheets (scaled down), so sub-pixel issues are not covered.

## home
- R1: Structure matches Image 2 (hero, resume strip, right rail). Gap below the strip; the bottom third looks unfinished.
- R2: Strip cards stretched to fill the space, cover images became huge and cropped badly. Worse.
- R3: Card image fixed at 116px, hero 52%. Calm and balanced. Remaining flaw: empty night sky on the hero's right half; the PvP/Survival toggle is small.
- Rules: better-layout (grouping, one primary action), better-ui (concentric 16/12 radii), better-motion (launch bar morph only animates width/colour), accessibility (live region on the launch label).
## mods
- R1: 4 columns, solid bars. Disabled bars are low contrast against the card (intended, matches Image 3). Drawer overlaps the last column without a scrim.
- R2/R3: unchanged structurally; the drawer keeps focus order and Escape closes it. Flaw left: no scrim behind the drawer, no enter animation under reduced motion.
- Rules: audit-ai-design-slop (no icon-heading-text tiles), better-ui (exact 12px radius, 36px bar), interaction-design (toggle on bar, settings on body/right-click).
## hud-studio
- R1: Canvas floated in the middle with dead bands above and below.
- R2: Moved to a column with a widget row under it. The canvas is still only ~0.55 scale because 1280px minus sidebar and 320px inspector leaves 708px. Honest limit of the window size.
- R3: Stack is on one left edge with 5px gaps; selection chrome, size pill and toolbar are present. Flaw: mini-toolbar is tiny at this scale.
- Rules: interaction-design (snap guides, drag feedback), accessibility (widgets are focusable buttons with size in the label).
## cosmetics
- R1: Pill bar overflowed; "Back items" and "Emotes" clipped and the Classic toggle collided with them.
- R2: Counts moved to tooltips, toggle shortened to "Classic mode". All nine pills fit.
- R3: Same. The white slab beside the figure is the default Cube pet (real locker state), not a bug. Flaw: the top toolbar of the locker is crowded at this width.
- Rules: better-layout (no second sidebar), better-ui (card bar = accent when equipped).
## themes
- R1: Preview ring clipped under the header.
- R2/R3: Padding added; four miniature layouts render in their own palettes, selected card has the 2px accent ring plus a soft halo. Flaw: lower half of the screen is empty (matches Image 7 but still empty).
## instances-accounts
- R1: Account modal printed its title twice.
- R2/R3: Fixed. Ely.by tab shows the exact `-javaagent` argument and says plainly that browser sign-in is not wired. Flaw: the profile JSON panel behind it is cut off at the modal edge (dimmed).
