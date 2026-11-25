# Sessions

One line per merged PR: what shipped, what was deferred, what is next. Append when you merge; never edit history.

| PR | Shipped | Deferred | Next |
|---|---|---|---|
| #16 | v0.9.1 base: solid theme system (named Clean), five skins, skin editor, locker, Java client logic with 192 assertions, Mojang lookup module. Merged with CI red on macOS (cancelled) only. | In-game rendering hooks, launch hand-off, jars for every version, release | #17 |
| #17 | Rebased onto #16. Default / Lunar / Light themes (colours only, tested), 3D skin previews, Mojang-only lookup, tokens in the OS secure store (+ legacy plaintext migration), .mrpack export, `locker_save`, release pipeline (installer, portable zip, jars, SHA256SUMS, attestations, EN/ES notes, updater check), theme-regression CI, Pages PR build + live verification, `scripts/release-check.sh`. | Microsoft sign-in verification (needs Azure app), in-game rendering hooks, signing, real-desktop run | v1.0.0-rc1 release, then the in-game drawing |
