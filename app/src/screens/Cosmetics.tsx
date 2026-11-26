import { memo, useEffect, useMemo, useRef, useState } from "react";
import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { Pills } from "../components/ui";
import SkinEditor from "../components/SkinEditor";
import { ENVS, LockerScene, type Env, type Pose } from "../locker/scene";
import { addSkin, allSkins, ITEMS, isEquipped, newId, setSkin, skinById, skinSrc, toggleEquip, updateSkin, useLocker, type Item, type SkinRec } from "../locker/catalog";
import { fromImage, readSkinFile, toDataUrl } from "../locker/skinfile";
import { skinFront } from "../lib/art";
import { snapCape, snapSkin } from "../locker/snapshots";
import { safeInvoke } from "../lib/tauri-bridge";
import { useSettings } from "../store";

type Tab = "skins" | "capes";
const POSES: { id: Pose; label: string }[] = [{ id: "idle", label: "Idle breathe" }, { id: "sprint", label: "Sprint, cape flow" }, { id: "block", label: "Sword block-hit" }, { id: "sneak", label: "Sneak" }, { id: "turntable", label: "360° turntable" }];

/** Skin card: a real 3D skinview3d portrait (walking pose, yaw 25 deg, pitch -10 deg) rendered once offscreen; the flat 2D front view shows until it is ready. */
const SkinArt = memo(function SkinArt({ s }: { s: SkinRec }) {
  const [url, setUrl] = useState(""), [flat, setFlat] = useState("");
  useEffect(() => { let live = true; setUrl(""); snapSkin(skinSrc(s), s.model === "slim").then((u) => live && setUrl(u)).catch(() => undefined); skinFront(skinSrc(s), s.model === "slim").then((u) => live && setFlat(u)).catch(() => undefined); return () => { live = false; }; }, [s.id, s.data, s.model]);
  if (url) return <img src={url} alt={`${s.name}, 3D portrait`} data-3d="skin" className="h-full w-auto object-contain" draggable={false} />;
  return flat ? <img src={flat} alt="" className="skin-px h-full w-auto object-contain opacity-60" draggable={false} /> : <div className="h-[70%] aspect-[1/2] rounded-md opacity-30" style={{ background: "var(--surface-2)" }} />;
});
/** Cape card: the cape draped on the equipped skin from a 3/4 back view (yaw 150 deg) with the 3D relief layer, rendered offscreen once. */
const CapeArt = memo(function CapeArt({ file, skin }: { file: string; skin: SkinRec }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let live = true; setUrl(""); snapCape("/" + file, skinSrc(skin), skin.model === "slim").then((u) => live && setUrl(u)).catch(() => undefined); return () => { live = false; }; }, [file, skin.id, skin.data, skin.model]);
  return url ? <img src={url} alt="" data-3d="cape" className="h-full w-auto object-contain" draggable={false} /> : <div className="h-[70%] aspect-[1/2] rounded-md opacity-30" style={{ background: "var(--surface-2)" }} />;
});

const Card = memo(function Card({ title, tag, on, art, onEquip, label }: { title: string; tag?: string; on: boolean; art: React.ReactNode; onEquip: () => void; label?: string }) {
  return (
    <div className="card h-[215px] rounded-[12px] overflow-hidden flex flex-col justify-between">
      <div className="relative h-[173px]">
        <div className="absolute inset-x-4 top-5 bottom-3 flex items-center justify-center [&>*]:max-h-full [&>*]:max-w-full">{art}</div>
        {tag && <span className="absolute top-3 left-3.5 text-[10px] font-semibold tracking-wide px-1.5 h-[18px] rounded-[4px] grid place-items-center" style={{ background: "rgba(11,13,18,.7)", color: tag === "Meme" ? "#FCD34D" : tag === "3D" ? "#93C5FD" : "#CBD5E1" }}>{tag.toUpperCase()}</span>}
      </div>
      <button onClick={onEquip} aria-pressed={on} className="h-[42px] w-full flex items-center justify-center gap-2 text-[13px] font-semibold t press px-3" style={{ background: on ? "var(--accent)" : "var(--surface-2)", color: on ? "var(--accent-fg)" : "var(--fg)" }}>
        <span className="truncate">{label ?? title}{on ? " • Equipped" : ""}</span>
      </button>
    </div>
  );
});

