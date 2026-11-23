# Test report: session 6

Environment: Linux x86_64 sandbox, 2 cores, 1 GB RAM, rustc stable, Temurin JRE 21.0.13. No GPU, display, Windows or Android SDK.

## `cargo test --workspace` (run here)
**54 passed, 0 failed, 9 ignored** (ignored = live-network or real-game tests, run on demand).
| Suite | Passed | What it covers |
|---|---|---|
| `luminos-core` unit | 40 | accounts (offline UUID vs Java value, legacy accounts.json loads), `loginprobe` (online/offline-with-compression/whitelist/classification/Login Start layout per protocol), `joinlink` (round-trip, hostile links), `directory`, `compat` (resolve, fallback message, bad manifests, SHA-256 vector), servers, Mojang rules, crash doctor, backups, JVM flags, msauth |
| `luminos-core` `yggdrasil_e2e` | 1 | launcher Yggdrasil client against a live `luminos-auth` over TCP: register, duplicate refusal, wrong-password message, login, UUID equals vanilla offline UUID, validate, refresh, javaagent argument |
| `luminos-auth` `conformance` | 9 | metadata; register/authenticate; duplicate/invalid registration; lockout after 5 failures; validate/refresh/invalidate/signout; join + hasJoined with RSA-SHA1 signature verified against the published key; profile signing and bulk lookup; textures through the standard profile endpoint |
| `luminos-app` unit (`motion`) | 4 | spec durations; monotonic easings; springs settle at 30/60/144 fps and after a 250 ms hitch; reduced motion |

## Real Minecraft server login test (run here)
`tools/ci/server-login-test.sh 1.21.4 384` boots Mojang's vanilla 1.21.4 `server.jar` (downloaded from Mojang's manifest), twice:
```
== starting server (online-mode=false)
server: 1.21.4 protocol 769 motd "Luminos login test" latency 1 ms
login mode: OfflineOk
[server log] LuminosTest (/127.0.0.1:43790) lost connection: Disconnected
== starting server (online-mode=true)
login mode: OnlineRequired
PASS: 1.21.4 offline-mode accepted the probe; online-mode demanded a session
```
Only 1.21.4 was run here (JRE 21 only; 26.x needs Java 25). `tests.yml` runs the other four versions in CI; **those runs have not been observed yet.**

## UI render check
`luminos-shots` renders the real egui UI headlessly: 18 screens. `docs/screenshots/16-servers.png` is the new Servers page (demo data with fictional hosts). The first render showed the badge row colliding with the Join button; fixed and re-rendered.

## Not tested
Full Minecraft client launch, authlib-injector inside a real game, Ely.by sign-in with real credentials, Microsoft sign-in, Windows installer, any Android code, GIF/frame profiling.
