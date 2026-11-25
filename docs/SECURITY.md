# Security notes
* **Sandbox: not built, by decision (kept from #18).** Pandora's is Linux-only (bwrap). A Windows Job Object does not restrict file or network access, so calling it a sandbox would be false; an AppContainer breaks most mods. The UI makes no sandbox claim.
* What does protect the player: tokens live in the OS credential store; every game log line is redacted (always on, no setting); the agent link is loopback-only with a one-time token (`docs/LIVE_SWAP.md`); the P2P bridge listens on loopback only; Quick Play links are parsed strictly and never reach a shell.
* The agent token is on the game's command line (visible to local processes of the same user). It only authorises the loopback link to switch Luminos modules and packs.
* **A GitHub PAT was pasted into chat again. Revoke it** and use a fine-grained token or `gh auth login`. It was used only through a one-off HTTP header and is not stored in any file or git config.
