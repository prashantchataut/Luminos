import { useEffect, useState } from "react";
import Orb from "./components/Orb";
import Reveal from "./components/Reveal";

const REPO = "prashantchataut/Luminos";
const SETUP = `https://github.com/${REPO}/releases/latest/download/Luminos-Setup.exe`;
const RELEASES = `https://github.com/${REPO}/releases/latest`;

const ART = [
  ["complementary-reimagined", "Complementary Reimagined"],
  ["solas-shader", "Solas"],
  ["better-leaves", "Better Leaves"],
  ["bsl-shaders", "BSL Shaders"],
  ["photon-shader", "Photon"],
  ["fabulously-optimized", "Fabulously Optimized"],
  ["rethinking-voxels", "Rethinking Voxels"],
  ["cobblemon-fabric", "Cobblemon"],
  ["fresh-animations", "Fresh Animations"],
  ["bliss-shader", "Bliss"],
] as const;

const SHOTS = [
  ["06-home", "Home"],
  ["09-discover", "Discover"],
  ["08-instance-content", "Mods"],
  ["07-library", "Library"],
  ["11-skins-studio", "Skins"],
  ["12-playtime", "Playtime"],
  ["16-servers", "Servers"],
  ["17-instance-worlds", "Backups"],
  ["18-crash-doctor", "Crash doctor"],
  ["13-settings", "Settings"],
] as const;

const FEATURES: [string, string, string][] = [
  ["Mod library", "Mods, modpacks, shaders, resource and data packs from Modrinth. One click installs a project with every required dependency.", "MODRINTH"],
  ["Auto-update", "Update one mod or an entire instance in one pass using hash lookups. Unlink a mod to freeze it on that version forever.", "UPDATE · UNLINK"],
  ["Instances", "Each instance owns its mods, saves, configs, RAM and Java. Duplicate one, break it, delete it — your main world never notices.", "ISOLATED"],
  ["Crash doctor", "Reads the log and says what happened in plain words: out of memory, wrong Java, missing dependency, bad mixin. Then offers the fix.", "LOGS"],
  ["Playtime", "Per instance, per day, in a weekly chart on Home. Recorded by the launcher, stored on your disk, shared with nobody.", "LOCAL"],
  ["Skin studio", "A 64×64 pixel editor with front and back preview, slim arms and a library you fill from any username.", "SKINS"],
  ["Servers & backups", "Live server pings and one-click join. Zip any world, restore it later, let the launcher prune old copies.", "WORLDS"],
  ["Java, handled", "Finds the Java you have, downloads the exact runtime a version needs when you don't, and picks safe memory flags for you.", "AUTO"],
];

const HUD = ["Armor HUD", "Keystrokes", "CPS", "FPS", "Coordinates", "Potion effects", "Toggle sprint", "Zoom", "HUD editor"];
const PERF = ["Sodium", "Lithium", "Entity Culling", "FerriteCore", "ImmediatelyFast", "Mod Menu", "+ ~25 more"];

const ROADMAP: [string, string][] = [
  ["NOW", "Fabric · Quilt · Vanilla launching, Modrinth library, auto-update, skins, playtime, backups, crash doctor, Windows installer."],
  ["NEXT", "Microsoft sign-in for owners, launcher self-update, Forge & NeoForge, instance import from other launchers."],
  ["LATER", "Cosmetics in the client, shader presets per instance, mod profiles you can share by link."],
];

type Rel = { tag: string; size?: number; count?: number } | null;
function useRelease(): Rel {
  const [rel, setRel] = useState<Rel>(null);
  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        const a = (j.assets || []).find((x: { name: string }) => x.name === "Luminos-Setup.exe");
        setRel({ tag: j.tag_name, size: a?.size, count: a?.download_count });
      })
      .catch(() => {});
  }, []);
  return rel;
}

function Mark({ src = "luminos.svg", className = "h-7 w-7" }: { src?: string; className?: string }) {
  return <img src={src} alt="" className={`px ${className}`} draggable={false} />;
}

function Section({ id, n, label, children }: { id: string; n: string; label: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <div className="mono mb-10 flex items-center gap-4 text-mute">
          <span className="text-lum">{n}</span>
          <span className="h-px w-10 bg-line" />
          <span>{label}</span>
        </div>
      </Reveal>
      {children}
    </section>
  );
}