function Stage({ scene, env, label, sub }: { scene: React.MutableRefObject<LockerScene | null>; env: Env; label: string; sub?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null), s = useSettings();
  useEffect(() => {
    const el = wrap.current!, sc = new LockerScene(canvas.current!, Math.max(120, el.clientWidth), Math.max(160, el.clientHeight));
    scene.current = sc;
    const ro = new ResizeObserver(() => sc.resize(Math.max(120, el.clientWidth), Math.max(160, el.clientHeight))); ro.observe(el);
    return () => { ro.disconnect(); sc.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { if (scene.current) { scene.current.reduced = s.reduceMotion; scene.current.setEnv(env); } }, [env, s.reduceMotion]);
  return (
    <div ref={wrap} className="relative flex-1 min-w-0 rounded-[16px] overflow-hidden" style={{ background: ENVS[env].css }}>
      {env === "studio" && <img src="/art/skin-studio.webp" alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" decoding="async" />}
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" aria-label={`3D preview: ${label}`} />
      <div className="absolute left-4 top-3 pointer-events-none"><div className="text-[14px] font-semibold text-white" style={{ textShadow: "0 1px 6px rgba(0,0,0,.6)" }}>{label}</div>{sub && <div className="text-[11.5px] text-white/70">{sub}</div>}</div>
    </div>
  );
}

export default function Cosmetics() {
  const L = useLocker();
  const [tab, setTab] = useState<Tab>("skins"), [edit, setEdit] = useState<SkinRec | null>(null), [uname, setUname] = useState(""), [src, setSrc] = useState<"mojang" | "ely">("mojang"), [msg, setMsg] = useState("");
  const [env, setEnv] = useState<Env>("studio"), [pose, setPose] = useState<Pose>("idle"), [compare, setCompare] = useState(false), [bId, setBId] = useState("cyber-drift");
  const A = useRef<LockerScene | null>(null), B = useRef<LockerScene | null>(null), file = useRef<HTMLInputElement>(null);
  const skin = skinById(L.skin), other = skinById(bId);
  const cape = ITEMS.find((i) => i.id === L.equipped.cloaks) ?? null;
  const tick = useRef(0);

  useEffect(() => { void A.current?.setSkin(skinSrc(skin), skin.model === "slim").catch(() => setMsg("That skin could not be drawn.")); }, [skin.id, skin.data, skin.model]);
  useEffect(() => { void B.current?.setSkin(skinSrc(other), other.model === "slim").catch(() => undefined); }, [compare, other.id, other.data]);
  useEffect(() => {
    const files = cape ? cape.frameFiles.map((f) => "/" + f) : null;
    void A.current?.setCape(files, !!cape?.relief, cape?.frameMs ?? 0).catch(() => setMsg("That cape could not be drawn."));
    void B.current?.setCape(files, !!cape?.relief, cape?.frameMs ?? 0).catch(() => undefined);
  }, [cape?.id, compare]);
  useEffect(() => { A.current?.faceBack(tab === "capes"); B.current?.faceBack(tab === "capes"); }, [tab, compare]);
  useEffect(() => { A.current?.setPose(pose); B.current?.setPose(pose); tick.current++; }, [pose, compare]);
  useEffect(() => { B.current?.setEnv(env); }, [env, compare]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 4200); return () => clearTimeout(t); }, [msg]);

  const importFile = async (f?: File | null) => {
    if (!f) return; const r = await readSkinFile(f);
    if ("error" in r) return setMsg(r.error);
    addSkin({ id: newId("imp"), name: f.name.replace(/\.png$/i, "").slice(0, 32) || "Imported", model: r.slim ? "slim" : "classic", description: "Imported file", data: toDataUrl(r.canvas), custom: true, source: "file" });
    setMsg(`Imported “${f.name}”.`); setTab("skins");
  };
  const take = (img: HTMLImageElement, name: string, from: "mojang" | "ely", slim: boolean) => {
    const c = fromImage(img, img.height === 32);
    if ("error" in c) return setMsg(c.error);
    addSkin({ id: newId(from === "ely" ? "ely" : "mj"), name, model: slim ? "slim" : "classic", description: from === "ely" ? "Copy of an Ely.by skin" : "Copy of a Mojang skin", data: toDataUrl(c.canvas), custom: true, source: from });
    setMsg(`Imported ${name}.`); setTab("skins");
  };
  const lookup = async () => {
    const n = uname.trim(); if (!n) return;
    if (src === "ely") {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => take(img, n, "ely", false);
      img.onerror = () => setMsg(`Ely.by has no skin for “${n}”, or it blocked this request.`);
      img.src = `https://skinsystem.ely.by/skins/${encodeURIComponent(n)}.png`; return;
    }
    const r: any = await safeInvoke("mojang_skin_lookup", { name: n }, null, 8000);
    if (!r) return setMsg("Mojang lookup runs in the desktop app. Mojang's servers refuse requests made from a web page.");
    if (r.status === "no_such_player") return setMsg(`No Minecraft account is named “${n}”.`);
    if (r.status === "no_skin") return setMsg(`“${r.name}” has not set a skin.`);
    const img = new Image(); img.onload = () => take(img, r.name, "mojang", !!r.slim); img.onerror = () => setMsg("The skin image could not be read."); img.src = r.png;
  };
  const saveEdit = (r: { name: string; slim: boolean; data: string; asNew: boolean }) => {
    if (!edit) return;
    if (r.asNew) addSkin({ id: newId("ed"), name: r.name.slice(0, 32), model: r.slim ? "slim" : "classic", description: "Edited in Luminos", data: r.data, custom: true, source: "editor", from: edit.id });
    else updateSkin({ ...edit, name: r.name.slice(0, 32), model: r.slim ? "slim" : "classic", data: r.data });
    setEdit(null);
  };
  const skins = useMemo(() => allSkins(L), [L.mine]);
  const btn = "h-[34px] px-3 rounded-[9px] text-[12.5px] font-medium t press flex items-center justify-center gap-2 hover:!bg-[var(--accent)] hover:!text-[var(--accent-fg)]";

  return (
    <Page fill wide>
      <div className="flex gap-6 flex-1 min-h-0">
        <section className={`${compare ? "w-[640px]" : "w-[380px]"} shrink-0 flex flex-col gap-3 min-h-0`} aria-label="Skin Showdown Studio">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-[15px] font-semibold">Skin Showdown Studio</div><div className="text-[11.5px] mute">Compare, light and pose before you equip.</div></div>
            <button className={btn} style={{ background: compare ? "var(--accent)" : "var(--surface-2)", color: compare ? "var(--accent-fg)" : "var(--fg)" }} aria-pressed={compare} onClick={() => setCompare(!compare)}>Compare</button>
          </div>
          <div className="flex gap-3 flex-1 min-h-0">
            <Stage scene={A} env={env} label={skin.name} sub={cape ? cape.name : "No cape"} />
            {compare && <Stage scene={B} env={env} label={other.name} sub="Candidate. Pick any skin to swap it in" />}
          </div>
          {compare && <button className={`${btn} w-full`} style={{ background: "var(--surface-2)" }} onClick={() => { setSkin(bId); setMsg(`${other.name} equipped.`); }}>Equip {other.name}</button>}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lighting">{(Object.keys(ENVS) as Env[]).map((e) => <button key={e} aria-pressed={env === e} onClick={() => setEnv(e)} className="h-[30px] px-2.5 rounded-[8px] text-[11.5px] font-medium t" style={{ background: env === e ? "var(--accent)" : "var(--surface-2)", color: env === e ? "var(--accent-fg)" : "var(--mute)" }}>{ENVS[e].label}</button>)}</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pose">{POSES.map((p) => <button key={p.id} aria-pressed={pose === p.id} onClick={() => setPose(p.id)} className="h-[30px] px-2.5 rounded-[8px] text-[11.5px] font-medium t" style={{ background: pose === p.id ? "var(--accent)" : "var(--surface-2)", color: pose === p.id ? "var(--accent-fg)" : "var(--mute)" }}>{p.label}</button>)}</div>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn} style={{ background: "var(--surface-2)" }} onClick={() => file.current?.click()}><Icon n="upload" s={14} />Import PNG</button>
            <button className={btn} style={{ background: "var(--surface-2)" }} onClick={() => setEdit(skin)}><Icon n="edit" s={14} />Pixel editor</button>
            <input ref={file} type="file" accept="image/png" hidden onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void lookup(); }}>
            <select aria-label="Skin source" value={src} onChange={(e) => setSrc(e.target.value as "mojang" | "ely")} className="field !h-[34px] !text-[12px] !w-[88px] !px-2"><option value="mojang">Mojang</option><option value="ely">Ely.by</option></select>
            <input className="field !h-[34px] !text-[12.5px] !pl-3 flex-1 min-w-0" placeholder="Import by username" aria-label="Import skin by username" value={uname} onChange={(e) => setUname(e.target.value)} />
          </form>
        </section>
        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="mb-5 flex items-center justify-between gap-4"><Pills value={tab} onChange={setTab} items={[{ id: "skins", label: `Skins (${skins.length})` }, { id: "capes", label: `Capes & Cloaks (${ITEMS.length})` }]} /></div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-3 gap-5 content-start">
            {tab === "skins" && skins.map((x) => <Card key={x.id} title={x.name} tag={x.model === "slim" ? "SLIM" : undefined} on={compare ? bId === x.id : L.skin === x.id} label={compare ? `${x.name}` : undefined} art={<SkinArt s={x} />} onEquip={() => (compare ? setBId(x.id) : setSkin(x.id))} />)}
            {tab === "capes" && ITEMS.map((i: Item) => <Card key={i.id} title={i.name} tag={i.tag} on={isEquipped(i, L)} art={<CapeArt file={i.capeFile} skin={skin} />} onEquip={() => toggleEquip(i)} />)}
          </div>
        </section>
      </div>
      {msg && <div role="status" className="pop fixed bottom-6 left-1/2 -translate-x-1/2 h-10 px-5 rounded-full text-[13px] flex items-center z-50 max-w-[80vw] truncate" style={{ background: "var(--side)", boxShadow: "0 8px 30px rgba(0,0,0,.5)" }}>{msg}</div>}
      {edit && <SkinEditor src={skinSrc(edit)} name={edit.name} slim={edit.model === "slim"} mine={!!edit.custom} onSave={saveEdit} onClose={() => setEdit(null)} />}
    </Page>
  );
}
