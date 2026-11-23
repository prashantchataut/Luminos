# Contributing

Rules live in [CONVENTIONS.md](./CONVENTIONS.md). Agent entrypoint: [AGENTS.md](./AGENTS.md).

## Before you start

1. Read CONVENTIONS.md.
2. Branch from an up-to-date `main`: `fix/...`, `feat/...`, `docs/...`.
3. Need bash, jq, and Node 22 (`npx`). The `claude` CLI is optional, for `claude plugin validate`.

## What to contribute

| Welcome | Needs an issue first |
|---------|----------------------|
| Corrections that cite a live official Rust page | Changing MUST/NEVER policy |
| Shorter, clearer wording | Splitting the skill into several skills |
| New eval scenarios in `evals/evals.json` | Replacing the official logo |
| Agent-specific install notes that stay out of the skill body | Non-English content |

When official docs change, update the link and the quoted rule together. Do not leave a paraphrase that no longer matches the page.

## Verify

```bash
bash .github/scripts/validate-skill.sh
npx -y skills@latest add . -l
```

## Pull request

- One topic per PR.
- English: what changed, and the official URL of every new language or API claim.
- CI must be green.

## License

Contributions are licensed under the repository [MIT license](./LICENSE). The Rust logo remains CC BY 4.0; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
