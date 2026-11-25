# START HERE (session 20)
Read `STATUS.md`, then `docs/SESSIONS.md`, then `docs/design/rounds/CRITIQUE_LOG.md`.

**`v1.0.0-rc2` is published** (pre-release) from `main`: Windows installer, portable zip, APK (launcher preview, Minecraft does not launch on Android yet), two Fabric client jars, SHA256SUMS.txt. Site links come from `site/public/release.json` and `site/src/lib/release.json` (same file), always naming the tag, never `/releases/latest/` (which skips pre-releases and was the cause of the stale 0.6.0 link).

SHA-256 (checked by download):
    432b827864c5088e8bc78955ebc940eeb52e6997a033cc647454a37ddc6a2f93  Luminos-Setup.exe
    571b94a7fb41e44fc764958757e73a033bbab25b357743220b104a5a9e90dabe  Luminos-Portable.zip
    c6d984acea1ced9dcb1d87e5ea16962d8761cc78b40d3a4c7fc0158a636cae9d  Luminos-1.0.0-rc2.apk
    7877b06f32e868b45df156837554e99aeef44e9b7466fcb712a6d4b8635c9b59  luminos-client-0.5.0-mc1.21.11.jar
    76d28dfe52d5bccfe98e366d98fbedc73b9a56f5001b3a24a46214081b29fbc4  luminos-client-0.5.0-mc26.3.jar
    cae8992da4e345d093866a1c65982bf41b1359b4182dd7368a295bccd1949a1b  client-compat.json
    8c82ba4476005b046c08c8239a7081433a228b55ec373d4a9d9fb0578f97553c  apk-info.txt
    30f5556f29375f93d812813d70324fa72828e3b4b0aa744ea658651eb9cd196d  package-manifests.tar.gz

Run `scripts/release-check.sh` before any release. Next: owner revokes the GitHub PAT that was pasted into chat and registers the Ely.by OAuth app, Discord app and Azure app; real-desktop run; measure FPS on a real GPU before claiming anything; HUD widgets beyond the client's 8.
