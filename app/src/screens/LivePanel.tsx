/** Live mod panel (Hotwire-style, original implementation).
 *  Rules applied (skills opened in .agents/skills, see docs/SKILLS_SESSION18.md): taste-skill [button-styles, card-family, nesting, text-contrast,
 *  a11y-name, focus-ring, reduced-motion, tilt=none]; game-ui-design principles 1,2,3,6; icon-system (every icon labelled or aria-hidden).
 *  Motion spec (reanimate): progress fill 600ms ease-out transform; toast enter 180ms translateY(8px)->0 + fade; row hover 120ms. All off under .reduce.
 *  HONEST STATE: the in-game agent that swaps classes live does not exist yet, so every switch is "applies on next launch". */
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Chip, Icon, LRow, Modal, SearchBox, Switch, fmtNum } from "../kit";
import { KEEP_ON, MAX_LIVE, QUEUE_ONLY, applyPlan, missing, planSwitch, undo, type History, type Mod } from "../livepanel/plan";
import { SAMPLE_INSTALLED_PACKS, SAMPLE_INSTANCE, SAMPLE_MODS, SAMPLE_STORE, type StoreItem } from "../livepanel/demo";
import * as cache from "../livepanel/cache";
import { getSettings } from "../store";

type Toast = { id: number; tone: "ok" | "warn" | "accent"; text: string };
const KINDS: [StoreItem["kind"], string][] = [["mod", "Mods"], ["resourcepack", "Resource packs"], ["shader", "Shaders"], ["datapack", "Data packs"]];
const LIVE_APPLY = false; // flips to true only when the in-game agent exists and has been verified in a game window
const reduced = () => getSettings().reduceMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;

function Progress({ pct, label }: { pct: number; label: string }) {
  return <div className="flex items-center gap-2 h-8 px-2" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
    <span className="t2 font-medium w-[220px] truncate">{label}</span>
    <span className="pbar flex-1"><span className="pfill" style={{ transform: `scaleX(${pct / 100})` }} /></span>
    <span className="t1 mute num w-8 text-right">{Math.round(pct)}%</span>
  </div>;
}

