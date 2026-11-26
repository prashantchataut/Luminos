import { memo, useCallback, useMemo, useState } from "react";
import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { Drawer, Field, PageHeader, Pills, SearchBox, Select, Slider, Switch } from "../components/ui";
import { CATEGORIES, MODULES, modById, type CatId, type Module, type Setting } from "../data/modules";
import { cfgOf, resetModule, setCfg, toggleFav, toggleMod, useClient } from "../state/client";

/** Live pill text from the module's own settings, so the card shows the real current preset. */
function chips(m: Module, c: ReturnType<typeof useClient>): string[] {
  const out: string[] = [];
  for (const st of m.settings) {
    const v = cfgOf(c, m.id, st) as unknown;
    if (st.t === "slider") out.push(`${v}${st.unit ?? ""} ${st.label.toLowerCase()}`);
    else if (st.t === "select") out.push(String(v));
    else if (st.t === "toggle" && v) out.push(st.label);
    if (out.length >= 3) break;
  }
  return out;
}

/** Tactical Bento card: obsidian slab, 3px glowing status bar on the left edge, switch + quick-drawer top right, live preset pills below. */
const Card = memo(function Card({ m, on, onOpen }: { m: Module; on: boolean; onOpen: (id: string) => void }) {
  const c = useClient();
  const pills = chips(m, c);
  return (
    <div className="relative rounded-[14px] p-4 pl-5 flex flex-col gap-3 min-h-[148px] overflow-hidden t" style={{ background: "#11141C", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)" }} data-module={m.id}>
      <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full t" style={{ background: on ? "#3B82F6" : "#232938", boxShadow: on ? "0 0 12px 1px rgba(59,130,246,.65)" : "none" }} />
      <div className="flex items-start justify-between gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-[12px] shrink-0" style={{ background: "#191F2E", color: on ? "#93C5FD" : "#6B7385" }}><Icon n={m.icon} s={20} w={1.75} /></span>
        <div className="flex items-center gap-2">
          <button onClick={() => onOpen(m.id)} aria-label={`${m.name} quick settings`} title="Quick settings" className="grid place-items-center w-8 h-8 rounded-[9px] t hover:bg-[#191F2E]" style={{ color: "#8793A8" }}><Icon n="gear" s={16} /></button>
          <Switch on={on} onChange={(v) => toggleMod(m.id, v)} label={`${m.name} ${on ? "enabled" : "disabled"}`} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[14.5px] font-bold text-white truncate">{m.name}</div>
        <div className="text-[12px] leading-snug mt-0.5 line-clamp-2" style={{ color: "#8793A8" }}>{m.blurb}</div>
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5">
        {m.soon && <span className="h-[22px] px-2 rounded-[6px] text-[10.5px] font-semibold grid place-items-center" style={{ background: "#2A2210", color: "#FBBF24" }} title="The setting is saved by the launcher; the in-game module ships in a later client build.">Client build pending</span>}
        {pills.map((t) => <button key={t} onClick={() => onOpen(m.id)} className="h-[22px] px-2 rounded-[6px] text-[10.5px] font-semibold num t hover:brightness-125" style={{ background: on ? "#14254A" : "#171C28", color: on ? "#BFD3FF" : "#6B7385" }}>{t}</button>)}
      </div>
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
        <div className="grid grid-cols-3 gap-4">{list.map((m) => <Card key={m.id} m={m} on={!!c.on[m.id]} onOpen={onOpen} />)}</div>
      )}
      {open && <ModuleDrawer id={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}
