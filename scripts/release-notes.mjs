// Release notes = the CHANGELOG.md section for this version (English + Spanish, copied verbatim)
// + a "Known limits" block generated from docs/REAL_DESKTOP_CHECKLIST.md, so a release cannot claim more than the checklist proves.
import { readFileSync } from "node:fs";
const version = (process.argv[2] || "").replace(/^v/, "");
if (!version) { console.error("usage: release-notes.mjs <version>"); process.exit(2); }
const log = readFileSync("CHANGELOG.md", "utf8");
const start = log.search(new RegExp(`^## ${version.replace(/[.+]/g, "\\$&")}\\s*$`, "m"));
if (start < 0) { console.error(`CHANGELOG.md has no "## ${version}" section`); process.exit(1); }
const rest = log.slice(start).split("\n"); let end = rest.findIndex((l, i) => i > 0 && /^## /.test(l)); if (end < 0) end = rest.length;
const section = rest.slice(0, end).join("\n").trim();
if (!/^### English/m.test(section) || !/^### Español/m.test(section)) { console.error(`"## ${version}" needs both "### English" and "### Español"`); process.exit(1); }
const open = readFileSync("docs/REAL_DESKTOP_CHECKLIST.md", "utf8").split("\n").filter((l) => /^- \[ \]/.test(l)).map((l) => l.replace(/^- \[ \]\s*/, "- "));
const limits = open.length ? `\n\n### Known limits / Límites conocidos\nNot yet confirmed on a real desktop (docs/REAL_DESKTOP_CHECKLIST.md). Builds are unsigned, so Windows will show "unknown publisher". Windows ARM64 has not run on ARM hardware. Everything was tested on CI runners only.\nNo confirmado todavía en un escritorio real. Las compilaciones no están firmadas.\n\n${open.join("\n")}\n` : "\n";
process.stdout.write(section.replace(/^## .*\n/, `## Luminos ${version}\n`) + limits);
