# CONVENTIONS: rust-best-practices skill

Rules for this repository. When another document disagrees, this file wins.

Related: [AGENTS.md](./AGENTS.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [skills/rust-best-practices/SKILL.md](./skills/rust-best-practices/SKILL.md), [CHANGELOG.md](./CHANGELOG.md), [LICENSE](./LICENSE).

---

## 1. Language

- Everything in this repository is English: Markdown, manifests, commit messages, PR titles.
- Product names keep official spelling (`Rust`, `Cargo`, `Clippy`, `rustfmt`, `rustdoc`).

---

## 2. Skill format

The skill follows the [Agent Skills specification](https://agentskills.io/specification) and the discovery rules of the [skills CLI](https://github.com/vercel-labs/skills).

| Rule | Value |
|------|-------|
| Skill directory | `skills/rust-best-practices/` (the directory name equals the frontmatter `name`) |
| `name` | `rust-best-practices`: lowercase letters, digits, single hyphens, 64 chars max; never changes |
| `description` | One line, double-quoted, 1 to 1024 chars, says what the skill does and when to use it, ends with a `Triggers:` list; never summarises the workflow |
| Body | Under 500 lines; rules as short `MUST / SHOULD / NEVER` bullets; tables for decisions |
| References | One level deep in `references/`, linked with relative paths from `SKILL.md` |
| Executable code | None inside the skill. Repository tooling is bash under `.github/scripts/` |
| Plugin manifests | `.claude-plugin/plugin.json` (name, version, description, author, license, keywords) and `.claude-plugin/marketplace.json` with a single entry `source: "./"` and no `version` field |

---

## 3. Sources

- Language, naming, formatting, and public API shape: live official Rust docs listed in `references/official.md`. Quote `C-*` ids and link the page.
- Allocation, bounds, `debug_assert!`, heapless cores, determinism, and CI: the fused rules in `references/`.
- A fact without a source is a bug. Do not invent lint names, rustdoc sections, or std APIs.
- `SKILL.md` and `references/` state the fused policy only. Do not discuss how sources were merged.

---

## 4. Prose

- No em dash (U+2014). Use commas, colons, or periods.
- No filler: "seamless", "robust", "leverage", "not only... but also", "it's important to note".
- Terse. Tables for decisions, numbered steps for procedures, one idea per bullet.
- Code blocks are runnable as written. Paths in `SKILL.md` are relative to the skill directory.

---

## 5. File naming

- Markdown files: `kebab-case.md`. Root policy docs: `UPPERCASE.md`.
- Official logo files stay unmodified in `assets/` (`rust-logo.svg`, `rust-logo-white-outline.svg`).
- Social preview: `assets/og.html` is the source; `assets/og.png` is 1280x640, rendered with the command in the `og.html` comment. Do not invent a second logo.

---

## 6. Git and changelog

- Commits: `type: summary`, lowercase, imperative, subject only. No body, no trailers, never `Co-Authored-By` or any LLM attribution. Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `ci`, `test`.
- One logical change per commit.
- `CHANGELOG.md` follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) with `### Added`, `### Changed`, `### Removed`, `### Fixed`. Work accumulates under `## [Unreleased]`, one short past-simple line per commit, until a release moves it under a version heading.
- No force-push to `main`. No secrets in the repository.

---

## 7. Versioning

- SemVer. The version lives in `.claude-plugin/plugin.json` and in `metadata.version` of `SKILL.md`; both change together. The marketplace entry carries no version so `plugin.json` wins.
- Bump on every user-visible change: patch for wording, minor for new sections or references, major for a changed policy.

---

## 8. Validation checklist

Run before every commit that touches the skill:

```bash
bash .github/scripts/validate-skill.sh
npx -y skills@latest add . -l
```

Expected: the validator prints `OK`, the skills CLI lists exactly one skill (`rust-best-practices`). CI runs the first command and discovery on every push.

---

## 9. Safety

- The skill never instructs destructive operations (`git reset --hard`, `rm -rf`, database wipes).
- `sudo` does not appear.
- The skill does not collect or send data; the skills CLI telemetry is the user's choice.

---

## 10. Logo

- Use only the unmodified official files from [rust-lang/rust-artwork](https://github.com/rust-lang/rust-artwork) (`logo/rust-logo.svg`, `logo/rust-logo-white-outline.svg`).
- Link the mark to <https://www.rust-lang.org/>. Credit CC BY 4.0 and the [trademark policy](https://rustfoundation.org/policy/rust-trademark-policy/).
- Do not imply affiliation or endorsement. Do not recolor, rotate, or combine the gear with other marks.
