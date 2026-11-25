import { memo, useCallback, useMemo, useState } from "react";
import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { Drawer, Field, PageHeader, Pills, SearchBox, Select, Slider, Switch } from "../components/ui";
import { CATEGORIES, MODULES, modById, type CatId, type Module, type Setting } from "../data/modules";
import { cfgOf, resetModule, setCfg, toggleFav, toggleMod, useClient } from "../state/client";

const Card = memo(function Card({ m, on, onOpen }: { m: Module; on: boolean; onOpen: (id: string) => void }) {
  return (
    <div className="card h-[160px] rounded-[12px] overflow-hidden flex flex-col justify-between">
      <button className="relative h-[118px] w-full grid place-items-center group" onClick={() => onOpen(m.id)} aria-label={`${m.name} settings`}>
        <span className="absolute top-3.5 right-3.5 w-[6px] h-[6px] rounded-full" style={{ background: "var(--accent)", opacity: on ? 1 : 0.35 }} />
        <span className="t group-hover:scale-105" style={{ color: on ? "var(--fg)" : "var(--mute)" }}><Icon n={m.icon} s={40} w={1.75} /></span>
      </button>
      <button onClick={() => toggleMod(m.id)} aria-pressed={on} title={`${m.name}: ${on ? "enabled" : "disabled"}. ${m.blurb}`} className="h-[42px] w-full flex items-center justify-center gap-2 text-[13px] font-semibold t press px-3"
        style={{ background: on ? "var(--accent)" : "var(--surface-2)", color: on ? "var(--accent-fg)" : "var(--mute)" }}>
        {on && <Icon n="check" s={14} w={2.4} />}<span className="truncate">{m.name}</span>
      </button>
    </div>
  );
});

function SettingControl({ id, st }: { id: string; st: Setting }) {
  const c = useClient();
  const v = cfgOf(c, id, st) as unknown;
  const set = (x: unknown) => setCfg(id, st.k, x);
  return (
    <Field label={st.label}>
      {st.t === "toggle" && <Switch on={v as boolean} onChange={set} label={st.label} />}
      {st.t === "color" && <input type="color" aria-label={st.label} value={v as string} onChange={(e) => set(e.target.value.toUpperCase())} />}
      {st.t === "select" && <Select value={v as string} options={st.options} onChange={set} label={st.label} />}
      {st.t === "slider" && <div className="flex items-center gap-3"><Slider value={v as number} min={st.min} max={st.max} step={st.step} onChange={set} label={st.label} w={130} /><span className="mono text-[11.5px] w-[64px] text-right mute num">{String(v)}{st.unit ?? ""}</span></div>}
    </Field>
  );
}

function ModuleDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const c = useClient();
  const m = modById(id);
  const fav = c.favs.includes(id);
  return (
    <Drawer title={m.name} icon={m.icon} onClose={onClose}>
      <p className="m-0 text-[13px] leading-relaxed mute">{m.blurb}</p>
      <div className="rounded-[12px] p-4 space-y-4" style={{ background: "var(--surface)" }}>
        <Field label="Enabled"><Switch on={!!c.on[id]} onChange={(v) => toggleMod(id, v)} label={`Enable ${m.name}`} /></Field>
        <Field label="Favorite"><button className="grid place-items-center w-8 h-8 rounded-lg t" aria-pressed={fav} aria-label={fav ? "Remove from favorites" : "Add to favorites"} onClick={() => toggleFav(id)} style={{ color: fav ? "var(--warn)" : "var(--mute)" }}><Icon n="star" s={18} fill={fav} /></button></Field>
      </div>
      {m.settings.length > 0 && <div className="rounded-[12px] p-4 space-y-4" style={{ background: "var(--surface)" }}>{m.settings.map((st) => <SettingControl key={st.k} id={id} st={st} />)}</div>}
      <button className="btn-quiet w-full" onClick={() => resetModule(id)}><Icon n="reset" s={14} />Reset {m.name}</button>
    </Drawer>
  );
}

export default function Mods() {
  const c = useClient();
  const [q, setQ] = useState(""), [cat, setCat] = useState<CatId | "all" | "favorites">("all"), [open, setOpen] = useState<string | null>(null);
  const onOpen = useCallback((id: string) => setOpen(id), []);
  const list = useMemo(() => MODULES.filter((m) => (cat === "all" || (cat === "favorites" ? c.favs.includes(m.id) : m.cat === cat)) && (!q || m.name.toLowerCase().includes(q.toLowerCase()) || m.blurb.toLowerCase().includes(q.toLowerCase()))), [q, cat, c.favs]);
  const enabled = MODULES.filter((m) => c.on[m.id]).length;
  return (
    <Page>
      <PageHeader title="Mods" sub={`${enabled} of ${MODULES.length} client modules enabled. Performance mods are built in and always on.`} right={<SearchBox value={q} onChange={setQ} placeholder={`Search ${MODULES.length} client modules...`} />} />
      <div className="mb-7"><Pills value={cat} onChange={setCat} items={CATEGORIES} /></div>
      {list.length === 0 ? (
        <div className="rounded-[14px] py-16 text-center" style={{ background: "var(--surface)" }}>
          <div className="text-[15px] font-semibold">{cat === "favorites" && !q ? "No favorites yet" : "No modules match"}</div>
          <p className="m-0 mt-1 mute text-[13px]">{cat === "favorites" && !q ? "Open a module and tap the star to pin it here." : "Try a different word or category."}</p>
          <button className="btn-quiet mt-5" onClick={() => { setQ(""); setCat("all"); }}>Show all modules</button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-5">{list.map((m) => <Card key={m.id} m={m} on={!!c.on[m.id]} onOpen={onOpen} />)}</div>
      )}
      {open && <ModuleDrawer id={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}
