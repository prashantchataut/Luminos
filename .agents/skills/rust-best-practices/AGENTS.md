# Agents: rust-best-practices skill

Entrypoint for agentic tooling working on this repository.

## Read these first (mandatory)

| Doc | Why |
|-----|-----|
| [CONVENTIONS.md](./CONVENTIONS.md) | Skill format, sources, prose, git, versioning, validation |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Change workflow |
| [skills/rust-best-practices/SKILL.md](./skills/rust-best-practices/SKILL.md) | The skill itself |
| [CHANGELOG.md](./CHANGELOG.md) | Release history |

Follow **CONVENTIONS.md** for every change. This file is a short checklist only.

## Language policy

- Markdown, manifests, commits: English only.

## Non-negotiables

1. Official Rust rules are cited by live URL (`C-*` ids, Style Guide, Clippy, Cargo). Nothing invented from memory.
2. `SKILL.md` stays under 500 lines with a single-line, double-quoted description.
3. The skill name and the plugin name never change.
4. Bump `version` in `.claude-plugin/plugin.json` and `SKILL.md` together on every user-visible change.
5. No em dash, no filler, no co-author trailers.
6. The skill body is one fused standard. Do not narrate source-merge history inside `SKILL.md` or `references/`.

## Commands

```bash
bash .github/scripts/validate-skill.sh
npx -y skills@latest add . -l
```
