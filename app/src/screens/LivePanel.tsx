/** Live mod panel. Skills: ui-skills registry — better-ui [hover/enter/exit, optical alignment], better-layout [grouping, density], better-motion [fill = transform, 120-180 ms, one easing],
 *  animation-performance [composite-only: transform/opacity], accessible-animation [tier-0 reduced motion rests every transition], animation-systems [one token set in index.css],
 *  interaction-design [feedback for every action, undo], accessibility [WCAG 2.2 AA: names on icon controls, aria-live toasts, status not by colour alone],
 *  audit-ai-design-slop (run after capture; findings in docs/design/AUDIT.md).
 *  HONEST STATE: a row is "live" only when the engine classified it live AND the game is connected. Progress rows are driven by the agent's own events. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Chip, Icon, LRow, Modal, SearchBox, Switch, fmtNum } from "../kit";
import { KEEP_ON, MAX_LIVE, applyPlan, missing, planSwitch, undo as undoState, type History, type Mod } from "../livepanel/plan";
import { engine, type AgentEvent, type Change, type ChangeKind, type Snapshot, type StoreHit, type StoreKind } from "../engine";
import { bootstrap, type Inst } from "../api";

type Toast = { id: number; tone: "ok" | "warn" | "accent"; text: string };
type Row = Mod & { kind: ChangeKind; file?: string; reasons: string[]; locked?: string };
type Run = { label: string; mode: "live" | "queued"; op?: number; stage: string; pct: number; error?: string };
type Switch = { batch: number; changes: { id: string; kind: ChangeKind; file?: string; label: string; from: boolean; to: boolean; mode: "live" | "queued" }[] };

const KINDS: [StoreKind, string][] = [["mod", "Mods"], ["resourcepack", "Resource packs"], ["shader", "Shaders"], ["datapack", "Data packs"]];
/** Valid Modrinth categories per project type. */
const CATS: Record<StoreKind, string[]> = {
  mod: ["optimization", "utility", "decoration", "adventure", "equipment", "library", "magic", "technology", "worldgen", "management"],
  resourcepack: ["decoration", "realistic", "simplistic", "vanilla-like", "themed", "fantasy", "utility", "cursed"],
  shader: ["realistic", "fantasy", "vanilla-like", "cursed", "low", "medium", "high"],
  datapack: ["adventure", "magic", "technology", "utility", "worldgen", "game-mechanics", "library"],
};
const PCT: Record<string, number> = { received: 12, applying: 45, reloading: 72, applied: 100 };
const STAGE_TEXT: Record<string, string> = { received: "Game received it", applying: "Applying", reloading: "Reloading resources", applied: "Done", queued: "Queued for next launch" };
const reduced = () => document.documentElement.classList.contains("reduce") || matchMedia("(prefers-reduced-motion: reduce)").matches;

