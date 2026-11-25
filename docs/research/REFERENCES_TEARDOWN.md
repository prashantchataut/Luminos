# Reference teardown: Pandora, Hotwire, XMCL, Prism

Session 18. Method and limits are stated per reference so nobody reads more into this than was done.

| Reference | Licence | What I actually read | What I did NOT do |
|---|---|---|---|
| Pandora Launcher | MIT | Cloned `Moulberry/PandoraLauncher` (shallow). Read `README.md`, `crates/backend/src/{duplicate,fs,syncing,shortcut,quickplay_presets,launch/mod}.rs` and grepped for keyring / redaction / sandbox. | Did not build or run it. |
| Prism Launcher | GPL-3 | Cloned `PrismLauncher/PrismLauncher` (shallow). Grepped `launcher/` for quick play, dependency maps, URL scheme, re-auth. Behaviour only. | Copied no code (Luminos is proprietary, `AGENTS.md` rule 7). Did not build it. |
| Hotwire | Modified Polyform Strict (source-available) | Modrinth API project record and description, the public `dearIrene/hotwire-public` link. | Did not decompile the jar and did not read its source. Its licence forbids reuse; everything below is **observed behaviour from its own public description**. How it swaps classes is unknown to me. |
| XMCL | MIT (launcher), Electron | `xmcl.app` home page, `xmcl.app/en/guide/p2p`, public release notes describing the signalling backend. | Did not read or run the source. Bedrock integration is mentioned on the home page as "experimental"; not examined. |

The `rea` skills are vendored but I did **not** open or run them this session. The teardown used git clone + grep + the Modrinth API + public docs. It is not a decompiler run, and no closed binary was decompiled.

Legend for the last column: **BUILD** = port the idea, **BEAT** = build and do it better, **SKIP** = not worth it for Luminos, with a reason.

## Pandora (MIT, Rust + gpui)

| Feature | What it does | How it works (read in source) | Luminos today | Decision |
|---|---|---|---|---|
| Cross-instance sync | Options, saves, etc. shared between instances; per-item enable/disable | `syncing.rs`: shared folder in the launcher dir; each instance's entry becomes a **symlink (Unix) or junction (Windows, `junction` crate)** to it. `options.txt` is merged key by key (`create_combined_options_txt`). `get_sync_state`, `enable_all`, `disable_all` per target name. | `core/src/sync.rs` already syncs keybinds, `options.txt` (per key), mod configs, `servers.dat` with a 3-way hash decision and a conflicts folder. **Saves are not synced.** No UI conflict dialog. | **BEAT**: keep copy+3-way (safer than links), add saves as an opt-in link target and a conflict dialog. |
| Mod dedup | Same jar stored once | `duplicate.rs`: SHA-1 content library (`create_content_library_path(dir, hash, ext)`), found by hash, `.disabled` suffix handled. Reflink via vendored `reflink-copy`, hard-link fallback. | None. `storage.rs` only measures and clears folders. | **BUILD**: hash store + hardlink now; reflink only where the OS allows (see `docs/STORAGE.md`). Show the saving. |
| Keyring credentials | Tokens in the OS credential store | `crates/auth/src/secret.rs` (oo7 on Linux, platform stores elsewhere) | Done in #17 (`core/src/secrets.rs`, keyring crate; Windows round trip green in CI). | Done. |
| Live log, auto redaction | Uncapped log pane; sensitive strings removed before upload | `log_reader::replace()` is applied before the mclo.gs upload; `reqwest_client` redacts `key=` query strings from errors. Redaction runs on the *upload/export* path. | Nothing. Launch output is not scrubbed. | **BEAT**: scrub on every write *and* copy, not only upload; always on. |
| Direct Modrinth / CurseForge | No metadata server | `reqwest_client`, per-platform modules | Modrinth direct (`modrinth.rs`); no CurseForge (needs an API key). | Keep. CurseForge **SKIP** (key + terms). |
| Sandbox | Mods can't harm the system | `launch/mod.rs` ~L2242: `if configuration.sandbox`, requires **`bwrap` and `xdg-dbus-proxy`** (Linux only), else spawn error. | None. | **Windows has no equivalent that keeps mods working.** See decision below. |
| Desktop shortcuts | `.lnk` / `.desktop` per instance/world | `shortcut.rs`: `mslnk::ShellLink` on Windows with an args string; `.desktop` on Linux | None | **BUILD** (Quick Play shortcuts). |

## Prism (GPL-3, C++/Qt): study only

| Feature | What it does | How it works | Luminos today | Decision |
|---|---|---|---|---|
| Dependency tracking | Mods page shows what needs what; warns before disabling | `ModFolderModel` keeps `m_requires` / `m_requiredBy` maps built from each jar's own metadata; `Mod::requiredByCount()` drives the UI | Install pulls *required* deps (`content.rs` ~L272). No graph, no guard on disable. | **BEAT**: graph from Modrinth dependency data **plus** the installed set; refuse to disable a mod an enabled mod needs; list missing ones. |
| Quick Play | Launch straight into a world or server | `MinecraftInstance.cpp` ~L780: appends `--quickPlayMultiplayer host:port` or `--quickPlaySingleplayer <world>` when the version profile has trait `feature:is_quick_play_*` | Servers only (`launch.rs` `supports_quick_play`). No worlds, no shortcut files. | **BUILD**: add worlds + `.lnk` shortcuts. |
| 3D skin preview | Rotating skin | Qt/OpenGL | Done (skinview3d); see `tools/skin3d-check.mjs`. | Done. |
| Auto re-auth | Refreshes expired accounts | `MSAStep`, `MSADeviceCodeStep`, refresh token in `AccountData` | `msauth.rs` has refresh; launch does not prompt when refresh fails. | **BUILD** (the prompt). The network chain stays UNVERIFIED (`docs/MICROSOFT_AUTH.md`). |
| Resource/shader pack updates | Update checks for packs | `ResourceUpdateDialog` | Mods only | Later. |
| URL-protocol import | `prismlauncher://` handler | `program_info/*.desktop` registers the scheme | `luminos://join` parser exists (`joinlink.rs`); no OS registration or modpack scheme | Later. |

