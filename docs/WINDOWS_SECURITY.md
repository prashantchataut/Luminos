# Windows SmartScreen / Defender — what is going on and what we do about it

**Symptom:** double-clicking `Luminos-Setup.exe` or `luminos.exe` shows "Windows protected your PC / Unknown publisher" and you must press *More info → Run anyway*; some users also see a Defender ML heuristic (`!ml`) detection.

**Why:** SmartScreen trusts (a) executables signed with a certificate that has reputation, or (b) files many people already ran. A new, unsigned, self-contained Rust binary that downloads files and starts Java is exactly what the ML heuristic is suspicious of. It is a *reputation* verdict, not proof of malware.

## What the project already does to lower the odds
- Manifest + full version resource in the exe (`launcher/crates/luminos-app/build.rs`), `asInvoker` (never asks for admin).
- Static CRT (no VC++ redistributable download), no packer / UPX, no obfuscation, no self-modifying behaviour.
- Per-user installer, no services, no startup entries, no registry run keys.
- **No console windows**: every child process (`java -version`, the game) is started with `CREATE_NO_WINDOW` (`luminos-core/src/sys.rs`). The old build opened one console per Java probe — flicker + a classic "dropper" signal.
- Single-instance lock, so double-clicking can't pile up processes.
- Releases are built by GitHub Actions from this repo and carry SHA-256 sums plus a build-provenance attestation:
  `gh attestation verify Luminos-Setup.exe -R prashantchataut/Luminos`

## What actually removes the warning (owner action needed)
1. **Code-sign** the installer and exe. Options: *Azure Trusted Signing* (~$10/month, individual developers with ID verification, instant SmartScreen reputation for the publisher), an OV/EV certificate, or SignPath (free for OSS — not available while the source licence is proprietary). Add the signing step to `.github/workflows/release.yml` after the Inno Setup build.
2. **Submit each release** to Microsoft as a false positive: <https://www.microsoft.com/en-us/wdsi/filesubmission> (choose "Software developer"). Usually cleared in 1–3 days.
3. Keep the file name and publisher stable; reputation accrues per signer/hash.

## Never do
Don't tell users to disable Defender or add exclusions for the whole folder; point them to the SHA-256 / attestation check instead.
