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
