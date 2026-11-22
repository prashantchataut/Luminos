# Prism Launcher

**Licence: GPL-3.0** (checked via the GitHub API). Do not copy or port its code into Luminos. Patterns only.

## Read this session (README)
- A fork of MultiMC. Manages many separate Minecraft installs ("instances") side by side.
- Distribution is a strength: Windows, macOS, Linux, Flatpak nightly repo, packaged across distros (Repology badge).
- Development builds are public and easy to reach (GitHub Actions, nightly.link), clearly labelled as unstable.
- Community: Discord, Matrix, subreddit. Translations on Weblate.

## Prior knowledge, NOT verified this session
- Instance-first UI: every setting (Java, memory, args, loader) lives on the instance.
- Modpack sources: Modrinth, CurseForge, FTB, ATLauncher, Technic; instance export/import.
- Microsoft accounts plus offline accounts.

## What to take
- Per-instance everything. Luminos already has this for Java/RAM; keep it that way.
- Public nightly channel with an honest "unstable" label. Luminos should add an update channel setting.
- Weblate for translations once there is a language picker that actually changes text.

## What to do better
- Prism's UI is a dense desktop-toolkit list. Luminos can lead with a single "Continue" and treat instances as secondary.
- Crash help: Luminos' crash doctor already explains causes in words.
