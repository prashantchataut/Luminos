import DitherBackground from "@/components/DitherBackground";
import Gallery from "@/components/Gallery";
import Reveal from "@/components/Reveal";
import { CLIENT_MODS, FEATURES, REPO, ROADMAP, shot, type Status } from "@/lib/site";

const STATUS: Record<Status, { label: string; cls: string }> = {
  live: { label: "Working", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" },
  preview: { label: "Preview", cls: "border-sky-400/40 bg-sky-400/10 text-sky-300" },
  planned: { label: "Planned", cls: "border-slate-400/30 bg-slate-400/10 text-slate-300" },
};

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <polygon points="16,2 28,9 16,16 4,9" fill="#b9d3ff" />
      <polygon points="4,9 16,16 16,30 4,23" fill="#4f8cff" />
      <polygon points="28,9 28,23 16,30 16,16" fill="#2c4f9c" />
    </svg>
  );
}

function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#4f8cff]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{title}</h2>
      {sub && <p className="mt-4 text-lg text-[#8596c5]">{sub}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <DitherBackground />
      <header className="sticky top-0 z-30 border-b border-[#213060]/60 bg-[#050816]/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="#top" className="flex items-center gap-2.5 text-lg font-bold">
            <Logo /> Luminos
            <span className="rounded-full border border-[#4f8cff]/50 bg-[#4f8cff]/15 px-2 py-0.5 font-mono text-[10px] text-[#9bbcff]">v0.1 beta</span>
          </a>
          <div className="hidden items-center gap-7 text-sm font-semibold text-[#8596c5] md:flex">
            <a className="hover:text-white" href="#features">Features</a>
            <a className="hover:text-white" href="#screens">Screens</a>
            <a className="hover:text-white" href="#client">Luminos Client</a>
            <a className="hover:text-white" href="#roadmap">Roadmap</a>
          </div>
          <a href={REPO} className="rounded-xl border border-[#213060] bg-[#0f1734]/80 px-4 py-2 text-sm font-bold transition hover:border-[#4f8cff]">GitHub</a>
        </nav>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="relative mx-auto max-w-6xl px-5 pb-10 pt-16 text-center sm:pt-24">
          <Reveal>
            <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#4f8cff]/40 bg-[#0f1734]/70 px-4 py-1.5 font-mono text-xs text-[#9bbcff]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Foundation build · 100% Rust · open source
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl">
              The Minecraft launcher,
              <br />
              <span className="text-shimmer">rebuilt in Rust.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-[#a9b8e0] sm:text-xl">
              Built-in mod library with auto-updates, isolated instances, playtime tracking, a skin studio and a one-click optimised client — in a tiny native app that feels like it was designed on purpose.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <a href={`${REPO}/releases`} className="rounded-2xl bg-[#4f8cff] px-8 py-4 text-base font-bold text-white shadow-[0_10px_40px_-8px_rgba(79,140,255,0.8)] transition hover:-translate-y-0.5 hover:bg-[#6a9eff]">
                Download Luminos
              </a>
              <a href="#screens" className="rounded-2xl border border-[#213060] bg-[#0f1734]/70 px-8 py-4 text-base font-bold transition hover:border-[#4f8cff]">
                See every screen
              </a>
            </div>
            <p className="mt-4 text-sm text-[#6e7fb0]">Windows · macOS · Linux — build from source today, installers coming.</p>
          </Reveal>
          <Reveal delay={320} className="relative mx-auto mt-14 max-w-5xl">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[#4f8cff]/20 blur-3xl" />
            <div className="animate-floaty overflow-hidden rounded-2xl border border-[#2a3c78] bg-[#050816] shadow-[0_40px_120px_-20px_rgba(47,107,255,0.6)] [animation:floaty_9s_ease-in-out_infinite]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot("06-home")} alt="Luminos Launcher home screen" className="block w-full" />
            </div>
          </Reveal>
        </section>

        <div className="dither-rule mx-auto my-16 max-w-4xl" />

        {/* STATS */}
        <section className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-5 sm:grid-cols-4">
          {[
            ["≈ 11 MB", "release binary"],
            ["0", "webviews or Electron"],
            ["30", "vetted client mods"],
            ["15", "screens, rendered from real code"],
          ].map(([a, b], i) => (
            <Reveal key={b} delay={i * 70}>
              <div className="rounded-2xl border border-[#213060] bg-[#090e22]/80 p-5 text-center">
                <div className="text-3xl font-bold text-white">{a}</div>
                <div className="mt-1 text-sm text-[#8596c5]">{b}</div>
              </div>
            </Reveal>
          ))}
        </section>

        {/* FEATURES */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
          <SectionTitle eyebrow="Features" title="Everything a launcher should do." sub="With honest status labels — we only say “Working” when it is verified." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80}>
                <article className="group h-full rounded-2xl border border-[#213060] bg-[#090e22]/80 p-6 transition duration-300 hover:-translate-y-1 hover:border-[#4f8cff]/70 hover:bg-[#0c1330]">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#2563eb] to-[#22d3ee] text-xl text-white shadow-lg shadow-blue-900/50">{f.icon}</span>
                    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${STATUS[f.status].cls}`}>{STATUS[f.status].label}</span>
                  </div>
                  <h3 className="text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#8596c5]">{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* GALLERY */}
        <section id="screens" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-28">
          <SectionTitle eyebrow="Screens" title="Real renders, not mock-ups." sub="Every image below is produced by the launcher's own UI code through a headless software renderer." />
          <Reveal>
            <Gallery />
          </Reveal>
        </section>

        {/* CLIENT */}
        <section id="client" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-28">
          <SectionTitle eyebrow="Luminos Client" title="Fast out of the box." sub="One click gives you a tuned Fabric instance with the best open-source optimisation and HUD mods. Everything is installed from Modrinth — nothing is bundled or redistributed." />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CLIENT_MODS.map((g, i) => (
              <Reveal key={g.group} delay={i * 70}>
                <div className="h-full rounded-2xl border border-[#213060] bg-[#090e22]/80 p-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-[#4f8cff]">{g.group}</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {g.mods.map((m) => (
                      <span key={m} className="rounded-full border border-[#213060] bg-[#0f1734] px-3 py-1 text-sm text-[#cdd8ff]">{m}</span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
            <Reveal delay={350}>
              <div className="h-full rounded-2xl border border-dashed border-[#4f8cff]/50 bg-[#4f8cff]/5 p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-[#9bbcff]">Coming next</h3>
                <p className="mt-4 text-[15px] leading-relaxed text-[#a9b8e0]">
                  A first-party Luminos Client mod: keystrokes, CPS, potion and durability HUDs, toggle sprint, freelook, and a drag-and-drop HUD editor opened from Mod Menu.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ROADMAP */}
        <section id="roadmap" className="mx-auto max-w-5xl scroll-mt-20 px-5 pb-28">
          <SectionTitle eyebrow="Roadmap" title="Built in public, session by session." />
          <ol className="relative space-y-6 border-l border-[#213060] pl-8">
            {ROADMAP.map((r, i) => (
              <Reveal key={r.title} delay={i * 80}>
                <li className="relative">
                  <span className={`absolute -left-[41px] top-1.5 h-4 w-4 rounded-sm ${r.state === "done" ? "bg-emerald-400" : r.state === "next" ? "bg-[#4f8cff]" : "bg-[#213060]"}`} />
                  <p className="font-mono text-xs uppercase tracking-widest text-[#8596c5]">{r.phase}</p>
                  <h3 className="mt-1 text-xl font-bold">{r.title}</h3>
                  <ul className="mt-3 grid gap-x-8 gap-y-1.5 text-[15px] text-[#a9b8e0] sm:grid-cols-2">
                    {r.items.map((it) => (
                      <li key={it} className="flex gap-2">
                        <span className="text-[#4f8cff]">▸</span>
                        {it}
                      </li>
                    ))}
                  </ul>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-5 pb-28 text-center">
          <Reveal>
            <div className="rounded-3xl border border-[#2a3c78] bg-gradient-to-b from-[#0f1734]/90 to-[#090e22]/90 p-10 sm:p-14">
              <Logo size={56} />
              <h2 className="mt-5 text-3xl font-bold sm:text-5xl">Help make it the best launcher out there.</h2>
              <p className="mx-auto mt-4 max-w-xl text-[#8596c5]">Luminos is open source. Try it, break it, send a PR. Every session is logged in CONTINUITY.md so anyone can pick up where we left off.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <a href={REPO} className="rounded-2xl bg-[#4f8cff] px-7 py-3.5 font-bold transition hover:bg-[#6a9eff]">Star on GitHub</a>
                <a href={`${REPO}/blob/main/CONTINUITY.md`} className="rounded-2xl border border-[#213060] px-7 py-3.5 font-bold transition hover:border-[#4f8cff]">Read the progress log</a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[#213060]/70 bg-[#050816]/80 px-5 py-10 text-center text-sm text-[#6e7fb0]">
        <p>Luminos Launcher is an independent open-source project. Not affiliated with, endorsed by, or associated with Mojang Studios or Microsoft. Minecraft is a trademark of Mojang Synergies AB. Luminos never distributes game files — they are downloaded from Mojang&apos;s servers on your machine. Please support the game by buying it.</p>
        <p className="mt-3">Fonts: Inter &amp; JetBrains Mono (SIL OFL).</p>
      </footer>
    </>
  );
}
