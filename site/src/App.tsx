import { useEffect, useState } from "react";
import Dither from "./components/Dither";
import Reveal from "./components/Reveal";

const REPO = "prashantchataut/Luminos";
const RELEASES = `https://github.com/${REPO}/releases/latest`;
const SETUP = `https://github.com/${REPO}/releases/latest/download/Luminos-Setup.exe`;

const ART = [
  { f: "complementary-reimagined", n: "Complementary Reimagined", p: "complementary-reimagined" },
  { f: "solas-shader", n: "Solas Shader", p: "solas-shader" },
  { f: "better-leaves", n: "Motschen's Better Leaves", p: "better-leaves" },
  { f: "bsl-shaders", n: "BSL Shaders", p: "bsl-shaders" },
  { f: "photon-shader", n: "Photon Shaders", p: "photon-shader" },
  { f: "fabulously-optimized", n: "Fabulously Optimized", p: "fabulously-optimized" },
  { f: "rethinking-voxels", n: "Rethinking Voxels", p: "rethinking-voxels" },
  { f: "cobblemon-fabric", n: "Cobblemon", p: "cobblemon-fabric" },
  { f: "fresh-animations", n: "Fresh Animations", p: "fresh-animations" },
  { f: "bliss-shader", n: "Bliss Shaders", p: "bliss-shader" },
];

const SHOTS = [
  ["06-home", "Home"],
  ["09-discover", "Discover"],
  ["08-instance-content", "Instance content"],
  ["07-library", "Library"],
  ["11-skins-studio", "Skin studio"],
  ["12-playtime", "Playtime"],
  ["16-servers", "Servers"],
  ["17-instance-worlds", "World backups"],
  ["18-crash-doctor", "Crash doctor"],
  ["13-settings", "Settings"],
  ["01-setup-welcome", "Setup"],
  ["04-setup-client", "Setup · client"],
] as const;

const FEATURES: { t: string; d: string; tag?: string; span?: string; icon: string }[] = [
  { icon: "M4 7h16M4 12h16M4 17h10", t: "Mod library, built in", d: "Search Modrinth for mods, modpacks, shaders, resource packs and data packs. One click installs with required dependencies resolved.", tag: "Modrinth", span: "md:col-span-2" },
  { icon: "M4 12a8 8 0 0 1 14-5l2-2v6h-6l2.3-2.3A5.5 5.5 0 1 0 17.5 14", t: "Auto-update everything", d: "Update one mod or a whole instance at once, using Modrinth hash lookups. Unlink a mod to pin it forever." },
  { icon: "M5 5h14v14H5zM9 9h6v6H9z", t: "Isolated instances", d: "Every instance has its own mods, saves, configs and Java settings. Duplicate, export and never break your main world." },
  { icon: "M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z", t: "Crash doctor", d: "Reads your logs and explains out-of-memory, wrong Java, missing dependencies and bad mixins — with a one-click fix." },
  { icon: "M3 12h4l3-8 4 16 3-8h4", t: "Playtime tracking", d: "Per instance, per day. A weekly chart on your home screen shows where the hours went.", span: "md:col-span-1" },
  { icon: "M7 4h10l3 4-3 2v10H7V10L4 8z", t: "Skin studio", d: "A 64×64 pixel editor with front/back preview, slim arms, and a library you can fill from a username." },
  { icon: "M4 6h16v5H4zM4 13h16v5H4z", t: "Server hub & world backups", d: "Live server pings, one-click join, and zip backups of any world with restore and automatic pruning." },
  { icon: "M13 2L4 14h6l-1 8 9-12h-6z", t: "Smart JVM flags", d: "ZGC on Java 21+, tuned G1 on older runtimes, sensible RAM defaults. Set once, forget forever.", span: "md:col-span-2" },
];

const HUD = ["Armor HUD", "Keystrokes", "CPS counter", "FPS", "Coordinates", "Potion effects", "Toggle sprint", "Zoom", "Drag-and-drop HUD editor"];
const PERF = ["Sodium", "Lithium", "Entity Culling", "FerriteCore", "ImmediatelyFast", "Mod Menu", "…and ~25 more"];

function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return <img src="logo.svg" alt="" className={className} draggable={false} />;
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

type Rel = { tag: string; size?: number; url?: string; count?: number } | null;

function useRelease(): Rel {
  const [rel, setRel] = useState<Rel>(null);
  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        const a = (j.assets || []).find((x: { name: string }) => x.name === "Luminos-Setup.exe");
        setRel({ tag: j.tag_name, size: a?.size, url: a?.browser_download_url, count: a?.download_count });
      })
      .catch(() => {});
  }, []);
  return rel;
}

