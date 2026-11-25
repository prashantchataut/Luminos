// Writes the manifest the website reads (site/src/lib/release.json) from a published release's SHA256SUMS.txt,
// so the version, asset names, download links and checksums can never drift from what was actually released.
// usage: gen-release-json.mjs <tag> <SHA256SUMS.txt> <out.json>
import { readFileSync, writeFileSync } from "node:fs";
const [tag, sumsPath, out] = process.argv.slice(2);
if (!tag || !sumsPath || !out) { console.error("usage: gen-release-json.mjs <tag> <sums> <out>"); process.exit(2); }
const version = tag.replace(/^v/, "");
const sums = Object.fromEntries(readFileSync(sumsPath, "utf8").split("\n").filter(Boolean).map((l) => { const [h, ...n] = l.trim().split(/\s+/); return [n.join(" ").replace(/^\*/, ""), h]; }));
const base = `https://github.com/prashantchataut/Luminos/releases/download/${tag}`;
const apkName = `Luminos-${version}.apk`;
const need = ["Luminos-Setup.exe", apkName];
for (const n of need) if (!sums[n]) { console.error(`SHA256SUMS.txt has no entry for ${n}`); process.exit(1); }
const asset = (name) => ({ name, url: `${base}/${name}`, sha256: sums[name] || null });
const manifest = {
  published: true,
  tag, version, prerelease: tag.includes("-"),
  releasePage: `https://github.com/prashantchataut/Luminos/releases/tag/${tag}`,
  windows: { ...asset("Luminos-Setup.exe"), portable: asset("Luminos-Portable.zip"), signed: false },
  android: {
    ...asset(apkName),
    status: "launcher-preview",
    label: "Android launcher preview: installs and manages instances; Minecraft does not launch yet.",
    minecraftLaunch: false, minAndroid: "8.0 (API 26)", abis: ["arm64-v8a", "x86_64"],
    abiNote: "x86_64 verified on an emulator only; arm64-v8a never run on a phone.",
    signing: "debug key (no release keystore exists)", realDeviceTested: false,
  },
  jars: Object.keys(sums).filter((n) => /^luminos-client-.*\.jar$/.test(n)).map(asset),
  checksums: { name: "SHA256SUMS.txt", url: `${base}/SHA256SUMS.txt` },
};
writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${out} for ${tag}`);
