# Sessions

One line per merged PR: what shipped, what was deferred, what is next. Append when you merge; never edit history.

| PR | Shipped | Deferred | Next |
|---|---|---|---|
| #16 | v0.9.1 base: solid theme system (named Clean), five skins, skin editor, locker, Java client logic with 192 assertions, Mojang lookup module. Merged with CI red on macOS (cancelled) only. | In-game rendering hooks, launch hand-off, jars for every version, release | #17 |
| #17 | Rebased onto #16. Default / Lunar / Light themes (colours only, tested), 3D skin previews, Mojang-only lookup, tokens in the OS secure store (+ legacy plaintext migration), .mrpack export, `locker_save`, release pipeline (installer, portable zip, jars, SHA256SUMS, attestations, EN/ES notes, updater check), theme-regression CI, Pages PR build + live verification, `scripts/release-check.sh`. | Microsoft sign-in verification (needs Azure app), in-game rendering hooks, signing, real-desktop run | v1.0.0-rc1 release, then the in-game drawing |
| #18 | Teardown of Pandora/Hotwire/XMCL/Prism; redaction on game output, dependency graph, hard-link dedup engine, Quick Play links, re-auth decision, Discord presence payload + IPC (engine); live mod panel and Discord preview (UI, sample data); 3D skin regression check. | **Not built:** live apply, P2P, sandbox, reflinks, in-game hooks, release/tag, site update, client jars. Wiring of engine pieces to the UI. | Merge, then v1.0.0-rc1 (see STATUS.md) |