export default function App() {
  const rel = useRelease();
  const [shot, setShot] = useState(0);
  const mb = rel?.size ? `${(rel.size / 1048576).toFixed(1)} MB` : "~12 MB";
  const hasInstaller = !!rel?.url;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-bg0 text-ink">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-bg0/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-2.5 font-bold tracking-tight">
            <Logo className="h-8 w-8" /> Luminos
          </a>
          <nav className="hidden items-center gap-7 text-sm text-mute md:flex">
            <a className="hover:text-ink" href="#features">Features</a>
            <a className="hover:text-ink" href="#client">Client</a>
            <a className="hover:text-ink" href="#screens">Screens</a>
            <a className="hover:text-ink" href="#roadmap">Roadmap</a>
            <a className="hover:text-ink" href={`https://github.com/${REPO}`}>GitHub</a>
          </nav>
          <a href={hasInstaller ? SETUP : RELEASES} className="glow-btn rounded-xl bg-lum px-4 py-2 text-sm font-semibold text-white transition hover:bg-lum2">
            Download
          </a>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative isolate pt-36">
        <Dither className="absolute inset-0 -z-10 h-[1100px] w-full opacity-80" />
        <div className="absolute inset-0 -z-10 h-[1100px] bg-gradient-to-b from-transparent via-bg0/40 to-bg0" />
        <div className="mx-auto max-w-6xl px-5 text-center">
          <Reveal>
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-lum/30 bg-bg2/60 px-3.5 py-1.5 font-mono text-xs text-lum2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lum2" /> Free · Open source · Written in Rust
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mx-auto max-w-4xl text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl">
              The launcher that <span className="bg-gradient-to-r from-lum2 via-lum to-[#7a6bff] bg-clip-text text-transparent">gets out of your way.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-mute">
              Luminos is a standalone Minecraft launcher with a built-in performance client. Mods, modpacks and shaders from Modrinth, auto-updates, skins, playtime — in a single tiny native app.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a href={hasInstaller ? SETUP : RELEASES} className="glow-btn group flex items-center gap-3 rounded-2xl bg-lum px-7 py-4 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-lum2">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M3 5.5l8-1.1v7H3zm9 -1.2L21 3v8.5h-9zM3 12.5h8v7l-8-1.1zM12 12.5h9V21l-9-1.3z" /></svg>
                Download for Windows
                <span className="font-mono text-xs font-normal opacity-80">{mb}</span>
              </a>
              <a href={`https://github.com/${REPO}`} className="rounded-2xl border border-line bg-bg2/60 px-6 py-4 text-base font-semibold text-ink backdrop-blur transition hover:border-lum/60">
                View source
              </a>
            </div>
            <p className="mt-4 font-mono text-xs text-mute">
              {rel ? `${rel.tag} · ` : ""}Luminos-Setup.exe · no admin rights needed · Linux build on the releases page
            </p>
          </Reveal>
          <Reveal delay={320} className="relative mx-auto mt-16 max-w-5xl">
            <div className="absolute -inset-6 -z-10 rounded-[40px] bg-lum/20 blur-3xl" />
            <div className="animate-float overflow-hidden rounded-2xl border border-lum/25 bg-bg1 shadow-[0_40px_120px_-30px_rgba(79,140,255,.65)]">
              <img src="screenshots/06-home.png" alt="Luminos home screen" className="w-full" loading="eager" />
            </div>
            <p className="mt-3 font-mono text-[11px] text-mute">Real render of the launcher UI — generated from the actual Rust code by <code>luminos-shots</code>.</p>
          </Reveal>
        </div>
      </section>

      {/* GALLERY MARQUEE */}
      <section className="relative mt-24">
        <Reveal className="mx-auto max-w-6xl px-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-lum2">Everything on Modrinth</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">Shaders, packs and worlds — one click away.</h2>
          <p className="mt-4 max-w-xl text-mute">Luminos talks to the Modrinth API directly, so everything you install is legal, hosted by its authors and kept up to date. These screenshots are from popular projects you can install in seconds.</p>
        </Reveal>
        <div className="dither-edge mt-10 overflow-hidden">
          <div className="animate-marquee flex w-max gap-4 px-2">
            {[...ART, ...ART].map((a, i) => (
              <a key={i} href={`https://modrinth.com/project/${a.p}`} target="_blank" rel="noreferrer" className="group relative block h-60 w-[26rem] shrink-0 overflow-hidden rounded-2xl border border-white/10">
                <img src={`mc/${a.f}.jpg`} alt={a.n} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg0/90 to-transparent p-3 pt-10 text-sm font-semibold">{a.n}</div>
              </a>
            ))}
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-6xl px-5 font-mono text-[11px] text-mute">Screenshots © their respective authors, shown from Modrinth galleries — click any image to visit the project. Luminos is not affiliated with Mojang or Microsoft.</p>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto mt-32 max-w-6xl px-5">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-lum2">Quality of life</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">Built by a player who grew up with launchers.</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={i * 50} className={f.span ?? ""}>
              <div className="card group h-full p-6 transition hover:-translate-y-1 hover:border-lum/50">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-lum/15 text-lum2 ring-1 ring-lum/30"><Icon d={f.icon} /></div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">{f.t}{f.tag && <span className="rounded-full bg-lum/20 px-2 py-0.5 font-mono text-[10px] text-lum2">{f.tag}</span>}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mute">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CLIENT */}
      <section id="client" className="relative mx-auto mt-32 max-w-6xl px-5">
        <div className="card relative overflow-hidden p-8 sm:p-12">
          <Dither className="absolute inset-0 -z-0 h-full w-full opacity-30" cell={8} />
          <div className="relative grid gap-10 md:grid-cols-2">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-lum2">Luminos Client</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A performance client, not another launcher skin.</h2>
              <p className="mt-4 text-mute">Like Lunar or Feather, the client is bundled with the launcher: pick “Luminos Client” and the launcher builds a Fabric instance with an optimisation stack and a first-party HUD mod — then keeps all of it updated.</p>
              <p className="mt-3 text-sm text-mute">Status: the HUD mod compiles and ships through CI; in-game verification is the first task of the next session.</p>
            </Reveal>
            <Reveal delay={100} className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink">Built-in HUD modules</h3>
                <div className="flex flex-wrap gap-2">{HUD.map((m) => <span key={m} className="rounded-lg border border-lum/25 bg-bg1/80 px-3 py-1.5 text-sm">{m}</span>)}</div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink">Optimisation stack</h3>
                <div className="flex flex-wrap gap-2">{PERF.map((m) => <span key={m} className="rounded-lg border border-white/10 bg-bg1/80 px-3 py-1.5 font-mono text-xs text-mute">{m}</span>)}</div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SCREENS */}
      <section id="screens" className="mx-auto mt-32 max-w-6xl px-5">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-lum2">Screens</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">See every corner of it.</h2>
        </Reveal>
        <Reveal className="mt-8">
          <div className="flex flex-wrap gap-2">
            {SHOTS.map(([, label], i) => (
              <button key={label} onClick={() => setShot(i)} className={`rounded-full border px-4 py-1.5 text-sm transition ${i === shot ? "border-lum bg-lum/20 text-white" : "border-line text-mute hover:border-lum/50 hover:text-ink"}`}>{label}</button>
            ))}
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-lum/20 bg-bg1 shadow-[0_30px_100px_-40px_rgba(79,140,255,.6)]">
            <img key={shot} src={`screenshots/${SHOTS[shot][0]}.png`} alt={SHOTS[shot][1]} className="w-full animate-[fade_.4s_ease]" loading="lazy" />
          </div>
        </Reveal>
      </section>

      {/* ROADMAP */}
      <section id="roadmap" className="mx-auto mt-32 max-w-6xl px-5">
        <Reveal><h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Honest status.</h2></Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { h: "Works today", c: "text-emerald-300", items: ["Fabric, Quilt and Vanilla launching", "Modrinth search, install, update, unlink", "Skins, playtime, world backups, crash doctor", "Server list with live ping", ".mrpack modpack import"] },
            { h: "In progress", c: "text-amber-300", items: ["Microsoft sign-in (engine written, needs wiring)", "In-game verification of the HUD mod", "Forge & NeoForge installers", "Launcher self-update"] },
            { h: "Planned", c: "text-lum2", items: ["CurseForge source", ".mrpack export", "Discord Rich Presence", "macOS build and signed installers", "Cosmetics & capes marketplace (cosmetic-only)"] },
          ].map((col, i) => (
            <Reveal key={col.h} delay={i * 80}>
              <div className="card h-full p-6">
                <h3 className={`font-mono text-xs uppercase tracking-[0.18em] ${col.c}`}>{col.h}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-mute">{col.items.map((x) => <li key={x} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-lum" />{x}</li>)}</ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto my-32 max-w-4xl px-5 text-center">
        <Reveal>
          <Logo className="mx-auto h-20 w-20 drop-shadow-[0_0_40px_rgba(79,140,255,.7)]" />
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">Light up your launcher.</h2>
          <p className="mx-auto mt-4 max-w-xl text-mute">Free forever. Open source under GPL-3.0. Your instances stay in your own folder — uninstalling never touches your worlds.</p>
          <a href={hasInstaller ? SETUP : RELEASES} className="glow-btn mt-8 inline-flex items-center gap-3 rounded-2xl bg-lum px-8 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-lum2">
            Download Luminos-Setup.exe <span className="font-mono text-xs font-normal opacity-80">{mb}</span>
          </a>
        </Reveal>
      </section>

      <footer className="border-t border-white/5 py-10 text-center font-mono text-[11px] leading-relaxed text-mute">
        <p>Luminos is an independent project. Not affiliated with, endorsed by, or sponsored by Mojang Studios or Microsoft. “Minecraft” is a trademark of Mojang Synergies AB.</p>
        <p className="mt-1">Mod, pack and shader data is served by the <a className="text-lum2 underline" href="https://modrinth.com">Modrinth</a> API. Gallery images belong to their authors.</p>
        <p className="mt-3"><a className="text-lum2" href={`https://github.com/${REPO}`}>GitHub</a> · GPL-3.0-or-later</p>
      </footer>
    </div>
  );
}