export default function App() {
  const rel = useRelease();
  const [shot, setShot] = useState(0);
  const mb = rel?.size ? `${(rel.size / 1048576).toFixed(1)} MB` : "single installer";
  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-line bg-bg0/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-6">
          <a href="#top" className="flex items-center gap-3">
            <Mark />
            <span className="text-[13px] font-bold tracking-[0.32em]">LUMINOS</span>
          </a>
          <nav className="mono ml-auto hidden gap-8 text-mute md:flex">
            <a className="hover:text-ink" href="#launcher">Launcher</a>
            <a className="hover:text-ink" href="#features">Features</a>
            <a className="hover:text-ink" href="#client">Client</a>
            <a className="hover:text-ink" href="#trust">Trust</a>
            <a className="hover:text-ink" href="#roadmap">Roadmap</a>
          </nav>
          <a href={SETUP} className="btn btn-primary !h-9 !px-4 !text-[13px] max-md:ml-auto">Download</a>
        </div>
      </header>

      <main id="top">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-16 md:grid-cols-[1.15fr_1fr] md:pt-24">
          <div>
            <div className="mono mb-6 text-lum">Minecraft Java launcher · written in Rust</div>
            <h1 className="text-[clamp(2.8rem,7vw,5.2rem)] font-extrabold leading-[0.98] tracking-[-0.035em]">
              Every version.<br />Every mod.<br /><span className="text-ice">No nonsense.</span>
            </h1>
            <p className="mt-7 max-w-lg text-[17px] leading-relaxed text-mute">
              A launcher that starts in a blink, installs from Modrinth, keeps your mods updated and has its own performance client built in — no Electron, no accounts, no ads.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href={SETUP} className="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.4v7H3zM11.5 4.3 21 3v8.4h-9.5zM3 12.6h7.5v7L3 18.5zM11.5 12.6H21V21l-9.5-1.3z" /></svg>
                Download for Windows
              </a>
              <a href="#launcher" className="btn btn-ghost">See the launcher</a>
            </div>
            <div className="mono mt-6 flex flex-wrap gap-x-6 gap-y-2 text-mute">
              <span>{rel ? rel.tag : "v0.3"}</span>
              <span>{mb}</span>
              <span>Windows 10/11 · no admin</span>
              <a className="underline decoration-line underline-offset-4 hover:text-ink" href={RELEASES}>All downloads</a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[460px]">
            <Orb n={44} className="aspect-square w-full" />
          </div>
        </div>

        <div className="border-y border-line bg-bg1/80">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-line md:grid-cols-4">
            {[
              ["~11 MB", "launcher binary"],
              ["0", "Electron / web views"],
              ["Fabric · Quilt · Vanilla", "launch today"],
              ["Modrinth", "the only content source"],
            ].map(([a, b]) => (
              <div key={b} className="bg-bg1 px-6 py-6">
                <div className="text-xl font-bold tracking-tight">{a}</div>
                <div className="mono mt-1 text-mute">{b}</div>
              </div>
            ))}
          </div>
        </div>

        <Section id="launcher" n="01" label="The launcher">
          <Reveal>
            <h2 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight">These are renders of the actual app, not mock-ups.</h2>
            <p className="mt-4 max-w-2xl text-mute">Every image below is produced by the launcher's own UI code, rasterised headlessly by our CI. If it's on this page, it's in the app.</p>
          </Reveal>
          <Reveal className="mt-10">
            <div className="hair overflow-hidden rounded-md bg-bg1 shadow-[0_30px_80px_-40px_#2348e0]">
              <img key={shot} src={`screenshots/${SHOTS[shot][0]}.png`} alt={SHOTS[shot][1]} className="w-full" loading="lazy" />
            </div>
            <div className="mono mt-4 flex flex-wrap gap-2">
              {SHOTS.map(([, t], i) => (
                <button
                  key={t}
                  onClick={() => setShot(i)}
                  className={`rounded-[3px] border px-3 py-2 transition ${i === shot ? "border-lum bg-lum/15 text-ink" : "border-line text-mute hover:text-ink"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Reveal>
        </Section>

        <Section id="features" n="02" label="What's inside">
          <div className="border-t border-line">
            {FEATURES.map(([t, d, tag], i) => (
              <Reveal key={t}>
                <div className="grid gap-3 border-b border-line py-7 md:grid-cols-[60px_240px_1fr_150px] md:items-baseline md:gap-6">
                  <span className="mono text-lum">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-xl font-semibold tracking-tight">{t}</h3>
                  <p className="text-mute">{d}</p>
                  <span className="mono text-mute md:text-right">{tag}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <Section id="client" n="03" label="Luminos Client">
          <div className="grid gap-12 md:grid-cols-[320px_1fr]">
            <Reveal>
              <Mark src="luminos-client.svg" className="h-40 w-40" />
              <p className="mono mt-6 text-mute">Orb inside HUD brackets — the in-game half of Luminos.</p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="text-4xl font-bold leading-tight tracking-tight">A performance client you install by ticking one box.</h2>
              <p className="mt-4 max-w-xl text-mute">
                Choose “Luminos Client” in setup and the launcher builds a Fabric instance with the optimisation stack and our own HUD mod. Everything is a normal Modrinth mod, so you can see it, update it or switch it off.
              </p>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <div className="hair rounded-md p-5">
                  <div className="mono mb-4 text-lum">In-game HUD (ours)</div>
                  <ul className="space-y-2 text-[15px]">{HUD.map((h) => <li key={h} className="flex gap-3"><span className="text-lum">▪</span>{h}</li>)}</ul>
                </div>
                <div className="hair rounded-md p-5">
                  <div className="mono mb-4 text-lum">Performance stack</div>
                  <ul className="space-y-2 text-[15px]">{PERF.map((h) => <li key={h} className="flex gap-3"><span className="text-lum">▪</span>{h}</li>)}</ul>
                </div>
              </div>
            </Reveal>
          </div>
          <Reveal className="mt-16">
            <div className="mono mb-3 flex justify-between text-mute"><span>Worlds you'll play in</span><span>Art: Modrinth project galleries</span></div>
            <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-5">
              {ART.map(([f, n]) => (
                <figure key={f} className="group relative overflow-hidden bg-bg1">
                  <img src={`mc/${f}.jpg`} alt={n} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
                  <figcaption className="mono absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 text-ice">{n}</figcaption>
                </figure>
              ))}
            </div>
          </Reveal>
        </Section>

        <Section id="trust" n="04" label="Trust, honestly">
          <div className="grid gap-12 md:grid-cols-2">
            <Reveal>
              <h2 className="text-4xl font-bold leading-tight tracking-tight">Windows may say “unknown publisher”. Here is why, and how to check us.</h2>
              <p className="mt-4 text-mute">
                New, small apps haven't built reputation with Microsoft SmartScreen yet, and a code-signing certificate costs real money. Until Luminos is signed, Windows can warn about any new executable. That's a reputation warning, not a malware detection.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <ol className="space-y-5">
                {[
                  ["Built in public", "Every release is compiled by GitHub Actions from this repository, never on a personal PC."],
                  ["Verifiable", "Releases ship SHA-256 sums and a GitHub build-provenance attestation: gh attestation verify Luminos-Setup.exe -R " + REPO],
                  ["Quiet by design", "No admin rights, no services, no startup entries, no console windows. Per-user install; uninstall keeps your worlds."],
                  ["Only official sources", "Game files come from Mojang's servers, mods from Modrinth's public API. Nothing else is contacted."],
                ].map(([a, b], i) => (
                  <li key={a} className="grid grid-cols-[40px_1fr] gap-3 border-t border-line pt-5">
                    <span className="mono text-lum">{String(i + 1).padStart(2, "0")}</span>
                    <div><div className="font-semibold">{a}</div><div className="mt-1 text-[15px] text-mute break-words">{b}</div></div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </Section>

        <Section id="roadmap" n="05" label="Roadmap">
          <div className="grid gap-px bg-line md:grid-cols-3">
            {ROADMAP.map(([a, b]) => (
              <Reveal key={a} className="bg-bg1 p-7">
                <div className="mono text-lum">{a}</div>
                <p className="mt-4 text-[15px] leading-relaxed text-mute">{b}</p>
              </Reveal>
            ))}
          </div>
        </Section>

        <div className="border-t border-line bg-bg1">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-20 md:flex-row md:items-center md:justify-between">
            <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">Get Luminos. It's free.</h2>
            <div className="flex gap-3">
              <a href={SETUP} className="btn btn-primary">Download Luminos-Setup.exe</a>
              <a href={`https://github.com/${REPO}`} className="btn btn-ghost">Source</a>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mono mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-8 text-mute">
          <span className="flex items-center gap-3"><Mark className="h-5 w-5" />© 2026 Luminos. All rights reserved.</span>
          <span>Not affiliated with Mojang or Microsoft. Minecraft is their trademark.</span>
          <a className="ml-auto hover:text-ink" href={`https://github.com/${REPO}/blob/main/LICENSE`}>License</a>
        </div>
      </footer>
    </div>
  );
}
