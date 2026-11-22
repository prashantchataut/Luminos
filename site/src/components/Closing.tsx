import Sky from "./Sky";
import Reveal from "./Reveal";
import { DownloadCTA, SectionHead, Sparkle, Wordmark } from "./ui";
import { REPO_URL, RELEASES_URL, type ReleaseState } from "../lib/useRelease";

// Skills applied: Designfly closing ref (near-black into navy, bright clouds low, centred serif headline with one accent word,
// sparkle, muted subcopy), ui-ux-pro-max (footer text is dark ink on light cloud for contrast, in a frosted pill).

/* ----------------------------------------------------------------- changelog */
const log = [
  {
    v: "0.3.0",
    items: [
      "Fixed Minecraft not starting: Fabric plus vanilla pulled in two ASM versions and Fabric Loader aborted. Libraries are de-duplicated now, with a test.",
      "Fixed the console flashing 8–10 times: every child process starts with CREATE_NO_WINDOW. Added a single-instance lock so double-clicks don’t stack windows.",
      "Java that doesn’t fit the version (Java 8 for 1.21, for example) is no longer accepted.",
      "New logo, new interface, new first-run screens.",
      "Licence changed from GPL to a proprietary, source-available one.",
    ],
  },
  {
    v: "0.2.0",
    items: [
      "Added the server list, world backups and the crash doctor.",
      "First version of Luminos Client: HUD editor, keystrokes, CPS, coordinates and more.",
    ],
  },
];

export function Changelog() {
  return (
    <section id="changelog" className="relative scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Reveal>
          <SectionHead eyebrow="Changelog">
            What changed, in <span className="accent-word">order</span>.
          </SectionHead>
        </Reveal>
        <div className="mt-14 space-y-12">
          {log.map((l) => (
            <Reveal key={l.v} className="grid gap-4 border-t border-line pt-8 md:grid-cols-[160px_1fr]">
              <h3 className="font-mono text-sm tabular-nums text-accent">v{l.v}</h3>
              <ul className="m-0 list-none space-y-3 p-0">
                {l.items.map((t) => (
                  <li key={t} className="text-[0.9375rem] leading-relaxed text-mute">
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- FAQ */
const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "Windows says “unknown publisher”. Is it safe?",
    a: (
      <>
        <p>
          The installer isn’t code-signed yet, and SmartScreen warns on any new unsigned program. That’s the whole
          reason for the warning. It isn’t a verdict on what the file does.
        </p>
        <p className="mt-3">
          What you can check: the source is on GitHub, every release is built by GitHub Actions, and each one carries a
          SHA-256 file. In PowerShell,{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-[0.85em] text-fg">
            Get-FileHash Luminos-Setup.exe
          </code>{" "}
          should match it. Signing needs a paid certificate, and even then a new publisher needs time to build
          reputation.
        </p>
      </>
    ),
  },
  {
    q: "Is Luminos a mod?",
    a: "No. It’s a desktop program written in Rust that downloads and starts Minecraft. Luminos Client is a separate Fabric mod it can install for you.",
  },
  {
    q: "Do I need to own Minecraft?",
    a: "To play online, yes. Luminos can’t get you onto an online-mode server without a Mojang or Microsoft account. Offline profiles run the game locally, for singleplayer, LAN and servers that run in offline mode. Microsoft sign-in isn’t connected yet.",
  },
  {
    q: "Where do the game and mods come from?",
    a: "Game files come from Mojang’s official servers, mods from Modrinth’s public API, Java from Adoptium. Luminos contains no Minecraft code or assets.",
  },
  {
    q: "What does it send, and to whom?",
    a: "It talks to Mojang, Fabric and Quilt metadata servers, Modrinth, Adoptium, GitHub (for releases) and the skin services Minotar and MC-Heads when you ask for a skin. There’s no Luminos account and no telemetry code in the launcher. The privacy page lists the hosts.",
  },
  {
    q: "Does it run Forge or NeoForge?",
    a: "Not yet. Vanilla, Fabric and Quilt do.",
  },
  {
    q: "Is it open source?",
    a: "You can read the source. It isn’t open source: the licence is all rights reserved, with free personal use of the official builds. A public repository can still be forked on GitHub under GitHub’s terms, which is a limit of GitHub rather than something this licence can stop.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="relative scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-[900px] px-6 md:px-10">
        <Reveal>
          <SectionHead eyebrow="FAQ">
            Questions people <span className="accent-word">ask</span>.
          </SectionHead>
        </Reveal>
        <div className="mt-12 divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[1.0625rem] font-medium text-fg [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden="true"
                  className="relative h-3.5 w-3.5 shrink-0 text-mute transition-transform duration-500 ease-[var(--ease-out-expo)] group-open:rotate-45"
                >
                  <span className="absolute left-0 top-1/2 h-px w-full bg-current" />
                  <span className="absolute left-1/2 top-0 h-full w-px bg-current" />
                </span>
              </summary>
              <div className="pb-6 pr-10 text-[0.9375rem] leading-relaxed text-mute">{typeof f.a === "string" ? <p>{f.a}</p> : f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ download + foot */
export function Closing({ release }: { release: ReleaseState }) {
  return (
    <section id="download" className="relative isolate scroll-mt-0 overflow-hidden bg-ink-1">
      <Sky variant="closing" />
      <div className="relative z-10 mx-auto flex min-h-[112svh] max-w-4xl flex-col items-center px-6 pt-[14vh] text-center md:pt-[16vh]">
        <Reveal>
          <h2 className="display text-[clamp(2.8rem,7.4vw,5.8rem)]">
            Pick it up{" "}
            <span className="relative inline-block">
              <span className="accent-word">tonight</span>
              <Sparkle className="sparkle absolute -right-7 -top-2 h-6 w-6 text-white md:-right-9 md:h-7 md:w-7" />
            </span>
            .
          </h2>
        </Reveal>
        <Reveal delay={1}>
          <p className="mx-auto mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-mute">
            Windows 10 or 11, 64-bit. Java is fetched for you if your machine doesn’t have a fitting one.
          </p>
        </Reveal>
        <Reveal delay={2} className="mt-10">
          <DownloadCTA release={release} />
        </Reveal>

        <footer className="mt-auto w-full pb-8 pt-40">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 rounded-3xl bg-white/85 px-6 py-6 text-[#06143a] backdrop-blur-md">
            <span className="text-[#06143a]">
              <Wordmark />
            </span>
            <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
              {[
                ["Privacy", "#/privacy"],
                ["License", "#/license"],
                ["Source", REPO_URL],
                ["Releases", RELEASES_URL],
              ].map(([t, h]) => (
                <a key={t} href={h} className="underline decoration-[#06143a]/25 underline-offset-4 hover:decoration-[#06143a]">
                  {t}
                </a>
              ))}
            </nav>
            <p className="max-w-md text-xs leading-relaxed text-[#06143a]">
              Luminos is not affiliated with Mojang or Microsoft. Minecraft is a trademark of Mojang AB.
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
}
