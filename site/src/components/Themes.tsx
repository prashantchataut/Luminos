import Reveal from "./Reveal";
import { Frame, SectionHead } from "./ui";

// Skills applied (session 19): better-ui (equal-weight grouping, one caption per image), impeccable / taste-skill (no decorative filler).
const themes = [
  { name: "Luminos Cobalt (Default)", img: `${import.meta.env.BASE_URL}screenshots/themes-3.png`, note: "Carbon navy, cobalt accent." },
  { name: "Luminos Slate", img: `${import.meta.env.BASE_URL}screenshots/themes-minecraft-3.png`, note: "Slate surfaces, grass-green accent." },
  { name: "Luminos Light", img: `${import.meta.env.BASE_URL}screenshots/themes-light-3.png`, note: "Light surfaces, the same layout." },
];

export default function Themes() {
  return (
    <section id="themes" className="relative scroll-mt-20 py-24 md:py-32" aria-labelledby="themes-h">
      <div className="mx-auto max-w-[1240px] px-6 md:px-10">
        <Reveal>
          <SectionHead
            eyebrow="Themes"
            lead="A theme changes surfaces, text and accent colour only. A test fails if a theme file holds anything but colours or misses WCAG AA 4.5:1 text contrast, and a CI job fails if the layout differs between themes."
          >
            <span id="themes-h">Three themes, one </span>
            <span className="accent-word">layout</span>.
          </SectionHead>
        </Reveal>
        <ul className="mt-14 grid list-none gap-6 p-0 lg:grid-cols-3">
          {themes.map((t, i) => (
            <li key={t.name}>
              <Reveal delay={i}>
                <figure className="m-0">
                  <Frame src={t.img} alt={`Live Mods panel in the ${t.name} theme.`} />
                  <figcaption className="mt-4 text-sm">
                    <span className="font-medium text-fg">{t.name}</span>
                    <span className="block text-mute">{t.note}</span>
                  </figcaption>
                </figure>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
