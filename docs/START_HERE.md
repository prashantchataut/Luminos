# START HERE (session 18)

Read `STATUS.md` first: it is the honest list of what runs and what does not. #17 is merged (its 3D preview concern was not reproducible; see STATUS). `docs/SESSIONS.md` has one line per PR.

Next, in order: merge session 18, wire the engine pieces (redaction is wired; dedup, deps, quick play, re-auth, presence are not) through Tauri commands, build the in-game agent, then cut v1.0.0-rc1 from merged main and run `release.yml` for the first time. Security: the owner pasted a GitHub PAT in chat in two sessions. Revoke it.
