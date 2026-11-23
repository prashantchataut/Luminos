<p align="center">
  <a href="https://www.rust-lang.org/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/rust-logo-white-outline.svg">
      <img src="assets/rust-logo.svg" alt="Official Rust programming language logo" width="120">
    </picture>
  </a>
</p>

<h1 align="center">Rust Best Practices Skill</h1>

<p align="center">
  <strong>Write and review production Rust against official docs and this engineering standard</strong><br />
  An <a href="https://agentskills.io">Agent Skill</a> for Claude Code, Codex, Cursor, Grok and compatible agents
</p>

<p align="center">
  <a href="https://skills.sh/massimodeluisa/rust-best-practices-skill"><img src="https://skills.sh/b/massimodeluisa/rust-best-practices-skill" alt="skills.sh" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" /></a>
  <a href="https://agentskills.io"><img src="https://img.shields.io/badge/Format-Agent_Skills-orange?style=flat-square" alt="Agent Skills format" /></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-official_docs-dea584?style=flat-square&logo=rust&logoColor=white" alt="Rust" /></a>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#repository-structure">Structure</a> ·
  <a href="#acknowledgments">Acknowledgments</a>
</p>

<p align="center">
  <img src="assets/og.png" alt="Rust Best Practices skill: write and review production Rust" width="800" />
</p>

---

## What it does

An agent writing or reviewing Rust loads this skill and applies one standard: official [API Guidelines](https://rust-lang.github.io/api-guidelines/) and [Style Guide](https://doc.rust-lang.org/stable/style-guide/) for language and public APIs, plus allocation contracts, ownership, `Result` vs panic, `debug_assert!`, Clippy, tests, rustdoc, unsafe, and Cargo CI for production crates.

`/rust-best-practices <path>` reviews a crate or file. Each finding quotes the line, names the rule (including official `C-*` ids), and gives the fix.

The logo above is the official Rust gear, linked to [rust-lang.org](https://www.rust-lang.org/). This project is not affiliated with or endorsed by the Rust Project or the Rust Foundation.

## Install

With the [skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add massimodeluisa/rust-best-practices-skill
```

Add `-g` for a user-level install, `-a claude-code` (or another agent) to target one agent.

As a Claude Code plugin:

```bash
claude plugin marketplace add massimodeluisa/rust-best-practices-skill
claude plugin install rust-best-practices@rust-best-practices-skill
```

Manual: copy `skills/rust-best-practices` into `~/.claude/skills/` (or your agent's skills directory) and restart the agent.

## Usage

- `/rust-best-practices` applies the standard to the current Rust work.
- `/rust-best-practices crates/project-core` reviews that path.

Example prompts:

```text
Review this parser for allocation on the hot path
Replace unwrap in this library with typed errors
Add Clippy and rustfmt to CI
Is this debug_assert validating caller input?
Design a heapless parse API with a caller-owned buffer
```

## How it works

`SKILL.md` is the router: authority, always-on rules, which reference to load. Details live one level down in `references/`, loaded only when the task needs them.

Official pages are cited, not copied. Agents should fetch the live Style Guide, API Guidelines checklist, Clippy config, and Cargo profile docs rather than invent lint names or APIs.

## Repository structure

```text
rust-best-practices-skill/
├── .claude-plugin/              plugin.json, marketplace.json
├── .github/                     validate workflow
├── assets/                      official Rust logo (CC-BY, unmodified) and social preview
├── skills/rust-best-practices/
│   ├── SKILL.md                 router and always-on rules
│   ├── evals/                   review and API scenarios
│   └── references/              official, allocation, ownership, errors,
│                                design, unsafe, performance, quality, review
├── AGENTS.md · CONVENTIONS.md · CONTRIBUTING.md · CHANGELOG.md
└── LICENSE
```

## Acknowledgments

The [Rust](https://www.rust-lang.org/) programming language, [API Guidelines](https://rust-lang.github.io/api-guidelines/), and [Style Guide](https://doc.rust-lang.org/stable/style-guide/) are produced by the Rust project. The gear logo in `assets/` is the official Rust logo from [rust-lang/rust-artwork](https://github.com/rust-lang/rust-artwork), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Rust and the Rust logo are trademarks of the [Rust Foundation](https://rustfoundation.org/policy/rust-trademark-policy/). This skill is an independent project and is not affiliated with or endorsed by the Rust Project or the Rust Foundation. Full notices: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Author

<p>
  <a href="https://x.com/massimodeluisa"><img src="https://img.shields.io/badge/@massimodeluisa-000000?style=flat-square&logo=x" alt="X" /></a>
  <a href="https://github.com/massimodeluisa"><img src="https://img.shields.io/badge/GitHub-massimodeluisa-181717?style=flat-square&logo=github" alt="GitHub" /></a>
</p>

Massimo De Luisa: [massimo.deluisa.bio](https://massimo.deluisa.bio)

## License

MIT, see [LICENSE](LICENSE). The Rust logo remains CC BY 4.0.
