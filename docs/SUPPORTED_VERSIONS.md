# Supported Minecraft versions for Luminos Client

Source: Mojang's `version_manifest_v2.json`, read 2026 (latest release `26.3`, latest snapshot `26.4-snapshot-10`).

The newest releases, in order: `26.3`, `26.2`, `26.1.2`, `26.1.1`, `26.1`, then `1.21.11`, `1.21.10`, …

## The five we target

| # | Version | Why | Java | Mappings |
|---|---|---|---|---|
| 1 | **26.3** | Latest release. | 25 | none (unobfuscated) |
| 2 | **26.2** | Previous release. | 25 | none |
| 3 | **26.1.2** | Newest of the 26.1 line. `26.1` and `26.1.1` are hotfixes of the same line; one build covers all three (`minecraft` list in the manifest). | 25 | none |
| 4 | **1.21.11** | Last 1.21.x release. The newest line with the deepest mod ecosystem. | 21 | Mojang |
| 5 | **1.21.4** | The version the current client jar already targets and ships. It keeps working users working while the matrix is built. | 21 | Mojang |

Fabric first. Quilt and NeoForge are not claimed, because nothing was verified for them.

## Verified now (Modrinth API + Fabric meta, run in this session)
For every one of `26.3, 26.2, 26.1.2, 26.1.1, 26.1, 1.21.11, 1.21.10, 1.21.4`: a Fabric game version exists (loader 0.20.1 stable), and Modrinth has a **release**-channel Fabric build of Fabric API, Sodium, Lithium, Entity Culling, FerriteCore, ImmediatelyFast, Iris and Mod Menu.
So the performance stack can be installed on all five. The installer skips any mod that is missing for a version and never fails the launch because of it.

## What is shipped today
Only `1.21.4` has a Luminos Client jar (`client-v0.2.0`, SHA-256 in `client/client-compat.json`). For any other version the launcher installs the performance mods only and says why:
> Luminos Client doesn't support Minecraft 26.3 yet (supported: 1.21.4). Running with the performance mods only.

## What the multi-version build still needs (not done)
1. Stonecutter (one source tree, one jar per version) with a small shim layer for rendering (`GuiGraphics` changes), networking and input (GLFW callbacks).
2. For 26.x: the unobfuscated Loom plugin and JDK 25. The shim drops the mappings layer there.
3. A client test hook that writes `title_screen_reached.json` and exits, so CI can assert a launch under xvfb + llvmpipe.
4. Per-version `disabled_features` in `client-compat.json`, shown in the mod menu with the reason.
