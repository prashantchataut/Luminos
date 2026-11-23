# ui-design: an agent skill for building good-looking, usable UIs

This is a skill for Claude Code (or any agent that reads `SKILL.md` skills). It gives the agent the design rules a good UI designer follows when it builds or reviews a screen. It works for web or mobile and for any kind of app.

**What it covers:** spacing and grids, type scale, color palettes, contrast, shadows, buttons, forms, cards, icons, navigation, imagery, microcopy, motion, accessibility, and empty, loading, error and 404 states.

## How it works

- **`SKILL.md` stays short,** so the agent always reads it. It holds the 15 non-negotiable rules, a quick path and an index of the reference files.
- **`references/` has one file per topic.** The agent reads only the ones its task touches: `forms.md` for a form, `navigation.md` for a tab bar, and so on.
- **`references/checklist.md`** is a pre-ship checklist for reviewing a finished screen, ideally from a screenshot.
- **The project's own design system wins.** If the repo already has tokens (a Tailwind config, CSS variables, a shadcn or MUI theme), the agent uses them. The skill only fills the gaps and reports any conflict instead of silently overriding.
- **Projects with no design system yet** get starter tokens in `references/tokens.md`: spacing, type scale, color roles, radius, shadow and motion, plus a ready-to-paste CSS block.

## Install (Claude Code)

For all your projects:

```bash
git clone https://github.com/JuanEliasJabib02/ui-design-skill ~/.claude/skills/ui-design
```

For one project only:

```bash
git clone https://github.com/JuanEliasJabib02/ui-design-skill .claude/skills/ui-design
```

Claude loads it on its own when a task involves UI. You can also ask for it by name: "use the ui-design skill".

**Update:** `git -C ~/.claude/skills/ui-design pull`

**Other agents:** point them at `SKILL.md` (for example from your `AGENTS.md`) and tell them to read the reference files it lists.

## Source and credit

These are unofficial notes distilled from the book **UI Design Principles** by **Michael Filipiuk** (2021 edition). All credit for the ideas goes to him. If you find this useful, buy the book: it has the visual examples that rules alone can't show.

Values tagged **(WCAG)**, **(convention)** or **(derived)** are not from the book. They are, respectively, accessibility standards, common industry values, and values computed with the book's own method.

## License

[MIT](LICENSE). Use it, fork it, change it.
