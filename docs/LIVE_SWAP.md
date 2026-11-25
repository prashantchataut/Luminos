# Live swap: what changes without a restart, and what waits

## Classification (`launcher/crates/luminos-core/src/livemod.rs`, shown in the panel's review step)
| Item | Disposition | Why |
|---|---|---|
| Luminos modules (the 22 built-in HUD / QoL modules of the Luminos client) | **Live** | Luminos owns the code; the agent flips the module's `enabled` flag, which the HUD reads every frame. |
| Resource packs | **Live** (game running) | Applied through the game's own resource reload (`PackRepository.setSelected` then `Options.updateResourcePacks`, the same path as the vanilla pack screen). |
| Data packs | Live in the classifier, **no applier yet** | Needs a world and the server reload path. Not built, so treat as next launch. |
| Shader packs | **Next launch** | Selection goes through Iris, whose reload path is unverified. |
| Every third-party mod | **Next launch** | See below. The jar is still classified, so the panel can say *why*. |

For a third-party mod the verdict carries real reasons read from the jar: registry content (`blockstates`, worldgen, dimension, enchantment, damage_type ... folders, or a common/server entrypoint), mixins, the keep-on list (Sodium, ModernFix, C2ME, Lithium, FerriteCore, Fabric API, ImmediatelyFast), and `live_candidate`: client-only, no registry content, no mixins, not keep-on. **`live_candidate` is information, not a promise**: Luminos has no mechanism to unload another mod's code, so such a mod is still queued, and the UI says "Looks safe to swap live, but Luminos does not unload third-party code".

## Why registry mods cannot unload
Blocks, items, entities, biomes and dimensions live in registries that are frozen after startup, and worlds already contain them. Removing one mid-session leaves chunks and entities pointing at ids that no longer exist. Mixins are merged into game classes at launch; the JVM lets a loaded class take new method bodies but not new or removed fields, methods or interfaces, so a mixin cannot be taken back by simply forgetting a jar.

## The gap against Hotwire, said plainly
Hotwire live-swaps third-party Fabric mods. Luminos does **not**, and the brief's headline ("HUD, QoL and utility mods toggle without a restart") is therefore **only met for Luminos' own modules and for packs**. The reason is not effort: Hotwire's licence (PolyForm Strict plus a clause) forbids "clients", which includes Luminos, from using, integrating or studying it to build their own. A from-scratch bytecode-level unload engine is out of scope for this session and cannot be verified without a game window per mod. Nothing in the agent derives from Hotwire (`docs/research/REFERENCES_TEARDOWN.md`).

## The agent (`client/src/shared/java/dev/luminos/client/Agent.java`, wire format `core/AgentWire.java`)
* It is a component of the Luminos client jar, not a second jar: it ships wherever the client ships. **Deviation from "a small companion mod"**: instances without the Luminos client get no live apply; everything queues.
* Active only when the launcher starts the game with `-Dluminos.agent=127.0.0.1:PORT -Dluminos.agent.token=...`. Loopback only (a non-loopback address is refused), one-time token, first line must authenticate within 5 s, lines capped at 256 KB, bad lines never kill the reader. The token is registered with the log redactor.
* Commands: `toggle_module`, `set_pack`, `pause`, `snapshot`. Progress events are sent when each step really happens: `received`, `applying`, `reloading` (pack reload overlay observed), `applied`; a refusal is a `done` with `ok:false` and a reason.
* Pause: singleplayer only (`Minecraft.pauseGame`); in multiplayer or with no world it answers `ok:false` with the reason and the panel shows it. The panel resumes the game when closed.
* Undo: the last switch is reverted per item: live items by the inverse command, queued items by cancelling their batch in `luminos-pending.json`.
* Queue: `pending.rs` stores renames (`x.jar` / `x.jar.disabled`) per instance and applies them just before launch.

## Per version
| Minecraft | Builds | Run against the real game |
|---|---|---|
| 1.21.11 | yes (Loom, Java 21 bytecode) | **VERIFIED** at the title screen under Xvfb + software GL, 28 mods loaded: module off/on with stages `received, applying, applied`; pack on/off through a real reload with stages `received, applying, reloading, applied`; unknown module refused; pause refused with "no world is open". Evidence: `docs/research/agent-e2e/result-1.21.11.json`. CI: `smoke.yml` step "Agent end to end". |
| 26.3 | yes (jar built in this session) | **Not run.** Compiles with the same shared source; marked UNVERIFIED. |
| other versions | no jar | not supported; all switches queue |

**NOT TESTED:** pause with a loaded singleplayer world (the harness stops at the title screen); resource-pack reload with a world open.