export default function LivePanel() {
  const [mods, setMods] = useState<Mod[]>(SAMPLE_MODS);
  const [hist, setHist] = useState<History>({ stack: [] });
  const [staged, setStaged] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"mods" | "store">((new URLSearchParams(location.hash.split("?")[1] || "").get("tab") as "mods" | "store") || "mods");
  const [kind, setKind] = useState<StoreItem["kind"]>("mod");
  const [q, setQ] = useState(""); const [hide, setHide] = useState(false);
  const [pause, setPause] = useState(() => localStorage.getItem("luminos.livepanel.pause") !== "0");
  const [review, setReview] = useState(false);
  const [run, setRun] = useState<Record<string, number> | null>(null);
  const [packs, setPacks] = useState<Set<string>>(new Set(SAMPLE_INSTALLED_PACKS)); const [dl, setDl] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<Toast[]>([]); const tid = useRef(0);
  const [cacheInfo, setCacheInfo] = useState("");
  const toast = (text: string, tone: Toast["tone"] = "ok") => { const id = ++tid.current; setToasts((t) => [...t.slice(-3), { id, tone, text }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200); };

  // Metadata cache: open from the compressed per-instance copy, then record what the re-check would fetch (only changed ids).
  useEffect(() => { (async () => {
    const t0 = performance.now(); const hit = await cache.load(SAMPLE_INSTANCE.id, kind);
    const fresh = SAMPLE_STORE.filter((s) => s.kind === kind).map((s) => ({ id: s.id, updated: s.updated }));
    if (hit) { const n = cache.changed(hit.entries, fresh).length; setCacheInfo(`Opened from cache in ${Math.max(1, Math.round(performance.now() - t0))} ms · ${n} changed since`); }
    else setCacheInfo("First open: building the cache");
    await cache.save(SAMPLE_INSTANCE.id, kind, { at: Date.now(), entries: SAMPLE_STORE.filter((s) => s.kind === kind).map((s) => ({ id: s.id, title: s.title, kind: s.kind, updated: s.updated, blurb: s.blurb })) });
  })(); }, [kind]);

  const plan = useMemo(() => planSwitch(mods, staged, LIVE_APPLY), [mods, staged]);
  const attention = useMemo(() => missing(mods), [mods]);
  const nStaged = Object.keys(staged).length;
  const flip = (m: Mod, to: boolean) => setStaged((s) => { const n = { ...s }; if (m.enabled === to) delete n[m.id]; else n[m.id] = to; return n; });
  const shown = (id: string, m: Mod) => (id in staged ? staged[id] : m.enabled);

  const confirm = () => {
    const p = plan; setReview(false);
    if (!p.changes.length) { setStaged({}); return; }
    const done = () => { const r = applyPlan(mods, p, hist); setMods(r.mods); setHist(r.history); setStaged({}); setRun(null);
      toast(`${p.changes.length} switch${p.changes.length > 1 ? "es" : ""} queued: applies on next launch`, "accent");
      if (p.download.length) toast(`Needs a download first: ${p.download.join(", ")}`, "warn"); };
    if (reduced()) return done();
    const pct: Record<string, number> = Object.fromEntries(p.changes.map((c) => [c.id, 0])); setRun({ ...pct });
    const iv = setInterval(() => { let all = true; for (const k of Object.keys(pct)) { pct[k] = Math.min(100, pct[k] + 9 + Math.random() * 14); if (pct[k] < 100) all = false; } setRun({ ...pct }); if (all) { clearInterval(iv); setTimeout(done, 220); } }, 70);
  };
  const doUndo = () => { const r = undo(mods, hist); if (!r.reverted) return; setMods(r.mods); setHist(r.history); toast(`Undone: ${r.reverted} mod${r.reverted > 1 ? "s" : ""} back to the previous set`, "accent"); };

  const install = (s: StoreItem) => {
    setDl((d) => ({ ...d, [s.id]: 1 })); let p = 1;
    const iv = setInterval(() => { p = Math.min(100, p + (reduced() ? 100 : 8 + Math.random() * 16)); setDl((d) => ({ ...d, [s.id]: p }));
      if (p >= 100) { clearInterval(iv); setDl((d) => { const n = { ...d }; delete n[s.id]; return n; });
        if (s.kind === "mod") setMods((ms) => ms.some((x) => x.id === s.id) ? ms : [...ms, { id: s.id, slug: s.id, name: s.title, version: "latest", enabled: false, requires: s.requires ?? [], blurb: s.blurb }]); else setPacks((x) => new Set(x).add(s.id));
        toast(`${s.title} downloaded${s.kind === "mod" ? ": switch it on from Mods" : ""}`); } }, 90);
  };
  const installed = (s: StoreItem) => (s.kind === "mod" ? mods.some((m) => m.id === s.id) : packs.has(s.id));
  const ql = q.trim().toLowerCase();
  const list = mods.filter((m) => !ql || (m.name + m.blurb).toLowerCase().includes(ql));
  const items = SAMPLE_STORE.filter((s) => s.kind === kind && (!ql || (s.title + s.blurb + s.author).toLowerCase().includes(ql)) && !(hide && installed(s)));

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="panel p-1.5">
        <div className="flex items-center gap-2 px-2 h-10">
          <Icon n="bolt" s={15} />
          <Badge tone="mute">{SAMPLE_INSTANCE.name} · Fabric {SAMPLE_INSTANCE.mc}</Badge><Badge tone="warn">Sample data</Badge>
          <div className="flex-1" />
          <span className="t1 mute" id="pause-l">Pause game while open</span>
          <Switch label="Pause game while open" on={pause} onChange={(v) => { setPause(v); localStorage.setItem("luminos.livepanel.pause", v ? "1" : "0"); toast(v ? "The game will pause while this panel is open" : "The game keeps running while this panel is open", "accent"); }} />
          <button className="btn" onClick={doUndo} disabled={!hist.stack.length} aria-label="Undo the last switch" title="Revert to the mod set before the last switch"><Icon n="rot" s={13} />Undo</button>
        </div>
        <div className="flex items-center gap-2 px-2 pb-1.5">
          <Chip on={tab === "mods"} onClick={() => setTab("mods")} icon="puzzle">Mods <span className="num opacity-70">{mods.length}</span></Chip>
          <Chip on={tab === "store"} onClick={() => setTab("store")} icon="download">Store</Chip>
          <SearchBox value={q} onChange={setQ} placeholder={tab === "mods" ? "Search installed mods" : "Search Modrinth"} />
        </div>
      </div>

      <div className="panel-2 mt-2 flex items-center gap-2 px-3 py-1.5 t1" role="note"><Icon n="clock" s={13} /><span><b>Applies on next launch.</b> Switching a mod inside a running game needs the in-game agent, which is not part of this build. Every change is queued and can be undone.</span></div>

      {tab === "mods" && <>
        {attention.length > 0 && <div className="panel mt-2 p-1.5" aria-label="Missing dependencies">
          <div className="eyebrow px-2 pt-1">Needs attention <span className="num opacity-70">{attention.length}</span></div>
          {attention.map((a) => <LRow key={a.mod.id + a.needs} icon="alert" name={`${a.mod.name} needs ${a.needs}`} desc={a.installed ? "Installed but switched off" : "Not installed. Get it from the Store"}><Badge tone="warn">{a.installed ? "Off" : "Missing"}</Badge></LRow>)}
        </div>}
        <div className="panel mt-2 p-1.5" role="list" aria-label="Installed mods">
          {list.map((m) => { const on = shown(m.id, m); const pin = KEEP_ON[m.slug]; const by = mods.filter((x) => x.enabled && x.requires.includes(m.id));
            const desc = [m.version, m.requires.length ? `needs ${m.requires.map((r) => mods.find((x) => x.id === r)?.name ?? r).join(", ")}` : "", by.length ? `needed by ${by.length}` : "", QUEUE_ONLY[m.slug] ? "queued only" : ""].filter(Boolean).join(" · ");
            return <div role="listitem" key={m.id} style={{ opacity: m.id in staged ? 1 : undefined }}><LRow icon={pin ? "lock" : "puzzle"} name={m.name} desc={desc}>
              {m.id in staged && <Badge tone="accent">{on ? "Will turn on" : "Will turn off"}</Badge>}
              {pin ? <span title={pin} aria-label={`${m.name} is always on. ${pin}`} tabIndex={0} className="badge mute cursor-help"><Icon n="lock" s={11} />Always on</span>
                : <Switch label={`${m.name}: ${on ? "on" : "off"}`} on={on} onChange={(v) => flip(m, v)} />}
            </LRow></div>; })}
        </div>
        {run && <div className="panel mt-2 p-1.5" aria-label="Switching">{plan.changes.map((c) => <Progress key={c.id} pct={run[c.id] ?? 0} label={`${c.to ? "Turning on" : "Turning off"} ${c.name}`} />)}</div>}
        <div className="flex items-center gap-2 mt-2 min-h-8">
          <span className="t1 mute">{nStaged ? `${nStaged} of ${MAX_LIVE} selected` : `Pick up to ${MAX_LIVE} mods, then review the changes.`}</span><div className="flex-1" />
          {nStaged > 0 && <button className="btn" onClick={() => setStaged({})}>Clear</button>}
          <button className="btn btn-primary" disabled={!nStaged || plan.tooMany || !!run} onClick={() => setReview(true)}>Review {nStaged || ""} change{nStaged === 1 ? "" : "s"}</button>
        </div>
      </>}

      {tab === "store" && <>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {KINDS.map(([k, l]) => <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{l}</Chip>)}<div className="flex-1" />
          <span className="t1 mute">Hide installed</span><Switch label="Hide installed" on={hide} onChange={setHide} />
        </div>
        <div className="panel mt-2 p-1.5" aria-label="Store results">
          {items.map((s) => dl[s.id] !== undefined ? <Progress key={s.id} pct={dl[s.id]} label={`Downloading ${s.title}`} /> :
            <LRow key={s.id} icon={s.kind === "mod" ? "puzzle" : s.kind === "shader" ? "spark" : s.kind === "datapack" ? "folder" : "cube"} name={s.title} desc={`${s.author} · ${fmtNum(s.downloads)} downloads · ${s.blurb}${s.requires ? ` · brings ${s.requires.join(", ")}` : ""}`}>
              {installed(s) ? <Badge tone="ok"><Icon n="check" s={11} />Installed</Badge> : <button className="btn" onClick={() => install(s)} aria-label={`Download ${s.title}`}><Icon n="download" s={13} />Download</button>}
            </LRow>)}
          {!items.length && <div className="t2 mute text-center py-6">{hide ? "Everything here is already installed." : "Nothing matches."}</div>}
        </div>
        <div className="t1 mute mt-1.5 px-1" aria-live="polite">{cacheInfo}</div>
      </>}

      {review && <Modal title="Review changes" onClose={() => setReview(false)} w={480}>
        <p className="t1 mute mb-2">Nothing is touched until you confirm. Dependencies come along automatically.</p>
        <div className="panel-2 p-1">
          {plan.changes.map((c) => <LRow key={c.id} icon={c.to ? "check" : "x"} name={`${c.to ? "Turn on" : "Turn off"} ${c.name}`} desc={c.why === "requested" ? "You asked for this" : c.why === "needs" ? "Required by a mod you are turning on" : "Needs a mod you are turning off"}><Badge tone={c.mode === "live" ? "ok" : "mute"}>{c.mode === "live" ? "Live" : "Next launch"}</Badge></LRow>)}
          {plan.blocked.map((b) => <LRow key={b.id} icon="lock" name={`${b.name} stays on`} desc={b.reason}><Badge tone="warn">Blocked</Badge></LRow>)}
          {plan.download.map((d) => <LRow key={d} icon="download" name={`Download ${d}`} desc="Required, not installed. Get it from the Store"><Badge tone="warn">Missing</Badge></LRow>)}
        </div>
        <div className="flex justify-end gap-2 mt-3"><button className="btn" onClick={() => setReview(false)}>Cancel</button><button className="btn btn-primary" onClick={confirm} disabled={!plan.changes.length}>Confirm {plan.changes.length}</button></div>
      </Modal>}

      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast" data-tone={t.tone}><Icon n={t.tone === "warn" ? "alert" : "check"} s={14} /><span>{t.text}</span></div>)}</div>
    </div>
  );
}
