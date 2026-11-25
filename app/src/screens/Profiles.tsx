import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/ui";
import { MODULES } from "../data/modules";
import { applyPreset, PRESETS, useClient, type Preset } from "../state/client";

export default function Profiles({ go }: { go: (r: string) => void }) {
  const c = useClient();
  return (
    <Page>
      <PageHeader title="Profiles" sub="One click switches your whole module setup." />
      <div className="grid grid-cols-2 gap-6 max-w-[920px]">
        {(Object.keys(PRESETS) as Preset[]).map((p) => {
          const mods = MODULES.filter((m) => PRESETS[p].mods.includes(m.id));
          const active = c.prefs.preset === p && MODULES.every((m) => !!c.on[m.id] === PRESETS[p].mods.includes(m.id));
          return (
            <section key={p} className="rounded-[14px] p-6 flex flex-col gap-5" style={{ background: "var(--surface)" }}>
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="m-0 text-[16px] font-semibold">{p}</h2><p className="m-0 mt-1 text-[13px] mute">{PRESETS[p].blurb}</p></div>
                <span className="grid place-items-center w-10 h-10 rounded-[10px]" style={{ background: "var(--surface-2)", color: "var(--accent-text)" }}><Icon n={p === "Competitive PvP" ? "bolt" : "waypoints"} s={20} /></span>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[88px] content-start">{mods.map((m) => <span key={m.id} className="h-[26px] px-2.5 rounded-full text-[11.5px] grid place-items-center" style={{ background: "var(--surface-2)", color: "var(--mute)" }}>{m.name}</span>)}</div>
              <button className={active ? "btn-quiet" : "btn-primary"} onClick={() => applyPreset(p)} aria-pressed={active}>{active ? <><Icon n="check" s={15} w={2.2} />Active</> : `Apply ${p}`}</button>
            </section>
          );
        })}
      </div>
      <button className="btn-quiet mt-6" onClick={() => go("mods")}>Fine-tune modules<Icon n="arrow" s={14} /></button>
    </Page>
  );
}
