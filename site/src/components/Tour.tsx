import { useEffect, useRef, useState } from "react";
import { Frame, SectionHead } from "./ui";
import Reveal from "./Reveal";
import home from "../assets/app-home.webp";
import library from "../assets/app-library.webp";
import livePanel from "../assets/app-live-panel.webp";
import liveDone from "../assets/app-live-done.webp";
import cosmetics from "../assets/app-cosmetics.webp";
import store from "../assets/app-store.webp";

// Skills applied (session 19): better-ui (density, grouping), accessible-animation (reduced-motion = instant swap), improve-animations; earlier: ui-ux-pro-max (one idea per step, 4.5:1 text contrast, visible focus, no motion-only state),
// reanimate (crossfade 700 ms expo-out, 14 px travel, transform+opacity only; reduced-motion = instant swap).

const steps = [
  {
    kicker: "Home",
    title: "Continue where you stopped.",
    body: "One Launch button for the last instance, a one-click preset, your last server, world and modpack, recent instances, a 14-day playtime chart and Mojang’s patch notes.",
    img: home,
    alt: "Home screen with a Launch button for Luminos 26.3, recent instances, playtime chart and patch notes.",
  },
  {
    kicker: "Library",
    title: "Mods that know about each other.",
    body: "Luminos Picks first, then popular Modrinth mods. Each card says whether our smoke test launches it (CI) or whether it is only recommended upstream (Ref), and flags conflicts, for example VulkanMod against Sodium.",
    img: library,
    alt: "Library listing Sodium, Lithium, Entity Culling and others with CI and Ref badges and a Conflicts with Sodium warning.",
  },
  {
    kicker: "Live panel · before",
    title: "Say what changes now and what waits.",
    body: "Luminos modules and resource packs switch in the running game (Live). Other mods are queued and apply on the next launch. Dependencies are listed (“needs Fabric API”, “needed by 2”).",
    img: livePanel,
    alt: "Live Mods panel with Live badges on Luminos modules and resource packs and Next launch badges on mods.",
  },
  {
    kicker: "Live panel · pending",
    title: "Review before anything moves.",
    body: "Pick up to five changes, review them, undo. Verified in a real 1.21.11 title screen on a CI runner for modules and resource packs only. The capture uses demo data and says so on screen.",
    img: liveDone,
    alt: "Live Mods panel with two pending changes marked Will turn off and a Review 2 changes button.",
  },
  {
    kicker: "Skins and locker",
    title: "Five skins, a 3D preview, a locker.",
    body: "Five original skins, a turnable 3D model with idle, walk, jump, swim and hurt, and eight locker categories. Lookups by username go to Mojang only. Luminos cosmetics are not visible to other players yet: that service is not running.",
    img: cosmetics,
    alt: "Cosmetics screen with a 3D skin preview, five skins, locker categories and a note that the Luminos cosmetics service is not running.",
  },
  {
    kicker: "Store",
    title: "Modrinth results, inside the launcher.",
    body: "Real Modrinth search with categories, installed items hidden. Game files come from Mojang, mods from Modrinth.",
    img: store,
    alt: "Store view listing real Modrinth mods with category filters.",
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
          <SectionHead eyebrow="The launcher" lead="Captured from the real interface in a browser with demo data. Not a recording of a Windows desktop.">
            Six screens do <span className="accent-word">most</span> of the work.
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
              <div className="relative aspect-[1360/820] w-full">
                {steps.map((s, i) => (
                  <div
                    key={s.kicker}
                    aria-hidden={active !== i}
                    className="tour-layer absolute inset-0 transition-[opacity,transform] duration-700 ease-[var(--ease-out-expo)]"
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
