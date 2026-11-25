import Sky from "./Sky";
import Reveal from "./Reveal";
import { DownloadCTA, Frame, Sparkle } from "./ui";
import type { ReleaseState } from "../lib/useRelease";
const home = `${import.meta.env.BASE_URL}screenshots/home-3.png`;

// Skills applied here
//  taste-skill: one serif display + one sans, one accent word, no emoji, plain copy, real product UI in the frame.
//  Designfly ref: near-black -> navy, soft clouds low, sparkle by the accent word, muted subcopy, pill buttons.
//  Runcycle ref: white pill primary + ghost secondary, light/muted split headline.
//  reanimate: staggered rise (110 ms steps), expo-out easing, transform+opacity+blur only, reduced-motion = static.

export default function Hero({ release }: { release: ReleaseState }) {
  return (
    <>
      <section className="relative isolate min-h-[100svh] overflow-hidden bg-ink-1">
        <Sky variant="hero" moon />
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col items-center px-6 pt-[17vh] text-center">
          <p className="eyebrow rise" style={{ ["--d" as string]: 0 }}>
            Minecraft Java launcher · Windows · Android preview
          </p>
          <h1 className="display mt-7 text-[clamp(3rem,6.6vw,6.4rem)]">
            <span className="rise inline-block" style={{ ["--d" as string]: 1 }}>
              Minecraft,
            </span>{" "}
            <span className="rise inline-block text-white/60" style={{ ["--d" as string]: 2 }}>
              minus the
            </span>{" "}
            <span className="rise relative inline-block" style={{ ["--d" as string]: 3 }}>
              <span className="accent-word">wait</span>
              <Sparkle className="sparkle absolute -right-7 -top-2 h-6 w-6 text-white md:-right-10 md:-top-3 md:h-8 md:w-8" />
            </span>
            <span className="rise inline-block" style={{ ["--d" as string]: 3 }}>
              .
            </span>
          </h1>
          <p
            className="rise mt-8 max-w-xl text-[1.0625rem] leading-relaxed text-mute md:text-lg"
            style={{ ["--d" as string]: 4 }}
          >
            Luminos is a small launcher with a performance client built in. Pick a version, press
            play. Game files come from Mojang, mods from Modrinth.
          </p>
          <div className="rise mt-10" style={{ ["--d" as string]: 5 }}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a className="btn btn-primary" href="#download">
                Download
              </a>
              <a className="btn btn-ghost" href="#tour">
                See it running
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 -mt-[17vh] px-4 pb-8 md:px-10" aria-label="Launcher home screen">
        <div className="rise mx-auto max-w-[1180px]" style={{ ["--d" as string]: 6 }}>
          <Frame src={home} alt="Luminos home screen: Continue playing with a Launch button for Luminos 26.3, last server, world and modpack tiles, recent instances, a 14-day playtime chart and Mojang patch notes." priority />
          <p className="mx-auto mt-5 max-w-2xl text-center text-[0.8125rem] leading-relaxed text-mute">
            The launcher’s own interface, captured in a browser by tools/shots-s19.mjs. The account, instances,
            playtime and news are demo data. It has not been run on a real Windows desktop yet.
          </p>
        </div>
        <div className="mx-auto mt-14 flex max-w-xl justify-center">
          <Reveal delay={1}>
            <DownloadCTA release={release} />
          </Reveal>
        </div>
      </section>
    </>
  );
}