## Hotwire (observed behaviour only, Fabric-only, 1.21.9 and 26.x)

| Feature | What it does | How it works | Luminos today | Decision |
|---|---|---|---|---|
| Live mod toggle | Switch up to five mods while the game runs; deps follow automatically | **Unknown to me** (closed behaviour; its page says it ships a dev mode where "on the JetBrains Runtime everything goes in, even new methods and fields", i.e. it relies on JVM class redefinition). | No in-game code at all. | **Panel + planner BUILD; live apply NOT BUILT.** See "Decisions" below. |
| In-game store | Mods, shaders, resource packs, data packs from Modrinth | Modrinth API from inside the game | Launcher has a Modrinth browser (`modrinth.rs`) | **BUILD** the store in the panel (launcher side). |
| Metadata cache | Per-instance compressed cache | Not documented | `app/src/modrinth-meta.json` static only | **BUILD** (gzip JSON per instance, ETag/ `date_modified` re-check). |
| "Hide installed", stacked notifications, pause while open | Quality-of-life | Not documented | none | **BUILD** |
| Keep-on list | ModernFix/C2ME stay on | Not documented beyond the claim | none | **BUILD** (we choose the list ourselves). |
| Pending tasks + undo | Anything that must wait is queued, and "you can undo all of it" (its page) | Not documented | none | **BUILD**. *Correction to the brief: Hotwire does have undo for pending tasks and build rollback in dev mode; ours is not a new idea, only a clearer one-click revert of the last switch.* |

## XMCL (MIT, Electron)

| Feature | What it does | How it works | Luminos today | Decision |
|---|---|---|---|---|
| P2P hosting | Host a singleplayer world; friends join with a room code/link, no port forwarding | WebRTC data channels (DTLS), STUN hole-punching, host-star topology; the world appears under **LAN Worlds** in the guest's multiplayer menu. Signalling: **Cloudflare Workers + one Durable Object per room**, DPoP-signed sessions; since 0.66.1 hosting requires a free account for spam/DoS control and relay access. | `luminos://join?server=` only (public servers). | **BUILD client; backend UNVERIFIED** (see `docs/P2P.md`). |
| Concurrent chunked downloads, socket reuse | Speed | HTTP range + keep-alive | `download.rs` exists; not measured against it | Measure before claiming. |
| Link-based resource dedup | Hard/symbolic links for mods | links into instances | See Pandora | **BUILD** once. |
| Multi-account hub, Bedrock | Many account types; experimental Bedrock | n/a | Offline + Microsoft | **SKIP** (Bedrock is off-brief). |

## Decisions that need saying out loud

* **Sandbox.** Pandora's sandbox is Linux-only (`bwrap`). On Windows the realistic options are a Job Object (limits processes, memory, UI handles) or an AppContainer (denies file/network by default). Job Objects do not stop a mod reading your files or using the network, so calling it a "sandbox" would be false. AppContainer breaks mods that read `%APPDATA%`, write outside the instance, or open sockets, which is most of them, and needs per-launch ACL setup that I cannot test here. **Decision: not built.** The UI shows "Mod sandbox: not available on Windows without breaking mods" and `STATUS.md` says the same. Nothing in the sandbox family is built: no Job Object, no AppContainer. What protects the user today is narrower and real: tokens live in the OS keyring (#17) and every log line is redacted (this PR).
* **Live hot-swap.** Real hotswap needs in-game code (class redefinition and Mixin handling) in the Java client plus the in-game rendering hooks #17 said were missing. That is out of scope this session and cannot be verified without a game window. The panel's *planner* (what changes, dependencies, keep-on list, undo, queue-for-next-launch) is built and tested; "apply live" is **not built**, so the UI says "Applies on next launch" for every switch.

## What Luminos should adopt, ranked by user impact

1. **Dependency graph + guard on disable** (Prism). Breaks fewer instances than anything else here; cheap; verifiable.
2. **Log redaction, always on** (Pandora). Stops users leaking tokens when they paste logs for help; small and testable.
3. **Dedup with the saving shown** (Pandora/XMCL). Disk space is a top launcher complaint; the number makes it visible.
4. **Quick Play for worlds + shortcuts** (Prism/Pandora). One-click into the thing you actually play.
5. **Discord presence that says Luminos** (own brief). Free reach; payload is unit-testable.
6. **P2P hosting** (XMCL). Highest wow, highest cost and abuse risk; ship the client, run the backend only with account-gated limits.
7. **Live mod panel** (Hotwire). The planner and store are useful alone; the live-apply part is a research project.
