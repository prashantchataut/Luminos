# Client UI teardown (session 14): why ours felt bulky, and what we changed

Scope: the **in-game Luminos Client** (quick panel, HUD, HUD editor, title screen). Not the launcher, not the website.
Method: public pages, public documentation, and open-source repositories read with the `rea` workflow (map, trace, note).
**Nothing was decompiled. No closed-source client (Lunar, Badlion) was run or disassembled.** Where I could not verify a claim from
a source, it says so.

**About the attachments.** The brief says screenshots of Lunar, Badlion, OneClient and LiquidGlassMC were attached. No image
reached this session: the only images I could see were Luminos' own captures in `docs/client-shots/`. So nothing below is
"matched to the attached pictures"; the observations are from text sources and from the behaviour described in them.

Skill rules used for this document: ui-ux-pro-max (hierarchy, density), liquid-glass (Core Principles 1-5, Accessibility list),
game-ui-ux ("model screens as a stack", "drive the HUD from events"), taste-skill section 5 (one system, equal edges).

## 1. Lunar Client

| Observed (source) | Verified how | What Luminos does with it |
|---|---|---|
| The HUD guide says to keep it minimal, to leave **spacing** around elements, and to use a **colour hierarchy**: primary mods in your colour, secondary mods in a slightly darker shade ([lunarclient.com/news/the-best-hud-setup-for-lunar-client](https://www.lunarclient.com/news/the-best-hud-setup-for-lunar-client)) | Read the page | `HudModule.primary()`: FPS, CPS, ping, armor and potions use the bright ink, everything else the softer ink. The default preset is *Minimal* (those five only). Default positions are stacked with a 2 px gap and a 4 px screen margin |
| Every HUD mod has a background you can recolour or remove, with horizontal and vertical padding sliders (Lunar WAILA guide) | Read the page | Neutral smoked-glass plate (no colour), per-module "Glass plate" switch in the popover |
| Mods are searched, enabled and configured from one menu; each mod has its own settings; profiles hold a full setup (MacMyths and TechYorker guides, third-party) | Third-party guides, not Lunar's own docs | Same shape: search first, per-module popover, profiles tab |
| The menu is opened with **Right Shift** (guides) | Third-party guides | Luminos keeps Right Ctrl = panel and Right Shift = panel with search, the Wurst split, rebindable |
| "Opens from the logo, not a keybind" (brief) | **Not verified**: no source I could read says this | Not copied. The panel opens from the in-game key and from the title-screen "Cosmetics" entry |
| Keystrokes: LMB/RMB CPS, space bar, fade delay, box size, colours (Lunar keystrokes guide) | Read the page | Keystrokes use neutral glass keys that fade between idle and pressed (`Anim.soft`), optional mouse row with CPS and space bar |

## 2. Badlion

| Observed | Verified how | Use |
|---|---|---|
| The redesign users liked was "cleaner and easier to use" with **reorganised tabs**, not more features | Taken from the brief. **I did not find a primary source to confirm the quote** | Tabs went from 9 text labels to 8 icon-only rail buttons with tooltips; Screenshot folded away |
| Pen-icon GUI editor; per-mod settings panel | From the brief; not run | `HudEditor`: glass toolbar (Done, Snap, Preset, Reset), coordinate chip while dragging, hover outline; per-module settings are the popover |

## 3. OneClient / Polyfrost

Already studied from source in `docs/research/ONECLIENT_TEARDOWN.md` (OneLauncher @ `aa91833`, GPL-3.0: patterns and numbers only,
no code). Relevant to the *client* UI:

- One config surface per mod, with state siblings (`-hover / -pressed / -disabled`) for every colour. Luminos: `Glass.card(hot)`
  gives rest and hover; disabled rows lose the switch and show the reason in the row (no hidden greyed-out rows).
- Short ease-out motion, no bounce on utility surfaces (160-250 ms). Luminos uses one spring (stiffness 300, damping 26, one soft
  overshoot, about 300 ms) for the panel open, switches, scroll and press fades, and **snaps** when "Reduce motion" is on.
- PolyPlus' title screen (Quickplay, 3D player preview, account switcher): **not studied** (closed, no public description found).
  Luminos' title screen has no Quickplay and no player preview. Not built.

## 4. LiquidGlass-style mods (in-game glass)

| Project | What I read | Takeaway |
|---|---|---|
| LiquidGlass API (cusa3/LiquidGlass-26.3-api) | README | Real blur comes from Minecraft's **own blur pass**; "if your screen already blurs the background (vanilla extractBackground), LiquidGlass detects it". Radii are precomputed in separable gaussian passes; panels are SDF rounded rects; tint, shadow, rim light are separate knobs |
| ReGlass (DznDani/ReGlass), LiquidGlassGUI releases | README / release notes | Optional refraction and chromatic dispersion; a release note says the default blur was **increased "for a less transparent look"**, i.e. users find clear glass unreadable |
| BossReng's UI Mod (Modrinth) | Page | Blur, tint, highlight, fresnel and shadow are all exposed as config sliders |
| LiquidGlassMC (okil6), WasterVisual, Kirri's UI | LiquidGlassMC only appears as a CurseForge listing. **No readable information on WasterVisual or Kirri's UI was found** | Not studied; no claim made |

**How Luminos keeps text readable on a moving world** (the open question in the brief):
1. Use Minecraft's own blur (`GuiGraphics.blurBeforeThisStratum`, borrowed while the panel is open and restored on close), so
   there is no extra shader and no mixin.
2. A full-screen **scrim** (alpha 0.34-0.50, darker when the glass is clearer) sits between the blurred world and the panel.
3. The panel surface itself is a white tint of alpha **0.08-0.18**, hairline border, 1 px inset top highlight.
4. Text is 11/13 px-class ink (`#F2F4F8`, `#B9C0CC`) on that. Measured contrast is in `docs/client-shots/README.md`.
5. Escape hatches: *Glass intensity* 0-100 % (0 turns the blur pass off entirely), *Solid panels*, and an OS check for reduced
   transparency (Windows `EnableTransparency`, macOS `reduceTransparency`; Linux has no single switch). *Reduce motion* snaps springs.
Not done: refraction, dispersion, per-region blur (vanilla blur is full-screen), light theme.

## 5. Wurst / Meteor (UI only)

Right Ctrl ClickGUI (Wurst), Right Shift GUI (Meteor), searchable module list, compact rows, right-click on a module. Luminos takes
the *interaction* (search first, compact rows, right-click for settings) and none of the modules. Compliance mode stays on: fullbright,
zoom, target HUD, coordinates and waypoints switch off on listed servers, with a one-line reason in the row.

## 6. What made ours feel bulky (the old panel, measured from `Panel.java` and the session-13 captures)

| Problem | Old value | New value |
|---|---|---|
| Row height | cards 32 px tall + 6 px gap, 2 columns, 4 rows per page, **8 modules visible** | rows 22 px + 3 px gap, 1 column, about 9 visible, wheel scroll with spring |
| Type | one size (vanilla 8 px) for titles, subtitles and badges; equal weight everywhere | 4 sizes: label 0.75, body 1.0, section 1.0 uppercase dim, panel title 1.5 |
| Truncation | "Module backgrou...", "Layout prof...", "Import layout ..." because two columns at 160 px | one column of 280 px; descriptions are one line at label size |
| No icons | text only, text tabs | 8x8 voxel icon on every row and tab (`Icons.java`) |
| Equal visual weight | every card the same blue fill, same blue border, ON/OFF as coloured text blocks | neutral glass; one accent only on switches, focus ring and the active tab bar |
| Opaque | fill `0xF2070B22` (95 % opaque navy) and an additional dark scrim | glass: tint alpha 0.08-0.18 over real blur; solid is a setting, not the default |
| Search | a field in the header, not focused, typing a letter focused it | focused on open, caret blinking, `x` to clear |
| Settings inline | none per module; only enable/disable and a text context menu (Hide, Smaller, Bigger, Move up...) | right-click popover with sliders and switches per module, favourite star, reset |
| No grouping | one flat list of every module, paged "1 / 3" | HUD, PvP, Visuals, Utility, Performance sections with `on/total` counts; only HUD open; favourites pinned above |
| HUD itself | blue stripe plates, blue keystrokes, text potions ("Speed II  1:42") | neutral smoked glass, neutral keys, potion **icons** with level badge and a small timer |
| Layout | all 15 modules on by default | Minimal preset by default (5), Competitive and Full one click away |

## 7. Decisions that follow

1. Material = vanilla blur + scrim + 0.08-0.18 white tint + hairline + top highlight; solid fallback; intensity slider.
2. Density = 22 px rows, one line each, icons, no pagination.
3. Hierarchy = bright ink for primary, softer ink for secondary; one accent.
4. Settings live in a popover, never inline.
5. Be honest about what is not built (freecam, freelook, chat tabs, replay, per-region blur): see `docs/PERF.md` and the PR table.
