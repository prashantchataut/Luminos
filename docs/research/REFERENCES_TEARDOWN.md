# Reference teardown: Pandora, Prism, XMCL, Hotwire (session 18, redone with rea)

A build guide, not an essay. Every row says what was read and how.

## Method and limits

| Reference | Licence | How it was studied | Limits |
|---|---|---|---|
| Pandora Launcher | MIT | Shallow clone of `Moulberry/PandoraLauncher`, source read with `rg`: `crates/backend/src/{syncing,duplicate,fs}.rs`. | Not built or run. `rea` is a binary / JavaScript analyzer; Pandora is Rust source, so reading the source was the right tool. |
| Prism Launcher | GPL-3 | Shallow clone, source read with `rg`: `launcher/minecraft/mod/*`, `MinecraftInstance.cpp`. **Behaviour only; no code copied** (`AGENTS.md` rule 7). | Not built or run. |
| XMCL | MIT | Shallow clone of `Voxelum/x-minecraft-launcher`. **`rea` was run**: `npx rea-agents@latest analyze-javascript-application xmcl-runtime/peer --json` (exit 0, 9 files; evidence kept in `docs/research/rea/xmcl-peer.json.gz`; provider `rea-javascript-application`, confidence `derived`; rea itself notes that static imports and endpoints do not prove runtime execution). Then read `packages/multiplayer-core/lib/*` and `xmcl-runtime/peer/*`. | Static analysis only. XMCL was not run. I did not read the `LocalNetwork` implementations; the LAN bridge below comes from its interfaces and call sites. |
| Hotwire | PolyForm Strict **plus a "Clients" clause** | Modrinth / README front matter (public text) only. | See below. I **do not and will not read, run `rea` on, or reuse** its source. |

### Hotwire: why this entry is behaviour-only, and a correction to my own process

`dearIrene/hotwire-public` is a public repository, and the brief said to use `rea` on it if public. Its `LICENSE.md` says clients "may not ... study, decompile or reverse engineer it to make their own", and defines a client as any product that "gives players its own modified Minecraft client or client launcher with its own features". **Luminos is that** (a launcher plus its own Fabric client mod). The clause also bars clients from using, bundling, copying or integrating it, so there is no Hotwire API integration either. Public is not the same as permitted.

Process note: before I read the licence I had read the repository's README explainer and listed its file tree. That was a mistake. I stopped there and opened no source file. Nothing in the Luminos design is derived from it: the Luminos agent does **no** class redefinition, no mixin re-application and no bytecode work (`docs/LIVE_SWAP.md`).

What is recorded about Hotwire is what its public front matter says: it live-toggles Fabric mods, blacklists the renderer and core mods (Sodium, Lithium, FerriteCore, C2ME, ModernFix, Fabric API and others), shows a prompt before switching, and **does have undo for pending tasks and rollback**. **Correction to #18:** undo is not a new idea; Hotwire has it. Luminos' undo is a one-press revert of the last switch for both live and queued items, built on Luminos' own state.

## What each reference does (read, not guessed)

### Pandora (MIT)
| Topic | Finding | Luminos before | Decision |
|---|---|---|---|
| Which files sync | Folders (saves and so on) are **shared by symlink (Unix) or junction (Windows)** (`syncing.rs` uses `junction::create/get_target/delete`). `options.txt` is **merged key by key**: `create_combined_options_txt` reads every syncing instance's file, sorts by `max(created, modified)`, and the **newest file wins each key**. `resourcePacks` and `incompatibleResourcePacks` are dropped for every instance except the current one. | `core/src/sync.rs`: option keys, keybinds, configs, `servers.dat`, 3-way hash decision, conflicts folder. Saves not synced. | **BEAT**: keep copy plus 3-way (no link fragility), add saves as opt-in. |
| Conflicts | **None.** Silent last-writer-wins by file time. No prompt, no record. | Conflicts recorded, no UI. | **BEAT**: a resolve dialog per item (keep this / keep other / keep both). |
| Reflink | `fs.rs::fastcopy(from, to, reflink, hard_link)`: try `reflink_copy::reflink`, on error fall back to `std::fs::hard_link`, then plain copy. `duplicate.rs` finds same-hash files (content library keyed by hash, `.disabled` handled) and reflinks them. | Hard links plus ledger (`dedup.rs`). | **ADOPT**: reflink, then hard link, then keep. |

