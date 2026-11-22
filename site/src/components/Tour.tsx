import { useEffect, useRef, useState } from "react";
import { Frame, SectionHead } from "./ui";
import Reveal from "./Reveal";
import setup from "../assets/01-setup-welcome.webp";
import discover from "../assets/09-discover.webp";
import skins from "../assets/11-skins-studio.webp";
import crash from "../assets/18-crash-doctor.webp";
import playtime from "../assets/12-playtime.webp";

// Skills applied: ui-ux-pro-max (one idea per step, 4.5:1 text contrast, visible focus, no motion-only state),
// reanimate (crossfade 700 ms expo-out, 14 px travel, transform+opacity only; reduced-motion = instant swap).

const steps = [
  {
    kicker: "First run",
    title: "Four screens, then you’re in.",
    body: "Profile, Java and memory, client choice, install. Luminos reads your RAM, finds a Java that fits the version or downloads Temurin from Adoptium, and shows what it’s about to do before it does it.",
    img: setup,
    alt: "Luminos setup welcome screen with a dithered pixel moon and a Set up Luminos button.",
  },
  {
    kicker: "Mods",
    title: "Search Modrinth without the browser.",
    body: "Pick an instance, hit install. Required dependencies come along. Mods can be switched off, unlinked from updates, or updated all at once with one hash lookup.",
    img: discover,
    alt: "Discover page listing Modrinth projects with filters and install buttons.",
  },
  {
    kicker: "Skins",
    title: "Fetch a skin, or paint your own.",
    body: "Grab any player’s skin by name, or edit a 64×64 canvas with pencil, fill, picker and undo. Front and back preview, slim or classic arms.",
    img: skins,
    alt: "Skin studio with a 64 by 64 pixel canvas, tools and a front and back preview.",
  },
  {
    kicker: "Crash doctor",
    title: "When the game dies, you get the reason.",
    body: "Luminos reads the crash log and says what happened in plain words: out of memory, wrong Java, missing dependency, a mod that doesn’t fit, a GPU driver. Out of memory comes with a one-click “Give 6 GB”.",
    img: crash,
    alt: "Crash doctor panel diagnosing a crash log.",
  },
  {
    kicker: "Playtime",
    title: "Know where the hours went.",
    body: "Per instance and in total, with a seven-day chart. It only counts time the game process is actually running.",
    img: playtime,
    alt: "Playtime page with a weekly chart.",
  },
];

export default function Tour() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="tour" className="relative scroll-mt-20 py-24 md:py-36">
      <div className="mx-auto max-w-[1240px] px-6 md:px-10">
        <Reveal>
          <SectionHead eyebrow="The launcher" lead="These are renders of the real interface, not mockups.">
            Five screens do <span className="accent-word">most</span> of the work.
          </SectionHead>
        </Reveal>

        <div className="mt-16 grid gap-x-16 lg:mt-24 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <ol className="m-0 list-none p-0">
            {steps.map((s, i) => (
              <li
                key={s.kicker}
                data-i={i}
                ref={(el) => {
                  refs.current[i] = el as HTMLDivElement | null;
                }}
                className="flex flex-col justify-center py-10 transition-opacity duration-700 lg:min-h-[74vh] lg:py-16"
                style={{ opacity: undefined }}
              >
                <div className={`transition-opacity duration-700 ${active === i ? "lg:opacity-100" : "lg:opacity-35"}`}>
                  <p className="font-mono text-xs tabular-nums tracking-widest text-accent">
                    {String(i + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                  </p>
                  <p className="eyebrow mt-3">{s.kicker}</p>
                  <h3 className="display mt-4 text-[clamp(1.9rem,3.2vw,2.6rem)]">{s.title}</h3>
                  <p className="mt-5 text-base leading-relaxed text-mute">{s.body}</p>
                </div>
                <div className="mt-8 lg:hidden">
                  <Frame src={s.img} alt={s.alt} />
                </div>
              </li>
            ))}
          </ol>

          <div className="hidden lg:block">
            <div className="sticky top-[max(6.5rem,calc(50vh-17rem))]">
              <div className="relative aspect-[16/10] w-full">
                {steps.map((s, i) => (
                  <div
                    key={s.kicker}
                    aria-hidden={active !== i}
                    className="absolute inset-0 transition-[opacity,transform] duration-700 ease-[var(--ease-out-expo)]"
                    style={{
                      opacity: active === i ? 1 : 0,
                      transform: active === i ? "none" : `translateY(${i < active ? -14 : 14}px) scale(0.985)`,
                    }}
                  >
                    <Frame src={s.img} alt={s.alt} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
