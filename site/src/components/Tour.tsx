import { useEffect, useRef, useState } from "react";
import { Frame, SectionHead } from "./ui";
import Reveal from "./Reveal";

// Skills applied (session 19): better-ui (density, grouping), accessible-animation (reduced-motion = instant swap), improve-animations; earlier: ui-ux-pro-max (one idea per step, 4.5:1 text contrast, visible focus, no motion-only state),
// reanimate (crossfade 700 ms expo-out, 14 px travel, transform+opacity only; reduced-motion = instant swap).

const shot = (n: string) => `${import.meta.env.BASE_URL}screenshots/${n}-3.png`;
const steps = [
  { kicker: "Home", title: "Press play, or resume a world.", body: "One big Launch Game button, a version and profile picker, and your recent worlds and servers as one-click Quickplay cards. Nothing else competes for attention.", img: shot("home"), alt: "Luminos Home: a hero banner with Launch Game, then three Quickplay cards." },
  { kicker: "Mods", title: "Every module is a card with an on/off bar.", body: "Thirty-four built-in client modules in four columns: Waypoints, Minimap, Fullbright, Zoom, Freelook, Keystrokes and more. A solid blue bar means on; click a card for its settings. The performance stack is built in and always on, so it is not in the grid.", img: shot("mods"), alt: "Mods screen: a four-column grid of module cards with icons and blue on/off bars." },
  { kicker: "HUD Design Studio", title: "Drag it where you want it.", body: "Drag Keystrokes, CPS, FPS, Waypoints, Minimap and Armor Status on a live canvas. Positions snap to 5 px, and the inspector holds background, colour, shadow and visibility.", img: shot("hud-studio"), alt: "HUD Design Studio: a night scene with HUD elements and an inspector on the right." },
  { kicker: "Keybinds", title: "One key, one action.", body: "Click a key, press the new one. Hold or Toggle where it matters. Binding a key that is already taken moves it, so nothing fires twice.", img: shot("keybinds"), alt: "Keybinds screen: a list of rows with an icon, a name, a hold or toggle switch and a key cap." },
  { kicker: "Cosmetics", title: "One stage, one locker.", body: "A single 3D stage on the left and a grid of cached 2D cards on the right: twelve hand-shaded skins, wings, cloaks, emotes and pets, plus a built-in pixel editor.", img: shot("cosmetics"), alt: "Cosmetics: a 3D character stage next to a three-column grid of skin cards." },
  { kicker: "Themes", title: "Four themes. Colours only.", body: "Luminos Cobalt (Default), Luminos Obsidian, Luminos Slate and Luminos Light. A theme never moves anything; text must stay at 4.5:1 or an imported theme is refused.", img: shot("themes"), alt: "Themes screen with four miniature layout previews, an accent colour row and a gameplay preset switch." },
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
