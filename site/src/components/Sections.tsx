import Reveal from "./Reveal";
import { SectionHead } from "./ui";
import clientMark from "../assets/luminos-client.svg";
import iris from "../assets/iris.jpg";
import bliss from "../assets/bliss-shader.jpg";
import complementary from "../assets/complementary-reimagined.jpg";
import fo from "../assets/fabulously-optimized.jpg";

// Skills applied: taste-skill (plain copy, status written down instead of marketing filler),
// ui-ux-pro-max (status never relies on colour alone: every badge has a word).

/* ------------------------------------------------------------------ features */
type Status = "Verified" | "Built";
const rows: { name: string; text: string; status: Status }[] = [
  {
    name: "Vanilla and Fabric launch",
    text: "Vanilla 1.21.4 and Fabric 1.21.4 with the full Luminos preset boot to graphics init. Run headless on Linux with a real JVM.",
    status: "Verified",
  },
  {
    name: "Crash doctor",
    text: "Reads logs for out of memory, wrong Java, missing dependency, mixin owner and GPU driver. Five unit tests.",
    status: "Verified",
  },
  {
    name: "World backups",
    text: "Zip, list, prune and restore, with path-traversal checks. Round trip is a test.",
    status: "Verified",
  },
  {
    name: "Server list",
    text: "Server List Ping written from scratch. Checked live against a public server.",
    status: "Verified",
  },
  {
    name: "Mod library",
    text: "Modrinth search, required dependencies, toggle, unlink, update all, .mrpack import.",
    status: "Built",
  },
  {
    name: "Java management",
    text: "Finds a compatible runtime, refuses Java 8 for 1.21, downloads Temurin if none fits.",
    status: "Built",
  },
  {
    name: "Quilt",
    text: "Profile resolves and launches through the same path as Fabric.",
    status: "Built",
  },
  {
    name: "Playtime and skins",
    text: "Per-instance playtime with a weekly chart. Skin studio with username fetch.",
    status: "Built",
  },
];

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 py-24 md:py-36">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Reveal>
          <SectionHead
            eyebrow="What’s in it"
            lead={
              <>
                <strong className="font-medium text-fg">Verified</strong> means we ran it for real or a test covers it.{" "}
                <strong className="font-medium text-fg">Built</strong> means it’s written and compiles, but nobody has
                tried it on a clean Windows machine yet.
              </>
            }
          >
            Plain list, and how <span className="accent-word">sure</span> we are.
          </SectionHead>
        </Reveal>
        <ul className="mt-14 divide-y divide-line border-y border-line">
          {rows.map((r, i) => (
            <Reveal as="li" key={r.name} delay={i % 4} className="grid items-baseline gap-x-8 gap-y-2 py-6 md:grid-cols-[240px_1fr_96px]">
              <span className="text-base font-medium text-fg">{r.name}</span>
              <span className="text-[0.9375rem] leading-relaxed text-mute">{r.text}</span>
              <span
                className={`inline-flex w-fit items-center gap-2 text-xs font-medium tracking-wide md:justify-self-end ${
                  r.status === "Verified" ? "text-accent" : "text-mute"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${r.status === "Verified" ? "bg-accent" : "border border-mute"}`}
                />
                {r.status}
              </span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- client */
const modules = [
  "Armor HUD",
  "Keystrokes",
  "CPS",
  "FPS",
  "Coordinates",
  "Potion effects",
  "Toggle sprint",
  "Zoom",
];

export function Client() {
  return (
    <section id="client" className="relative scroll-mt-20 overflow-hidden py-24 md:py-36">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(52,100,255,0.18),transparent)]" />
      <div className="relative mx-auto grid max-w-[1100px] items-center gap-16 px-6 md:px-10 lg:grid-cols-[1fr_380px]">
        <div>
          <Reveal>
            <SectionHead
              eyebrow="Luminos Client"
              lead="It’s a Fabric mod the launcher installs with a preset of performance mods from Modrinth, Sodium, Lithium and Entity Culling among them. No fork, no patched jar. Remove it and you’re back to vanilla."
            >
              A <span className="accent-word">Fabric</span> mod, not a fork.
            </SectionHead>
          </Reveal>
          <Reveal delay={1}>
            <ul className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
              {modules.map((m) => (
                <li key={m} className="bg-ink-1 px-4 py-5 text-sm text-fg">
                  {m}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-mute">
              Every HUD element moves in the drag-and-drop editor. Press Right Shift in game, or open it from Mod Menu.
            </p>
          </Reveal>
          <Reveal delay={2}>
            <div className="mt-8 rounded-2xl border border-line bg-white/[0.02] p-5">
              <p className="eyebrow">Status, honestly</p>
              <p className="mt-3 text-sm leading-relaxed text-mute">
                The mod compiles and the game boots with it on 1.21.4. We haven’t captured the HUD in a real window yet,
                so there’s no in-game screenshot here. The jar is built for Minecraft 1.21.4 only.
              </p>
            </div>
          </Reveal>
        </div>
        <Reveal delay={1} className="mx-auto w-full max-w-[320px]">
          <div className="dots relative aspect-square overflow-hidden rounded-[2rem] border border-line bg-ink-2/60">
            <img
              src={clientMark}
              alt="Luminos Client logo: the lumen orb inside HUD brackets."
              className="absolute inset-0 m-auto h-[70%] w-[70%]"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- worlds */
const gallery = [
  { src: iris, name: "Iris", by: "IrisShaders", what: "Shader loader" },
  { src: bliss, name: "Bliss", by: "Xonk", what: "Shader pack" },
  { src: complementary, name: "Complementary Reimagined", by: "EminGT", what: "Shader pack" },
  { src: fo, name: "Fabulously Optimized", by: "robotkoer", what: "Modpack" },
];

export function Worlds() {
  return (
    <section className="relative py-24 md:py-36" aria-labelledby="worlds-h">
      <div className="mx-auto max-w-[1240px] px-6 md:px-10">
        <Reveal>
          <SectionHead
            eyebrow="From Modrinth"
            lead="Luminos doesn’t ship any of these. It installs them from Modrinth into the instance you pick. Images are from each project’s own gallery and belong to their authors."
          >
            <span id="worlds-h">Shaders and packs are one click from the </span>
            <span className="accent-word">library</span>.
          </SectionHead>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {gallery.map((g, i) => (
            <Reveal key={g.name} delay={i}>
              <figure className="group m-0">
                <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line">
                  <img
                    src={g.src}
                    alt={`${g.name} screenshot from its Modrinth gallery`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-1/90 via-transparent to-transparent" />
                </div>
                <figcaption className="mt-4 text-sm">
                  <span className="font-medium text-fg">{g.name}</span>
                  <span className="block text-mute">
                    {g.what} · by {g.by}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- limits */
const limits = [
  ["Microsoft sign-in", "The login flow is written and tested in pieces, but it isn’t connected to the interface. Accounts are offline profiles for now."],
  ["Forge and NeoForge", "Vanilla, Fabric and Quilt launch. Forge and NeoForge don’t."],
  ["Client on other versions", "Luminos Client is built for 1.21.4 only. Each newer version needs its own build. That’s the next job."],
  ["Skins in multiplayer", "You see your skin locally. Other players see it only on servers with a skin plugin. Changing your Mojang skin from inside Luminos isn’t wired up."],
  ["Code signing", "The installer is unsigned, so Windows SmartScreen will warn. There’s a section in the FAQ on why and what to check."],
  ["A clean-machine test", "CI builds the installer. It hasn’t been run end to end on a fresh Windows install yet."],
];

export function Limits() {
  return (
    <section id="limits" className="relative scroll-mt-20 py-24 md:py-36">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Reveal>
          <SectionHead eyebrow="Not yet">
            What doesn’t work <span className="accent-word">yet</span>.
          </SectionHead>
        </Reveal>
        <dl className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {limits.map(([k, v], i) => (
            <Reveal key={k} delay={i % 2} className="border-t border-line pt-6">
              <dt className="text-base font-medium text-fg">{k}</dt>
              <dd className="mt-2 text-[0.9375rem] leading-relaxed text-mute">{v}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
