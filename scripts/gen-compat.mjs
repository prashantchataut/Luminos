// Regenerate client/client-compat.json from the jars of one release: real URL for this tag + real sha256 of the file.
// Entries for Minecraft versions that were NOT rebuilt are kept untouched. Usage: gen-compat.mjs <jarDir> <tag> <in.json> <out.json>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const [dir, tag, inp, outp] = process.argv.slice(2);
const compat = JSON.parse(readFileSync(inp, "utf8"));
for (const f of readdirSync(dir).filter((f) => /^luminos-client-.+-mc.+\.jar$/.test(f))) {
  const m = f.match(/^luminos-client-(.+)-mc(.+)\.jar$/);
  const sha256 = createHash("sha256").update(readFileSync(`${dir}/${f}`)).digest("hex");
  const entry = { minecraft: [m[2]], loader: "fabric", url: `https://github.com/prashantchataut/Luminos/releases/download/${tag}/${f}`, sha256, client_version: m[1], java: parseInt(m[2]) >= 26 ? 25 : 21, required_mods: ["fabric-api"], disabled_features: [] };
  const i = compat.entries.findIndex((e) => e.minecraft.length === 1 && e.minecraft[0] === m[2]);
  if (i >= 0) compat.entries[i] = { ...compat.entries[i], ...entry }; else compat.entries.unshift(entry);
}
for (const e of compat.entries) if (!/^[0-9a-f]{64}$/.test(e.sha256 || "")) { console.error("entry without sha256:", e.minecraft); process.exit(1); }
writeFileSync(outp, JSON.stringify(compat, null, 2) + "\n"); console.log(`compat: ${compat.entries.length} entries`);
