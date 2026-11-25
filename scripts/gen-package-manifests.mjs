// winget + scoop manifests from THIS release's SHA256SUMS.txt. They are generated, never hand-edited, and stay UNSUBMITTED
// until there is a signing certificate (winget and scoop both reject or warn on unsigned installers). Usage: gen-package-manifests.mjs <tag> <SHA256SUMS.txt> <outDir>
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const [tag, sums, out] = process.argv.slice(2); const v = tag.replace(/^v/, "");
const hash = Object.fromEntries(readFileSync(sums, "utf8").trim().split("\n").map((l) => { const [h, f] = l.trim().split(/\s+/); return [f, h]; }));
const need = (f) => { if (!hash[f]) { console.error(`${f} is not in ${sums}`); process.exit(1); } return hash[f]; };
const base = `https://github.com/prashantchataut/Luminos/releases/download/${tag}`;
mkdirSync(`${out}/winget`, { recursive: true }); mkdirSync(`${out}/scoop`, { recursive: true });
const id = "PrashantChataut.Luminos";
writeFileSync(`${out}/winget/${id}.yaml`, `PackageIdentifier: ${id}\nPackageVersion: ${v}\nDefaultLocale: en-US\nManifestType: version\nManifestVersion: 1.6.0\n`);
writeFileSync(`${out}/winget/${id}.installer.yaml`, `PackageIdentifier: ${id}\nPackageVersion: ${v}\nInstallerType: nullsoft\nScope: user\nInstallerSwitches:\n  Silent: /S\n  SilentWithProgress: /S\nInstallers:\n  - Architecture: x64\n    InstallerUrl: ${base}/Luminos-Setup.exe\n    InstallerSha256: ${need("Luminos-Setup.exe").toUpperCase()}\nManifestType: installer\nManifestVersion: 1.6.0\n`);
writeFileSync(`${out}/winget/${id}.locale.en-US.yaml`, `PackageIdentifier: ${id}\nPackageVersion: ${v}\nPackageLocale: en-US\nPublisher: Prashant Chataut\nPackageName: Luminos\nShortDescription: A fast Minecraft Java launcher with its own performance client.\nLicense: Proprietary\nManifestType: defaultLocale\nManifestVersion: 1.6.0\n`);
writeFileSync(`${out}/scoop/luminos.json`, JSON.stringify({ version: v, description: "A fast Minecraft Java launcher with its own performance client.", homepage: "https://prashantchataut.github.io/Luminos/", license: "Proprietary", url: `${base}/Luminos-Portable.zip`, hash: need("Luminos-Portable.zip"), bin: "luminos.exe", shortcuts: [["luminos.exe", "Luminos"]] }, null, 2) + "\n");
writeFileSync(`${out}/README.md`, `Generated from ${tag}'s SHA256SUMS.txt by scripts/gen-package-manifests.mjs.\n\nSTATE: NOT SUBMITTED. Submit only after the installer is code-signed (docs/SIGNING.md).\n`);
console.log("manifests written for", tag);