function Progress({ r }: { r: Run }) {
  const failed = !!r.error;
  return <div className="flex items-center gap-2 h-8 px-2" role="progressbar" aria-label={r.label} aria-valuenow={Math.round(r.pct)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={failed ? `Failed: ${r.error}` : STAGE_TEXT[r.stage] ?? r.stage}>
    <span className="t2 font-medium w-[220px] truncate" title={r.label}>{r.label}</span>
    <span className="pbar flex-1"><span className="pfill" style={{ transform: `scaleX(${r.pct / 100})`, background: failed ? "var(--color-bad, #e5484d)" : undefined }} /></span>
    <span className="t1 mute w-[150px] text-right truncate" title={r.error}>{failed ? `Failed: ${r.error}` : STAGE_TEXT[r.stage] ?? r.stage}</span>
  </div>;
}

export default function LivePanel() {
  const [insts, setInsts] = useState<Inst[]>([]); const [inst, setInst] = useState<Inst | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null); const [loadErr, setLoadErr] = useState("");
  const [hist, setHist] = useState<History>({ stack: [] }); const [switches, setSwitches] = useState<Switch[]>([]);
  const [staged, setStaged] = useState<Record<string, boolean>>({}); const [review, setReview] = useState(false);
  const [runs, setRuns] = useState<Record<string, Run> | null>(null); const seq = useRef(0);
  const [tab, setTab] = useState<"mods" | "store">((new URLSearchParams(location.hash.split("?")[1] || "").get("tab") as "mods" | "store") || "mods");
  const [q, setQ] = useState("");
  const [pause, setPause] = useState(() => localStorage.getItem("luminos.livepanel.pause") !== "0"); const [pauseState, setPauseState] = useState<{ paused: boolean; reason: string } | null>(null);
  const [kind, setKind] = useState<StoreKind>("mod"); const [cats, setCats] = useState<string[]>([]); const [hide, setHide] = useState(false);
  const [hits, setHits] = useState<StoreHit[]>([]); const [total, setTotal] = useState(0); const [busy, setBusy] = useState(false); const [storeErr, setStoreErr] = useState("");
  const [installed, setInstalled] = useState<Set<string>>(new Set()); const [dl, setDl] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]); const tid = useRef(0);
  const toast = (text: string, tone: Toast["tone"] = "ok") => { const id = ++tid.current; setToasts((t) => [...t.slice(-3), { id, tone, text }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200); };

  useEffect(() => { bootstrap().then((b) => { const l = b.instances.filter((i) => i.loader !== "Vanilla"); setInsts(l); setInst(l[0] ?? null); }).catch((e) => setLoadErr(String(e))); }, []);
  const refresh = useCallback(async () => { if (!inst) return; try { setSnap(await engine.liveSnapshot(inst.id)); setLoadErr(""); } catch (e) { setLoadErr(String(e)); } }, [inst]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 3000); return () => clearInterval(t); }, [refresh]);

  const connected = !!snap?.agent.connected;
  // Pause the game while this panel is open. Resumed when the toggle goes off or the panel closes.
  useEffect(() => {
    if (!pause || !connected) { setPauseState(null); return; }
    engine.livePause(true).catch(() => {});
    return () => { engine.livePause(false).catch(() => {}); };
  }, [pause, connected]);
  useEffect(() => { let last = 0; const t = setInterval(async () => { const r = await engine.liveEvents(last).catch(() => null); if (!r) return; last = r.seq; const s = [...r.events].reverse().find((e) => e.t === "state"); if (s) setPauseState({ paused: !!s.paused, reason: s.reason ?? "" }); }, 700); return () => clearInterval(t); }, []);

  const rows: Row[] = useMemo(() => {
    if (!snap) return [];
    const modLive = snap.kinds.module.disposition === "live" && connected, packLive = snap.kinds.resourcepack.disposition === "live" && connected;
    return [
      ...snap.modules.map((m): Row => ({ id: `module:${m.id}`, slug: m.id, kind: "module", name: m.id.replace(/(^|[-_])(\w)/g, (_, a, b) => (a ? " " : "") + b.toUpperCase()), version: "Luminos module", enabled: m.enabled, requires: [], blurb: "", live: modLive, reasons: snap.kinds.module.reasons })),
      ...snap.packs.map((p): Row => ({ id: `pack:${p.id}`, slug: p.id, kind: "resourcepack", name: p.id.replace(/^file\//, "").replace(/\.zip$/, ""), version: "Resource pack", enabled: p.enabled, requires: [], blurb: "", live: packLive, reasons: snap.kinds.resourcepack.reasons, locked: packLive ? undefined : "Start the game to switch resource packs live" })),
      ...snap.mods.map((m): Row => ({ id: m.id, slug: m.id, kind: "mod", file: m.file, name: m.name, version: m.version, enabled: m.pending ?? m.enabled, requires: m.requires, blurb: "", live: false, reasons: m.verdict.reasons })),
    ];
  }, [snap, connected]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const plan = useMemo(() => planSwitch(rows, staged), [rows, staged]);
  const nStaged = Object.keys(staged).length;
  const attention = useMemo(() => missing(rows.filter((r) => r.kind === "mod")), [rows]);
  const shown = (id: string, r: Row) => (id in staged ? staged[id] : r.enabled);
  const flip = (r: Row, to: boolean) => setStaged((s) => { const n = { ...s }; if (to === r.enabled) delete n[r.id]; else n[r.id] = to; return n; });
  const live = plan.changes.filter((c) => c.mode === "live"), queued = plan.changes.filter((c) => c.mode !== "live");

  const toChange = (c: { id: string; name: string; to: boolean }): Change => { const r = byId.get(c.id)!; return { kind: r.kind, id: r.kind === "module" ? r.slug : r.kind === "resourcepack" ? r.slug : r.id, file: r.file, label: c.name, to: c.to }; };

  const track = async (pending: Record<string, Run>) => {
    // Rows follow the agent's own events. Nothing here advances on a timer.
    let since = seq.current; const t0 = Date.now();
    while (Date.now() - t0 < 120_000) {
      const r = await engine.liveEvents(since).catch(() => null); if (r) { since = r.seq; seq.current = r.seq; }
      let open = false;
      setRuns((cur) => { if (!cur) return cur; const n = { ...cur };
        for (const [k, run] of Object.entries(n)) { if (run.mode !== "live" || run.error || run.stage === "applied") continue;
          for (const e of (r?.events ?? []) as AgentEvent[]) { if (e.op !== run.op) continue;
            if (e.t === "progress" && e.stage) n[k] = { ...n[k], stage: e.stage, pct: PCT[e.stage] ?? n[k].pct };
            if (e.t === "done") n[k] = e.ok ? { ...n[k], stage: "applied", pct: 100 } : { ...n[k], error: e.detail || "the game refused" }; }
          if (!n[k].error && n[k].stage !== "applied") open = true; }
        return n; });
      await new Promise((res) => setTimeout(res, 120));
      if (!open && Object.values(pending).every((p) => p.mode !== "live" || p.op !== undefined)) { await new Promise((res) => setTimeout(res, 160)); break; }
    }
  };

  const confirm = async () => {
    if (!inst) return; const p = plan; setReview(false);
    const changes = p.changes.map(toChange);
    try {
      const res = await engine.liveApply(inst.id, changes);
      const first = await engine.liveEvents(0).catch(() => ({ seq: 0 })); seq.current = Math.max(0, (first as { seq: number }).seq - 0);
      const pend: Record<string, Run> = {};
      res.results.forEach((r, i) => { const c = p.changes[i]; pend[c.id] = r.mode === "error" ? { label: c.name, mode: "queued", stage: "queued", pct: 0, error: r.error } : r.mode === "live" ? { label: `${c.to ? "Turning on" : "Turning off"} ${c.name}`, mode: "live", op: r.op, stage: "received", pct: 0 } : { label: `${c.to ? "Turning on" : "Turning off"} ${c.name}`, mode: "queued", stage: "queued", pct: 100 }; });
      setRuns(pend); setStaged({});
      const ok = res.results.filter((r) => r.mode !== "error");
      const sw: Switch = { batch: res.batch, changes: p.changes.filter((_, i) => res.results[i].mode !== "error").map((c, i) => ({ id: c.id, kind: changes[p.changes.indexOf(c)].kind, file: changes[p.changes.indexOf(c)].file, label: c.name, from: !c.to, to: c.to, mode: ok[i].mode as "live" | "queued" })) };
      if (sw.changes.length) { setSwitches((s) => [...s, sw]); const r = applyPlan(rows, { ...p, changes: p.changes.filter((_, i) => res.results[i].mode !== "error") }, hist); setHist(r.history); }
      await track(pend); await refresh();
      const nl = res.results.filter((r) => r.mode === "live").length, nq = res.results.filter((r) => r.mode === "queued").length, ne = res.results.filter((r) => r.mode === "error").length;
      if (nl) toast(`${nl} switched live`); if (nq) toast(`${nq} queued: applies on next launch`, "accent"); if (ne) toast(`${ne} could not be applied: ${res.results.find((r) => r.error)?.error}`, "warn");
      if (p.download.length) toast(`Needs a download first: ${p.download.join(", ")}`, "warn");
      setTimeout(() => setRuns(null), reduced() ? 600 : 2400);
    } catch (e) { toast(String(e), "warn"); }
  };

  const doUndo = async () => {
    if (!inst) return; const last = switches[switches.length - 1]; if (!last) return;
    try {
      const queuedMods = last.changes.filter((c) => c.mode === "queued" && (c.kind === "mod" || c.kind === "shader"));
      if (queuedMods.length) await engine.liveCancelBatch(inst.id, last.batch);
      const inverse = last.changes.filter((c) => !queuedMods.includes(c)).map((c): Change => ({ kind: c.kind, id: c.kind === "module" || c.kind === "resourcepack" ? byId.get(c.id)?.slug ?? c.id : c.id, file: c.file, label: c.label, to: c.from }));
      if (inverse.length) await engine.liveApply(inst.id, inverse);
      setSwitches((s) => s.slice(0, -1)); setHist((h) => undoState(rows, h).history); await refresh();
      toast(`Undone: ${last.changes.length} ${last.changes.length > 1 ? "items" : "item"} back to before the last switch`, "accent");
    } catch (e) { toast(String(e), "warn"); }
  };

  // ---- store: real Modrinth search ----
  const search = useCallback(async (offset: number) => {
    setBusy(true); setStoreErr("");
    try { const r = await engine.storeSearch({ query: q.trim(), kind, limit: 20, offset, sort: q.trim() ? "relevance" : "downloads", categories: cats, game_version: inst?.mc ?? null, loader: inst && kind === "mod" ? inst.loader.toLowerCase() : null });
      setTotal(r.total); setHits((h) => (offset ? [...h, ...r.hits] : r.hits)); }
    catch (e) { setStoreErr(String(e)); setHits([]); } finally { setBusy(false); }
  }, [q, kind, cats, inst]);
  useEffect(() => { if (tab !== "store") return; const t = setTimeout(() => search(0), 300); return () => clearTimeout(t); }, [tab, search]);
  useEffect(() => { if (inst && tab === "store") engine.storeInstalled(inst.id).then((l) => setInstalled(new Set(l))).catch(() => {}); }, [inst, tab, dl]);
  const isInstalled = (h: StoreHit) => installed.has(`${kind}:${h.slug}`) || installed.has(`${kind}:${h.title.toLowerCase()}`);
  const install = async (h: StoreHit) => {
    if (!inst) return; setDl((d) => new Set(d).add(h.slug));
    try { await engine.storeInstall(inst.id, h.slug, kind); toast(`${h.title} downloaded${kind === "mod" ? ": switch it on from Mods (applies next launch)" : ""}`); await refresh(); }
    catch (e) { toast(`${h.title}: ${e}`, "warn"); } finally { setDl((d) => { const n = new Set(d); n.delete(h.slug); return n; }); }
  };

  const ql = q.trim().toLowerCase();
  const list = rows.filter((r) => !ql || r.name.toLowerCase().includes(ql));
  const group = (k: "module" | "pack" | "mod") => list.filter((r) => (k === "mod" ? r.kind === "mod" : k === "pack" ? r.kind === "resourcepack" : r.kind === "module"));
  const Section = ({ title, hint, rs }: { title: string; hint: string; rs: Row[] }) => rs.length ? <div className="panel mt-2 p-1.5" role="list" aria-label={title}>
    <div className="flex items-baseline gap-2 px-2 pt-1 pb-0.5"><span className="eyebrow">{title}</span><span className="t1 mute">{hint}</span></div>
    {rs.map((r) => { const on = shown(r.id, r); const pin = r.kind === "mod" ? KEEP_ON[r.slug] : undefined; const pend = snap?.mods.find((m) => m.id === r.id)?.pending; const by = rows.filter((x) => x.enabled && x.requires.includes(r.id));
      const desc = [r.version, r.requires.length ? `needs ${r.requires.map((d) => byId.get(d)?.name ?? d).join(", ")}` : "", by.length ? `needed by ${by.length}` : ""].filter(Boolean).join(" · ");
      return <div role="listitem" key={r.id}><LRow icon={pin ? "lock" : r.kind === "mod" ? "puzzle" : r.kind === "module" ? "bolt" : "cube"} name={r.name} desc={desc}>
        {pend !== null && pend !== undefined && <Badge tone="accent"><Icon n="clock" s={11} />Queued: {pend ? "on" : "off"} next launch</Badge>}
        {r.id in staged && <Badge tone="accent">{on ? "Will turn on" : "Will turn off"}</Badge>}
        <Badge tone={r.live ? "ok" : "mute"}>{r.live ? "Live" : "Next launch"}</Badge>
        {pin ? <span title={pin} aria-label={`${r.name} is always on. ${pin}`} tabIndex={0} className="badge mute cursor-help"><Icon n="lock" s={11} />Always on</span>
          : r.locked ? <span title={r.locked} className="badge mute" tabIndex={0}>{r.locked}</span> : <Switch label={`${r.name}: ${on ? "on" : "off"}`} on={on} onChange={(v) => flip(r, v)} />}
      </LRow></div>; })}
  </div> : null;

  return (
    <div className="max-w-[760px] mx-auto">
      <div className="panel p-1.5">
        <div className="flex items-center gap-2 px-2 h-10">
          <Icon n="bolt" s={15} />
          {insts.length > 1 ? <select aria-label="Instance" className="btn" value={inst?.id} onChange={(e) => { setInst(insts.find((i) => i.id === e.target.value) ?? null); setStaged({}); }}>{insts.map((i) => <option key={i.id} value={i.id}>{i.name} {i.mc}</option>)}</select> : <Badge tone="mute">{inst ? `${inst.name} · ${inst.loader} ${inst.mc}` : "No instance"}</Badge>}
          <Badge tone={connected ? "ok" : "mute"}><Icon n={connected ? "check" : "clock"} s={11} />{connected ? `Game connected${snap?.agent.world ? ` · ${snap.agent.world}` : ""}` : "No game running"}</Badge>
          {snap?.demo && <Badge tone="warn">Demo agent: no game connected</Badge>}
          <div className="flex-1" />
          <span className="t1 mute whitespace-nowrap" id="pause-l">Pause game while open</span>
          <Switch label="Pause game while open" on={pause} onChange={(v) => { setPause(v); localStorage.setItem("luminos.livepanel.pause", v ? "1" : "0"); }} />
          <button className="btn" onClick={doUndo} disabled={!switches.length} aria-label="Undo the last switch" title="Revert the last switch, live and queued items alike"><Icon n="rot" s={13} />Undo</button>
        </div>
        <div className="flex items-center gap-2 px-2 pb-1.5">
          <Chip on={tab === "mods"} onClick={() => setTab("mods")} icon="puzzle">Installed <span className="num opacity-70">{rows.length}</span></Chip>
          <Chip on={tab === "store"} onClick={() => setTab("store")} icon="download">Store</Chip>
          <SearchBox value={q} onChange={setQ} placeholder={tab === "mods" ? "Search installed" : "Search Modrinth"} />
        </div>
      </div>

      <div className="panel-2 mt-2 flex items-center gap-2 px-3 py-1.5 t1" role="note" aria-live="polite"><Icon n={connected ? "bolt" : "clock"} s={13} /><span>{connected
        ? <><b>Live:</b> Luminos modules and resource packs switch in the running game. <b>Next launch:</b> third-party mods (Luminos does not unload other mods’ code). {pause && pauseState && (pauseState.paused ? <b>The game is paused.</b> : pauseState.reason ? <>Not paused: {pauseState.reason}.</> : null)}</>
        : <><b>No game is running.</b> Mod switches are queued and applied when you launch; resource packs need a running game.</>}</span></div>
      {loadErr && <div className="panel-2 mt-2 px-3 py-1.5 t1" role="alert"><Icon n="alert" s={13} /> {loadErr}</div>}

      {tab === "mods" && <>
        {attention.length > 0 && <div className="panel mt-2 p-1.5" aria-label="Missing dependencies">
          <div className="eyebrow px-2 pt-1">Needs attention <span className="num opacity-70">{attention.length}</span></div>
          {attention.map((a) => <LRow key={a.mod.id + a.needs} icon="alert" name={`${a.mod.name} needs ${a.needs}`} desc={a.installed ? "Installed but switched off" : "Not installed. Get it from the Store"}><Badge tone="warn">{a.installed ? "Off" : "Missing"}</Badge></LRow>)}
        </div>}
        {runs && <div className="panel mt-2 p-1.5" aria-label="Switching">{Object.entries(runs).map(([k, r]) => <Progress key={k} r={r} />)}</div>}
        <Section title="Luminos modules" hint="switch in the running game" rs={group("module")} />
        <Section title="Resource packs" hint="reload the game's resources" rs={group("pack")} />
        <Section title="Mods" hint="apply on next launch" rs={group("mod")} />
        {!rows.length && snap && <div className="panel mt-2 t2 mute text-center py-6">No mods found in this instance yet. Get some from the Store.</div>}
        <div className="flex items-center gap-2 mt-2 min-h-8">
          <span className="t1 mute">{nStaged ? `${nStaged} of ${MAX_LIVE} selected` : `Pick up to ${MAX_LIVE} items, then review the changes.`}</span><div className="flex-1" />
          {nStaged > 0 && <button className="btn" onClick={() => setStaged({})}>Clear</button>}
          <button className="btn btn-primary" disabled={!nStaged || plan.tooMany || !!runs} onClick={() => setReview(true)}>Review {nStaged || ""} change{nStaged === 1 ? "" : "s"}</button>
        </div>
      </>}

      {tab === "store" && <>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {KINDS.map(([k, l]) => <Chip key={k} on={kind === k} onClick={() => { setKind(k); setCats([]); }}>{l}</Chip>)}<div className="flex-1" />
          <span className="t1 mute">Hide installed</span><Switch label="Hide installed" on={hide} onChange={setHide} />
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap" role="group" aria-label="Categories">
          {CATS[kind].map((c) => <Chip key={c} on={cats.includes(c)} onClick={() => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}>{c}</Chip>)}
        </div>
        <div className="panel mt-2 p-1.5" aria-label="Store results" aria-busy={busy}>
          {hits.filter((h) => !(hide && isInstalled(h))).map((h) => <LRow key={h.id} icon={kind === "mod" ? "puzzle" : kind === "shader" ? "spark" : kind === "datapack" ? "folder" : "cube"} name={h.title} desc={`${h.author} · ${fmtNum(h.downloads)} downloads · ${h.description}`}>
            {dl.has(h.slug) ? <Badge tone="accent"><Icon n="download" s={11} />Downloading…</Badge> : isInstalled(h) ? <Badge tone="ok"><Icon n="check" s={11} />Installed</Badge> : <button className="btn" onClick={() => install(h)} aria-label={`Download ${h.title}`}><Icon n="download" s={13} />Download</button>}
          </LRow>)}
          {busy && <div className="t2 mute text-center py-4">Searching Modrinth…</div>}
          {storeErr && <div className="t2 text-center py-4" role="alert">Could not reach Modrinth: {storeErr}</div>}
          {!busy && !storeErr && !hits.length && <div className="t2 mute text-center py-6">Nothing matches.</div>}
        </div>
        <div className="flex items-center gap-2 mt-1.5 px-1"><span className="t1 mute" aria-live="polite">{total ? `${fmtNum(total)} results on Modrinth` : ""}</span><div className="flex-1" />
          {hits.length < total && <button className="btn" disabled={busy} onClick={() => search(hits.length)}>Load more</button>}</div>
      </>}

      {review && <Modal title="Review changes" onClose={() => setReview(false)} w={520}>
        <p className="t1 mute mb-2">Nothing is touched until you confirm. Dependencies come along automatically.</p>
        {live.length > 0 && <div className="eyebrow px-1 mb-1">Switches now, in the running game <span className="num opacity-70">{live.length}</span></div>}
        {live.length > 0 && <div className="panel-2 p-1 mb-2">{live.map((c) => <LRow key={c.id} icon={c.to ? "check" : "x"} name={`${c.to ? "Turn on" : "Turn off"} ${c.name}`} desc={c.why === "requested" ? "You asked for this" : c.why === "needs" ? "Required by something you are turning on" : "Needs something you are turning off"}><Badge tone="ok">Live</Badge></LRow>)}</div>}
        {queued.length > 0 && <div className="eyebrow px-1 mb-1">Waits for the next launch <span className="num opacity-70">{queued.length}</span></div>}
        {queued.length > 0 && <div className="panel-2 p-1">{queued.map((c) => <LRow key={c.id} icon={c.to ? "check" : "x"} name={`${c.to ? "Turn on" : "Turn off"} ${c.name}`} desc={(byId.get(c.id)?.reasons ?? []).slice(-2)[0] ?? "Applies on the next launch."}><Badge tone="mute">Next launch</Badge></LRow>)}</div>}
        {(plan.blocked.length > 0 || plan.download.length > 0) && <div className="panel-2 p-1 mt-2">
          {plan.blocked.map((b) => <LRow key={b.id} icon="lock" name={`${b.name} stays on`} desc={b.reason}><Badge tone="warn">Blocked</Badge></LRow>)}
          {plan.download.map((d) => <LRow key={d} icon="download" name={`Download ${d}`} desc="Required, not installed. Get it from the Store"><Badge tone="warn">Missing</Badge></LRow>)}
        </div>}
        <div className="flex justify-end gap-2 mt-3"><button className="btn" onClick={() => setReview(false)}>Cancel</button><button className="btn btn-primary" onClick={confirm} disabled={!plan.changes.length}>Confirm {plan.changes.length}</button></div>
      </Modal>}

      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast" data-tone={t.tone}><Icon n={t.tone === "warn" ? "alert" : "check"} s={14} /><span>{t.text}</span></div>)}</div>
    </div>
  );
}