### Prism (GPL-3, behaviour only)
| Topic | Finding | Luminos before | Decision |
|---|---|---|---|
| Dependency page | `ModFolderModel` keeps `m_requires` and `m_requiredBy` (`QHash<id, QSet<Mod*>>`) and exposes `requiresList(id)` and `requiredByList(id)`; each `Mod` caches `requiredByCount()` and `requiresCount()` for the table. `GetModDependenciesTask` fetches missing deps from the platform filtered by Minecraft version and loader, skips locally installed ones (`isLocalyInstalled`, `maybeInstalled`) and records "required by" names for the confirmation list. | `deps.rs` graph, `livepanel/plan.ts` | **Have it. BEAT**: the diff is mandatory before any switch and lists every extra mod that changes. |
| Quick Play | `MinecraftInstance.cpp` ~L780: `--quickPlayMultiplayer host:port` or `--quickPlaySingleplayer <world>`, gated on version traits. | `quickplay.rs` (#18) | Done; UI button this PR. |

### XMCL (MIT): P2P protocol
| Topic | Finding (rea + source) | Luminos | Decision |
|---|---|---|---|
| Transport | **WebRTC data channels.** XMCL hosts the `RTCPeerConnection` in a hidden browser context and drives it over `MessagePort` with a typed protocol (`BrowserRtcProtocol.ts`: `create`, `create-offer`, `create-answer`, `set-local/remote-description`, `add-ice-candidate`, `get-stats`, `create-data-channel`; events `state`, `ice-candidate`, `data-channel`). Each channel is bridged to a port (`bridgeDataChannel`). | Tauri's webview is a browser, so `RTCPeerConnection` is native. | **BUILD** (`app/src/p2p/`). |
| NAT and relay | ICE servers come from a credential with a TTL, refreshed at about 90% of it (`updateIceServers`). A shared TURN server is prepended when configured (`sharedTurnServer`). After connecting, the selected candidate pair is read from stats and the session is labelled direct or relay (`selectedCandidate.ts`, `multiplayer.ts` ~L209). | None. | **BUILD**: STUN by default, TURN only if configured, show direct/relay. |
| LAN emulation | The host announces a LAN world with `peer.sendLan(port, motd)`. `LocalNetwork` is `connect(port) -> LocalSocket` and `LocalServer {port, motd}`: the host dials the real local port, the guest opens a local listening port. | None. | **BUILD** (`core/src/p2p.rs`: guest listens on 127.0.0.1, host dials the LAN port). The LAN-announce UDP packet is **not** emitted; the guest uses *Direct Connection* to `localhost:<port>`. |
| Signalling | Cloudflare Workers, one Durable Object per room; since 0.66.1 hosting needs an account. | Minimal Worker, `p2p-signal/`. | **BUILD**; verification status in `docs/P2P.md`. |

## Adopt / beat / skip, ranked by user impact

1. **ADOPT** Prism's dependency graph and the guard on disable (built in #18; now fed real mods).
2. **BEAT** Pandora's silent sync with an explicit conflict dialog and saves as opt-in.
3. **ADOPT** reflink, then hard link, then keep, and **show the saving** on the instance card.
4. **ADOPT** XMCL's WebRTC data channel, STUN, host-star topology and the direct/relay label.
5. **ADOPT the product idea** of live toggle with an honest queued split; **SKIP the mechanism** (class redefinition). It is closed to clients by Hotwire's licence and untestable here. Luminos goes live for what it owns (its own modules) and for packs; third-party mods queue.
6. **SKIP** a Windows sandbox (unchanged, `docs/SECURITY.md`), CurseForge (key and terms), Bedrock.

## Gap table

| Capability | Leader | Luminos before | Luminos after this PR |
|---|---|---|---|
| Dependency graph | Prism | engine, panel fed sample data | real instance mods via Tauri command |
| Log redaction | Pandora (upload only) | always on | same |
| Dedup and the number | Pandora | hard links, no number | reflink, then hard link, with "saved N" on each instance card |
| Sync | Pandora | no saves, no UI | saves opt-in plus conflict dialog |
| Live toggle | Hotwire (closed to clients) | none | modules and packs live; third-party mods queue |
| P2P hosting | XMCL | none | client and bridge built; signalling backend status in `docs/P2P.md` |
| Quick Play | Prism | parser only | shortcut button |
