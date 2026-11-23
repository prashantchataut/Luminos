# USER_PAIN: complaints → ledger IDs
Method: seeded from the owner's brief §3, then checked against pages actually opened this session (web search + page excerpts, 2026-ish dates as shown by the pages). Paraphrased notes only; no personal data, no third-party images. Items marked (brief) come from the owner's brief and were NOT independently re-verified here.

## Read this session (source → what it says)
| # | Source | Paraphrased finding |
|---|---|---|
| S1 | https://space-node.net/blog/prism-launcher-vs-tlauncher-minecraft-2026 | Comparison: Prism has no ads/analytics component in its source and publishes signed builds; TLauncher is closed source, shows ads, sends PC details with a partial opt-out, and is detected by Malwarebytes as a PUP. Notes Prism's offline accounts also can't join online-mode servers, and that Prism blocks offline accounts until a Microsoft account is added. |
| S2 | https://www.reddit.com/r/PiratedGames/comments/1qahhv8/i_ran_some_checks_in_tlauncher/ | Thread claiming sandbox analysis shows registry persistence and system discovery; commenters recommend Prism, and one describes a config-file bypass that "only works in an old version". (Claims are the poster's, not verified by us.) |
| S3 | https://www.reddit.com/r/PiratedGames/comments/108oeqf/what_are_good_alternatives_for_tlauncher/ | Users want a TLauncher alternative; Prism is suggested but they note it needs a purchased account to add an offline one; SKLauncher is suggested but another says it is "sketchy" (ad-block wall, poor performance). One commenter reports a suspicious file appearing after installing TLauncher (anecdote). |
| S4 | https://www.reddit.com/r/PiratedGames/comments/1q4m4u3/minecraft_launcher/ | People point to Prism forks (e.g. ElyPrism) and manual JSON edits to get offline accounts; a reply says the edit "doesn't work anymore". Another reply explains big servers need premium accounts. |
| S5 | https://minecraft.pl/en/wiki/launchers/tlauncher | Guide stating bundled-software offers in the installer, PUP flags from several AV vendors, closed source. |
| S6 | https://minecraftskins.app/guides/minecraft-skin-not-showing | Offline-mode servers can't load anyone's skin; owner needs online-mode or a skin plugin; skins set inside a third-party launcher aren't saved to the Mojang account; running game keeps the old skin until restart. |
| S7 | https://humbleservers.com/docs/minecraft/how-do-i-fix-missing-skins-for-cracked-offline-players/ | Offline clients don't fetch skins; fix is SkinRestorer on the server (`/skin <name>`); SkinRestorer is cosmetic only, security needs AuthMe/whitelist. |
| S8 | https://www.reddit.com/r/MinecraftHelp/comments/1maufvs/i_cant_see_my_minecraft_skin_on_a_server_java_1214/ | Typical help thread: "you're on a cracked/offline server, add SkinsRestorer". Users blame client or networking before the server mode. |
| S9 | https://www.reddit.com/r/Minecraft/comments/hg0c4v/online_mode_and_skin_problems/ | Owner of the game running offline-mode for friends sees default skin and others see a stale one; "offline mode simply does not support skins". |

## What users hate in launchers (from S1–S9 only)
1. Ads, ad-block walls, and installers that offer extra software (S1, S3, S5).
2. Opaque telemetry and closed source; no way to see what is sent (S1, S2, S5).
3. AV/PUP flags and "unknown publisher" fear (S1, S5).
4. Launchers that make offline play hard or hacky (JSON edits that break between versions) (S2, S3, S4).
5. Not knowing why a skin or server join fails; blaming the launcher for server mode (S6, S8, S9).
6. Heavy/slow launchers (S3, "performance being bad").

## Complaint → ledger map
| Complaint | Ledger |
|---|---|
| Ads / bundled software / telemetry / "what does it send?" | A1, A1a–A1g, A5 |
| Spyware accusations, PUP flags, unknown publisher | A2, A2a–A2g, A1 |
| Guides telling users to avoid cracked launchers | A1, A2 (earn trust with evidence), docs for server owners I2 |
| Offline skins local-only; need skin plugin | C7, D5, D4, B3 |
| Skins reset after restart | D4 |
| Users blame launcher for server-mode behaviour | C4, C4a–C4c, D5 |
| Outdated OptiFine auto-install; heavy launchers | E4, F4 |
| Prism-quality + offline + alt auth | C3, C1, F1–F3 |
| Mod safety (Fractureiser class) | A4, A4a–A4d, H5 |
| Pojav: offline+Fabric crash | C2, H6 |
| Pojav: Java / MC download errors | H2 |
| Pojav: mouse lock, OTG axis inversion, virtual mouse jumping | H4 |
| Pojav: RAM >75% crashes | H7 |
| Pojav: GL4ES shader limits | H3 |
| Pojav: controller mods broken | H4 |
| Pojav: big modpacks corrupt textures | H5, H2 |
(Pojav rows are from the brief; not re-verified this session.)

## NOT done yet (honest)
- Top open-source clients table (licence | learned | do differently | reusable?): not written.
- Inspiration references with palette/layout notes: not written.
- X / Pinterest / forum / GitHub-issue research: not performed; agent-reach CLI not run.
