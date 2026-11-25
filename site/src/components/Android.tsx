import Reveal from "./Reveal";
import { SectionHead } from "./ui";
import { release } from "../lib/useRelease";
import type { ReleaseState } from "../lib/useRelease";

// Skills applied (session 19): better-ui (grouping, 1px hairlines, no shadows on the table), impeccable (status words, not colour alone),
// accessibility (table semantics with scoped headers, 4.5:1 text), fixing-accessibility (real <table>, labelled link, focus ring from index.css).

// Phone screenshots are taken from the CI emulator run and committed under src/assets/android/ (none is shown if the folder is empty).
const shots = Object.entries(import.meta.glob("../assets/android/*.webp", { eager: true, import: "default" })).sort(([a], [b]) => a.localeCompare(b)) as [string, string][];
const altFor = (p: string) => {
  const n = p.split("/").pop() ?? "";
  if (n.includes("onboarding")) return "Android app onboarding screen";
  if (n.includes("home")) return "Android app home screen";
  if (n.includes("library")) return "Android app library screen";
  if (n.includes("skins")) return "Android app skins screen with a 3D model";
  if (n.includes("settings")) return "Android app settings screen";
  return "Android app screen";
};

type Row = [feature: string, state: "Works" | "Built, not exercised" | "Does not work" | "Not built", detail: string];
const matrix: Row[] = [
  ["Offline account", "Works", "Real offline UUID. Optional skin and cape lookup from Mojang."],
  ["Instances", "Works", "Any release or snapshot, with Mojang’s artwork for the version."],
  ["Java runtime", "Works", "Java 21 for 1.20.5 to 1.21.x and Java 25 for 26.x, SHA-256 checked, unpacked and booted. Seen on the x86_64 emulator; not on an arm64 phone."],
  ["Game files", "Works", "Client, libraries and assets from Mojang, SHA-1 checked (the Prepare button)."],
  ["Modrinth browsing", "Works", "Search and browse. Installing a mod with dependencies is written but was not driven end to end in CI."],
  ["Skins", "Works", "3D model you can turn, PNG import, lookup by username."],
  ["Settings", "Works", "Opens and persists on the emulator."],
  ["Launching Minecraft", "Does not work", "There is no OpenGL layer and no window/input layer, so the game cannot start."],
  ["In-game features", "Not built", "Nothing runs in game on Android."],
  ["Microsoft sign-in", "Not built", "Offline accounts only."],
  ["A real phone", "Not built", "Never run on a physical device. Emulator only."],
];

const badge: Record<Row[1], string> = {
  Works: "border-emerald-300/40 text-emerald-200",
  "Built, not exercised": "border-amber-300/40 text-amber-200",
  "Does not work": "border-rose-300/50 text-rose-200",
  "Not built": "border-rose-300/50 text-rose-200",
};

export default function Android({ state }: { state: ReleaseState }) {
  const a = release.android;
  const ready = state.status === "ready";
  return (
    <section id="android" className="relative scroll-mt-20 py-24 md:py-32" aria-labelledby="android-h">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <Reveal>
          <SectionHead
            eyebrow="Android · launcher preview"
            lead="Installs and manages instances. Minecraft does not launch on Android yet: the app says so on its home screen instead of pretending."
          >
            <span id="android-h">Luminos on your phone, without the </span>
            <span className="accent-word">game</span>.
          </SectionHead>
        </Reveal>

        <Reveal delay={1} className="mt-12 rounded-2xl border border-line bg-ink-2/60 p-6 md:p-8">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-base font-medium text-fg">{a.label}</p>
              <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.9375rem] text-mute">
                <dt className="text-fg">Version</dt>
                <dd>{state.version} (pre-release)</dd>
                <dt className="text-fg">Android</dt>
                <dd>{a.minAndroid} or newer</dd>
                <dt className="text-fg">ABIs</dt>
                <dd>
                  {a.abis.join(", ")}. {a.abiNote}
                </dd>
                <dt className="text-fg">Signing</dt>
                <dd>Signed with the {a.signing}. Android may warn on install. Check the SHA-256 on the release page.</dd>
                <dt className="text-fg">Tested</dt>
                <dd>On a CI emulator (Android 11, x86_64). Not on a real device.</dd>
              </dl>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <a className="btn btn-primary" href={ready ? state.apkUrl : state.page} rel="noopener">
                {ready ? "Download the APK (launcher preview)" : "APK is being built"}
              </a>
              <p className="max-w-[18rem] text-[0.8125rem] leading-relaxed text-mute md:text-right">
                {ready ? `${a.name}. ` : `${state.tag} is not published yet. `}
                Game launch is not supported.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[0.9375rem]">
            <caption className="sr-only">What works and what does not in the Android launcher preview</caption>
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-widest text-mute">
                <th scope="col" className="py-3 pr-4 font-medium">Feature</th>
                <th scope="col" className="py-3 pr-4 font-medium">State</th>
                <th scope="col" className="py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map(([f, st, d]) => (
                <tr key={f} className="border-b border-line align-top">
                  <th scope="row" className="py-4 pr-4 font-medium text-fg">{f}</th>
                  <td className="py-4 pr-4">
                    <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs ${badge[st]}`}>{st}</span>
                  </td>
                  <td className="py-4 leading-relaxed text-mute">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        {shots.length > 0 && (
          <Reveal className="mt-14">
            <ul className="m-0 flex list-none gap-4 overflow-x-auto p-0 pb-2" aria-label="Screenshots from the Android emulator run">
              {shots.map(([p, src]) => (
                <li key={p} className="shrink-0">
                  <img src={src} alt={altFor(p)} width={270} height={585} loading="lazy" decoding="async" className="h-auto w-[200px] rounded-2xl border border-line md:w-[230px]" />
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.8125rem] text-mute">Captured by CI on an Android 11 x86_64 emulator.</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
