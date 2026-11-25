# START HERE (session 19)
Read `STATUS.md` first. This PR (#18) now has the live panel on real data, the in-game agent, Tauri wiring, real store, reflink dedup, sharing, P2P client and the Discord runner, **but the release, the pipeline run and the site update were not done**.

Next, in order: (1) check the `rust (windows-latest)` and `rust (ubuntu-latest)` jobs on the PR and fix the first red one; (2) run `scripts/release-check.sh --ci`; (3) merge #18; (4) tag `v1.0.0-rc1` from merged main and watch `release.yml`; (5) deploy the site with the session-19 captures; (6) owner: revoke the pasted PAT, register the Discord app (`docs/DISCORD.md`), deploy `p2p-signal/`, decide the radius contract (`docs/design/AUDIT.md`).
