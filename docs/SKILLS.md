# Skills & MCP for agents working on Luminos

Sources actually consulted (live search, session 2): skills.sh leaderboard coverage, skills.lc, skillsllm.com, developertoolkit.ai and uiarchives.com roundups. Install with the `skills` CLI (`npx skills add <repo> --skill <name>`).

| Job | Skill | Install | Use it for |
|---|---|---|---|
| Creates | **frontend-design** (Anthropic) | `npx skills add anthropics/skills --skill frontend-design` | Pick a bold direction *before* writing markup — keeps the blue/dither identity from drifting into a template |
| Creates | **design-taste-frontend** (Leonxlnx/taste-skill) | `npx skills add https://github.com/leonxlnx/taste-skill --skill design-taste-frontend` | Marketing site: anti-slop bans, spacing/type/motion constraints |
| Creates | **ui-ux-pro-max** (nextlevelbuilder) | `npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max` | Palette, type pairing and UX-rule lookup; persists a design system |
| Reviews | **web-design-guidelines** (vercel-labs/agent-skills) | `npx skills add vercel-labs/agent-skills --skill web-design-guidelines` | Pre-ship accessibility/UX audit of `src/` |
| Reviews | **vercel-react-best-practices** | same repo | Next.js performance of the site |
| Polish | **impeccable** (pbakaus) | `npx skills add https://github.com/pbakaus/impeccable --skill impeccable` | Last 10 %: spacing, contrast, detector rules |
| Rust | **rust-skills / rust-best-practices** (179-rule sets on skills.sh / skillsllm) | search "rust" on skills.sh | Ownership, errors, async, perf, clippy — apply with the rules in `AGENTS.md` |
| Directories | skills.sh · skills.lc · skillsllm.com · open-design.ai/skills | — | Look here first for new skills |

## Rules
1. Use **one creator + one reviewer** skill per task; overlapping ones fight each other.
2. Skills do not replace looking: render (`luminos-shots`) and view the PNGs.
3. egui is immediate-mode Rust — translate web-design advice into theme tokens (`theme.rs`), not CSS.
4. Verify any skill-suggested dependency against the "stay light" rule.

## MCP
No MCP servers were available in the sandbox this session. Recommended when you run agents locally: **GitHub MCP** (PRs/issues), **Playwright MCP** (screenshot the Pages site), **Figma/shadcn MCP** if you ever design in those, **Context7** (library docs for eframe/egui, Fabric).

---

## Session 5: skills actually fetched and applied

Verified to exist (GitHub API 200, all MIT): the install tooling (`npx skills`, `uipro`) was **not** run, because the sandbox
has no agent runtime. The skills' READMEs/rules were read and applied by hand. Say so honestly, do not claim "installed".

| Skill | URL | Used for |
|---|---|---|
| taste-skill (Leonxlnx) | github.com/Leonxlnx/taste-skill | Anti-slop rules: plain copy, one serif + one sans, one accent word, real product UI instead of mock cards, one idea per section, check in a real browser at several widths. Its 1440/1024/768/390 browser check is why the site was screenshotted at 1440 and 390. |
| ui-ux-pro-max | github.com/nextlevelbuilder/ui-ux-pro-max-skill | Pre-delivery checklist: 4.5:1 text contrast, visible focus, `prefers-reduced-motion`, status never by colour alone (every badge has a word), no layout shift. Caught the unreadable release line over light clouds. |
| reanimate (NiazMorshed2007) | github.com/NiazMorshed2007/reanimate | Motion spec per element: duration, easing, stagger. Hero rise = 1.2 s expo-out, 110 ms stagger; tour crossfade 700 ms; transform/opacity/blur only. |
| REA (Reverse Engineer Anything) | github.com/smartworldarafath/REA_Skill and idrisawad/REA-Opencode | Found, **not applied** yet; needed for the launcher teardowns (see docs/research/README.md). |
| UiHall | github.com/NikitHamal/UiHall | Found (design reference corpus + agent skill), not applied. |
| Rust skills | candidates: spdrman/agent-skills, iamfourh2e/rust-skill | Found, **not applied**: no Rust toolchain in this session's sandbox. |

Not searched: skills.sh, skill-issue.in, open-design.ai catalog.

## Tricks that worked in the sandbox (reuse them)
- **No browser?** `npx playwright install chromium-headless-shell`, then download the missing `.so` files straight from
  `deb.debian.org` (parse `Packages.xz` for `Filename:`), `dpkg -x` them to a folder, set `LD_LIBRARY_PATH`. No root needed.
- **Check the dither without a browser:** `src/lib/skyCore.ts` is a pure function. Bundle it with esbuild, write a PPM, view as PNG.
