import { useEffect, useMemo, useRef, useState } from "react";
import type { Boot } from "../App";
import { Icon, SearchBox, SkinThumb } from "../kit";
import { Stage } from "../cos3d";
import SkinEditor from "../SkinEditor";
import { call, isTauri } from "../api";
import { importSkinFile, loadSkins, lookupUsername, Lookup, ORIGINALS, saveSkins, sha256, SkinEntry, skinsRestorerCommand, srcOf, VISIBILITY } from "../skinio";
import { loadLocker } from "../data/cosmetics";
import { useSettings } from "../store";

const ISSUES = "https://github.com/prashantchataut/Luminos/issues/new";
export default function Skins(_p: { boot: Boot }) {
  const s = useSettings();
  const [st, setSt] = useState(loadSkins); const [q, setQ] = useState(""); const [view, setView] = useState<"studio" | "scene">("studio");
  const [editing, setEditing] = useState<SkinEntry | null>(null); const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [uname, setUname] = useState(""); const [look, setLook] = useState<Lookup | null>(null); const [busy, setBusy] = useState(false); const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState(""); const [owners, setOwners] = useState(false); const [reporting, setReporting] = useState<SkinEntry | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null); const stage = useRef<Stage | null>(null);
  const all = useMemo(() => [...ORIGINALS, ...st.mine], [st.mine]); const cur = all.find((x) => x.id === st.active) || all[0];
  const shown = all.filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()));
  const commit = (n: typeof st) => { setSt(n); saveSkins(n); };
  const say = (t: string, bad = false) => { setMsg({ t, bad }); setTimeout(() => setMsg(null), 5000); };

  useEffect(() => { stage.current = new Stage(canvas.current!, 420, 560); (window as any).__stage = stage.current; stage.current.viewer.autoRotate = true; stage.current.viewer.autoRotateSpeed = .8; return () => stage.current?.dispose(); }, []);
  useEffect(() => { const k = stage.current!; k.reduce = s.reduceMotion; k.setSkin(srcOf(cur), cur.model === "slim"); const L = loadLocker(); k.setCape(L.equipped.cloaks); k.setEquipped(L.equipped, s.classicClient); }, [cur, s.reduceMotion, s.classicClient]);
  useEffect(() => { stage.current!.setScene(view); }, [view]);

  const add = (e: SkinEntry) => { commit({ ...st, mine: [...st.mine.filter((m) => m.id !== e.id), e], active: e.id }); };
  const fromFile = async (f?: File | null) => { if (!f) return; const r = await importSkinFile(f); if (r.ok === false) return say(r.why, true); add({ id: "file-" + Date.now(), name: f.name.replace(/\.png$/i, "").slice(0, 24) || "Imported skin", model: r.model, data: r.data, origin: "file" }); say(`Imported as ${r.model}${r.legacy ? ", converted from 64×32" : ""}.`); };
  const doLookup = async () => { setBusy(true); setLook(null); const r = await lookupUsername(uname.trim()); setLook(r); setBusy(false); };
  const useLooked = () => { if (look?.status !== "found") return; add({ id: "mojang-" + Date.now(), name: look.name, model: look.model, data: look.data, origin: "mojang", from: look.name }); setLook(null); say(`Copied ${look.name}'s current skin. It is a copy: it will not change if they change theirs.`); };
  const duplicate = (x: SkinEntry) => setEditing({ ...x, origin: x.origin === "mine" ? "mine" : "luminos", id: "tmp", name: x.name });
  const del = (x: SkinEntry) => commit({ ...st, mine: st.mine.filter((m) => m.id !== x.id), active: st.active === x.id ? "luminos-default" : st.active });
  const fav = (id: string) => commit({ ...st, favs: st.favs.includes(id) ? st.favs.filter((f) => f !== id) : [...st.favs, id] });
  const apply = async () => { if (!isTauri) return say("Applying to your Mojang account needs the desktop app and a Microsoft sign-in.", true); try { await call("mojang_set_skin", { png: srcOf(cur), slim: cur.model === "slim" }); say("Applied to your Mojang account. Online-mode servers show it to everyone."); } catch (e: any) { say(String(e), true); } };
  const copyCmd = () => { navigator.clipboard?.writeText(skinsRestorerCommand(url)); say("Command copied."); };
  const report = async (reason: string) => {
    const x = reporting!; const hash = x.data ? await sha256(x.data) : "n/a"; const body = `Skin report\n\nName: ${x.name}\nOrigin: ${x.origin}${x.from ? " (" + x.from + ")" : ""}\nSHA-256: ${hash}\nReason: ${reason}\n`;
    commit({ ...st, reported: [...st.reported, x.id] }); setReporting(null);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/plain" })); a.download = `luminos-skin-report-${hash.slice(0, 8)}.txt`; a.click();
    window.open(`${ISSUES}?title=${encodeURIComponent("Skin report: " + reason)}&body=${encodeURIComponent(body)}`, "_blank"); say("Report saved. It is hidden from your library until reviewed.");
  };
  const visible = shown.filter((x) => !st.reported.includes(x.id));
  const Dot = ({ k }: { k: string }) => <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: k === "yes" ? "var(--color-ok)" : k === "needs" ? "var(--color-warn)" : "var(--color-bad)" }} />;

  return (
    <div className="grid gap-3 max-w-[1260px]" style={{ gridTemplateColumns: "280px minmax(0,1fr) 340px", height: "calc(100vh - 44px - 20px)" }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); fromFile(e.dataTransfer.files?.[0]); }}>
      <div className="panel flex flex-col min-h-0 p-2.5 gap-2">
        <div className="flex items-center justify-between"><div className="eyebrow">Skins</div><span className="t1 mute num">{all.length}</span></div>
        <SearchBox value={q} onChange={setQ} placeholder="Search skins" />
        <div className="overflow-y-auto flex-1 flex flex-col gap-1.5 pr-1">
          {visible.map((x) => (
            <div key={x.id} className="relative group">
              <button onClick={() => commit({ ...st, active: x.id })} aria-pressed={st.active === x.id} aria-label={`Skin ${x.name}`} className="tile w-full flex items-center gap-2.5 p-1.5 text-left">
                <span className="w-10 h-12 grid place-items-center shrink-0"><SkinThumb src={srcOf(x)} scale={2.4} /></span>
                <span className="min-w-0 flex-1"><span className="t2 font-semibold block truncate">{x.name}</span><span className="t1 mute block truncate">{x.model === "slim" ? "Slim" : "Classic"} · {x.origin === "luminos" ? "Luminos" : x.origin === "mine" ? "Yours" : x.origin === "mojang" ? `Copy of ${x.from}` : "Imported"}</span></span>
                {st.favs.includes(x.id) && <Icon n="star" s={12} />}
              </button>
              <div className="absolute right-1 top-1 hidden group-hover:flex gap-0.5 group-focus-within:flex" style={{ background: "var(--surface)", borderRadius: 6 }}>
                <button className="ibtn !w-6 !h-6" aria-label={`Favourite ${x.name}`} onClick={() => fav(x.id)}><Icon n="star" s={12} /></button>
                <button className="ibtn !w-6 !h-6" aria-label={`Duplicate and edit ${x.name}`} onClick={() => duplicate(x)}><Icon n="copy" s={12} /></button>
                {x.origin !== "luminos" && <button className="ibtn !w-6 !h-6" aria-label={`Delete ${x.name}`} onClick={() => del(x)}><Icon n="trash" s={12} /></button>}
              </div>
            </div>
          ))}
          {!visible.length && <div className="t2 mute p-3">No skin matches “{q}”.</div>}
        </div>
      </div>

      <div className="panel relative overflow-hidden min-h-0 flex flex-col" style={{ background: view === "scene" ? "linear-gradient(180deg,#2c2150 0%,#8a3f64 38%,#f08a5d 62%,#ffcf8a 78%)" : "var(--inset)" }}>
        <div className="flex items-center gap-2 p-2.5 z-10">
          <div className="seg" style={{ background: "var(--surface)" }}><button aria-pressed={view === "studio"} onClick={() => setView("studio")}>Studio</button><button aria-pressed={view === "scene"} onClick={() => setView("scene")}>Sunset scene</button></div>
          <div className="flex-1" />
          <span className="badge" style={{ background: "var(--surface)" }}>{cur.name}</span>
        </div>
        <div className="flex-1 min-h-0 grid place-items-center"><canvas ref={canvas} width={420} height={560} aria-label={`3D preview of ${cur.name}`} /></div>
        <div className="p-2.5 flex items-center gap-2 z-10 flex-wrap">
          <button className="btn btn-primary" onClick={apply}><Icon n="upload" s={14} />Apply to Mojang account</button>
          <button className="btn" onClick={() => duplicate(cur)}><Icon n="edit" s={14} />Edit a copy</button>
          {cur.origin !== "luminos" && cur.origin !== "mine" && <button className="btn" onClick={() => setReporting(cur)}><Icon n="flag" s={14} />Report this skin</button>}
          <a className="btn" download={`${cur.name}.png`} href={srcOf(cur)}><Icon n="download" s={14} />Download PNG</a>
        </div>
        {drag && <div className="absolute inset-0 grid place-items-center z-20 t3 font-semibold" style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)", border: "2px dashed var(--color-accent)" }}>Drop a skin PNG to import</div>}
        {msg && <div role="status" className="absolute left-1/2 -translate-x-1/2 bottom-16 z-30 px-3 py-2 rounded-lg t2 pop" style={{ background: "var(--surface-2)", border: `1px solid ${msg.bad ? "var(--color-bad)" : "var(--color-accent)"}`, maxWidth: 520 }}>{msg.t}</div>}
      </div>

      <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
        <div className="panel p-3" aria-label="Where others see this">
          <div className="eyebrow mb-2">Where others see this</div>
          <div className="flex flex-col gap-2">{VISIBILITY.map((r) => (
            <div key={r.who} className="flex gap-2"><span className="mt-1.5"><Dot k={r.sees} /></span><div><div className="t2 font-semibold">{r.who}</div><div className="t1 mute">{r.line}</div></div></div>))}
          </div>
          <div className="mt-3 pt-3 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--color-line)" }}>
            <div className="eyebrow">SkinsRestorer command</div>
            <input className="field plain" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… link to your skin PNG" aria-label="Public link to your skin PNG" />
            <div className="flex items-center gap-1.5"><code className="t1 flex-1 truncate px-2 h-8 grid items-center rounded-md" style={{ background: "var(--inset)", border: "1px solid var(--color-line)", userSelect: "text" }}>{skinsRestorerCommand(url)}</code><button className="btn" onClick={copyCmd}><Icon n="copy" s={14} />Copy</button></div>
            <div className="t1 mute">SkinsRestorer needs a public link to the PNG. Run the command in game.</div>
            <button className="btn self-start mt-1" onClick={() => setOwners(true)}><Icon n="server" s={14} />Server owner setup</button>
          </div>
        </div>

        <div className="panel p-3 flex flex-col gap-2">
          <div className="eyebrow">Import from file</div>
          <label className="btn self-start cursor-pointer"><Icon n="upload" s={14} />Choose PNG<input type="file" accept="image/png" hidden onChange={(e) => { fromFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
          <div className="t1 mute">Or drop a file on the preview. 64×64 and 64×32 PNGs. Classic or slim is detected.</div>
        </div>

        <div className="panel p-3 flex flex-col gap-2">
          <div className="eyebrow">Copy a player’s skin</div>
          <div className="flex gap-1.5"><input className="field plain" placeholder="Minecraft username" value={uname} onChange={(e) => setUname(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doLookup()} aria-label="Minecraft username" /><button className="btn" onClick={doLookup} disabled={busy || !uname}>{busy ? "Looking…" : "Look up"}</button></div>
          {look?.status === "found" && <div className="flex items-center gap-2 p-2 rounded-lg pop" style={{ background: "var(--inset)", border: "1px solid var(--color-line)" }}><SkinThumb src={look.data} scale={2.4} /><div className="flex-1 min-w-0"><div className="t2 font-semibold truncate">{look.name}</div><div className="t1 mute">{look.model === "slim" ? "Slim" : "Classic"}</div></div><button className="btn btn-primary" onClick={useLooked}>Use this skin</button></div>}
          {look && look.status !== "found" && <div role="alert" className="t2" style={{ color: "var(--color-warn)" }}>{look.why}</div>}
          <div className="t1 mute">Uses the Mojang API only. You get a copy: it does not follow their later changes.</div>
        </div>
      </div>

      {editing && <SkinEditor skin={editing} onClose={() => setEditing(null)} onSave={(e) => { add(e); setEditing(null); say(`Saved “${e.name}” to your skins.`); }} />}
      {reporting && <Modal title="Report this skin" onClose={() => setReporting(null)}>
        <div className="t2 mute mb-2">“{reporting.name}” will be hidden from your library. Pick the closest reason.</div>
        <div className="flex flex-col gap-1.5">{["Offensive or hateful content", "Sexual content", "Impersonates a real person", "Not a skin or broken file"].map((r) => <button key={r} className="btn !justify-start" onClick={() => report(r)}>{r}</button>)}</div>
        <div className="t1 mute mt-2">This saves a report file with the skin’s SHA-256 and opens a prefilled issue for the maintainers. Nothing is sent without you.</div></Modal>}
      {owners && <Modal title="Skins on your server" onClose={() => setOwners(false)} wide>
        <div className="flex flex-col gap-3 t2">
          <Sec t="Online-mode servers">Nothing to install. Players who apply a skin to their Mojang account are shown to everyone by the normal login.</Sec>
          <Sec t="skin-overrides (recommended)">Install skin-overrides on the server and on players’ clients. Its networking feature shares a player’s override with everyone online, “even if they don’t have the mod”. Source: modrinth.com/mod/skin-overrides.</Sec>
          <Sec t="SkinsRestorer">For offline-mode servers. Install the plugin, give players <code>skinsrestorer.command.set.url</code>, and they run <code>/skin url "&lt;link to PNG&gt;"</code>. <code>/skin set</code> takes a player name, not a link.</Sec>
          <Sec t="authlib-injector">Start the server with <code>-javaagent:authlib-injector.jar=&lt;your skin service&gt;</code>. Textures are then served from the standard profile endpoint. The Luminos skin service is described in docs/LUMINOS_AUTH_SERVER.md.</Sec>
          <div className="t1 mute">A client mod cannot make other players’ vanilla clients draw your skin. One of these four paths has to be in place.</div>
        </div></Modal>}
    </div>
  );
}
const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => <div><div className="t3 font-semibold mb-0.5">{t}</div><div className="mute">{children}</div></div>;
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  return <div className="fixed inset-0 z-50 grid place-items-center p-6" style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)" }} onClick={onClose}><div className="panel p-4 pop" role="dialog" aria-label={title} style={{ width: wide ? 640 : 420, maxWidth: "94vw" }} onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between mb-3"><div className="t4 font-semibold">{title}</div><button className="ibtn" aria-label="Close" onClick={onClose}><Icon n="x" s={16} /></button></div>{children}</div></div>;
}
