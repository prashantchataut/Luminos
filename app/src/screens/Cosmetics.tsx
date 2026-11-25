import { memo, useEffect, useMemo, useRef, useState } from "react";
import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { Pills } from "../components/ui";
import SkinEditor from "../components/SkinEditor";
import { LockerScene } from "../locker/scene";
import type { EmoteId } from "../locker/pets";
import { addSkin, allSkins, ITEMS, isEquipped, newId, setSkin, skinById, skinSrc, toggleEquip, updateSkin, useLocker, type Item, type SkinRec } from "../locker/catalog";
import { fromImage, readSkinFile, toDataUrl } from "../locker/skinfile";
import { cosmeticArt, skinFront } from "../lib/art";
import { safeInvoke } from "../lib/tauri-bridge";
import { useSettings } from "../store";

type Tab = "skins" | "wings" | "cloaks" | "emotes" | "pets";
const TABS: { id: Tab; label: string }[] = [{ id: "skins", label: "Skins" }, { id: "wings", label: "Wings" }, { id: "cloaks", label: "Cloaks" }, { id: "emotes", label: "Emotes" }, { id: "pets", label: "Pets" }];

/** Cached 2D art. No WebGL anywhere in a card. */
const SkinArt = memo(function SkinArt({ s }: { s: SkinRec }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let live = true; skinFront(skinSrc(s), s.model === "slim").then((u) => live && setUrl(u)).catch(() => undefined); return () => { live = false; }; }, [s.id, s.data, s.model]);
  return url ? <img src={url} alt="" className="skin-px h-full w-auto object-contain" draggable={false} /> : <div className="h-[70%] aspect-[1/2] rounded-md opacity-30" style={{ background: "var(--surface-2)" }} />;
});
const CapeArt = memo(function CapeArt({ file }: { file: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const i = new Image(); i.onload = () => { const g = ref.current?.getContext("2d"); if (g) { g.imageSmoothingEnabled = false; g.drawImage(i, 1, 1, 10, 16, 0, 0, 10, 16); } }; i.src = "/" + file; }, [file]);
  return <canvas ref={ref} width={10} height={16} className="skin-px h-full w-auto object-contain" aria-hidden="true" />;
});

const Card = memo(function Card({ title, tag, on, art, onEquip }: { title: string; tag?: string; on: boolean; art: React.ReactNode; onEquip: () => void }) {
  return (
    <div className="card h-[215px] rounded-[12px] overflow-hidden flex flex-col justify-between">
      <div className="relative h-[173px]"><div className="absolute inset-x-4 top-5 bottom-3 flex items-center justify-center [&>*]:max-h-full [&>*]:max-w-full">{art}</div>{tag && <span className="absolute top-3 left-3.5 text-[10px] font-semibold tracking-wide" style={{ color: "var(--mute)" }}>{tag}</span>}</div>
      <button onClick={onEquip} aria-pressed={on} className="h-[42px] w-full flex items-center justify-center gap-2 text-[13px] font-semibold t press px-3" style={{ background: on ? "var(--accent)" : "var(--surface-2)", color: on ? "var(--accent-fg)" : "var(--mute)" }}>
        <span className="truncate">{title}{on ? " • Equipped" : ""}</span>
      </button>
    </div>
  );
});

export default function Cosmetics() {
  const L = useLocker(), s = useSettings();
  const [tab, setTab] = useState<Tab>("skins"), [edit, setEdit] = useState<SkinRec | null>(null), [uname, setUname] = useState(""), [msg, setMsg] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null), scene = useRef<LockerScene | null>(null), file = useRef<HTMLInputElement>(null);
  const skin = skinById(L.skin);

  // The ONLY WebGL context in the app. Created on mount, fully disposed (renderer + context) on unmount.
  useEffect(() => {
    const el = wrap.current!, sc = new LockerScene(canvas.current!, Math.max(120, el.clientWidth), Math.max(160, el.clientHeight));
    sc.transparent = true; sc.v.zoom = 0.5; sc.setMode("studio"); sc.fps = 45; scene.current = sc;
    const ro = new ResizeObserver(() => sc.resize(Math.max(120, el.clientWidth), Math.max(160, el.clientHeight))); ro.observe(el);
    const vis = () => { sc.paused = document.hidden || !!document.documentElement.dataset.modal; };
    const mo = new MutationObserver(vis); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-modal"] });
    document.addEventListener("visibilitychange", vis);
    return () => { ro.disconnect(); mo.disconnect(); document.removeEventListener("visibilitychange", vis); sc.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.setSkin(skinSrc(skin), skin.model === "slim").catch(() => setMsg("That skin could not be drawn.")); }, [skin.id, skin.data, skin.model]);
  useEffect(() => { scene.current?.setEquipped(L.equipped); }, [L.equipped]);
  useEffect(() => {
    const c = ITEMS.find((i) => i.id === L.equipped.cloaks);
    if (!c?.capeFile) { void scene.current?.setCape(null); return; }
    const im = new Image(); im.onload = () => { const cv = document.createElement("canvas"); cv.width = im.width; cv.height = im.height; cv.getContext("2d")!.drawImage(im, 0, 0); void scene.current?.setCape(cv.toDataURL()); }; im.src = "/" + c.capeFile;
  }, [L.equipped.cloaks]);
  useEffect(() => { const e = L.equipped.emotes; scene.current?.playEmote(e ? (e.slice(6) as EmoteId) : null); }, [L.equipped.emotes]);
  useEffect(() => { if (scene.current) scene.current.reduced = s.reduceMotion; }, [s.reduceMotion]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 3600); return () => clearTimeout(t); }, [msg]);

  const items = useMemo(() => ITEMS.filter((i) => i.cat === tab), [tab]);
  const importFile = async (f?: File | null) => {
    if (!f) return; const r = await readSkinFile(f);
    if ("error" in r) return setMsg(r.error);
    addSkin({ id: newId("imp"), name: f.name.replace(/\.png$/i, "").slice(0, 32) || "Imported", model: r.slim ? "slim" : "classic", description: "Imported file", data: toDataUrl(r.canvas), custom: true, source: "file" });
    setMsg(`Imported “${f.name}”.`); setTab("skins");
  };
  const lookup = async () => {
    const n = uname.trim(); if (!n) return;
    const r: any = await safeInvoke("mojang_skin_lookup", { name: n }, null, 8000);
    if (!r) return setMsg("Username lookup runs in the desktop app. Mojang's servers refuse requests made from a web page.");
    if (r.status === "no_such_player") return setMsg(`No Minecraft account is named “${n}”.`);
    if (r.status === "no_skin") return setMsg(`“${r.name}” has not set a skin.`);
    const img = new Image(); img.onload = () => { const c = fromImage(img, img.height === 32); if (!("error" in c)) { addSkin({ id: newId("mj"), name: r.name, model: r.slim ? "slim" : "classic", description: "Copy of a Mojang skin", data: toDataUrl(c.canvas), custom: true, source: "mojang" }); setMsg(`Saved a copy of ${r.name}'s skin.`); setTab("skins"); setUname(""); } }; img.src = r.png;
  };
  const saveEdit = (r: { name: string; slim: boolean; data: string; asNew: boolean }) => {
    if (!edit) return;
    if (r.asNew) addSkin({ id: newId("ed"), name: r.name.slice(0, 32), model: r.slim ? "slim" : "classic", description: "Edited in Luminos", data: r.data, custom: true, source: "editor", from: edit.id });
    else updateSkin({ ...edit, name: r.name.slice(0, 32), model: r.slim ? "slim" : "classic", data: r.data });
    setEdit(null);
  };
  const equippedNames = [L.equipped.wings, L.equipped.cloaks, L.equipped.pets].filter(Boolean).length;

  return (
    <Page fill wide>
      <div className="flex gap-7 flex-1 min-h-0">
        <section className="w-[340px] shrink-0 rounded-[16px] p-6 flex flex-col justify-between min-h-0" style={{ background: "#121620" }} aria-label="Preview">
          <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-[15px] font-semibold truncate">{skin.name}</div><div className="text-[11.5px] mute">{equippedNames ? `${equippedNames} cosmetic${equippedNames > 1 ? "s" : ""} on` : "Skin only"}</div></div><span className="h-6 px-2.5 rounded-full text-[11px] font-semibold grid place-items-center" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>Equipped</span></div>
          <div ref={wrap} className="flex-1 min-h-0 flex items-center justify-center relative"><canvas ref={canvas} className="absolute inset-0 w-full h-full" aria-label={`3D preview of ${skin.name}`} /></div>
          <div className="grid grid-cols-2 gap-2.5 pt-4">
            <button className="h-[38px] rounded-[9px] text-[12.5px] font-medium t press flex items-center justify-center gap-2 hover:!bg-[var(--accent)] hover:!text-[var(--accent-fg)]" style={{ background: "#1B202C" }} onClick={() => file.current?.click()}><Icon n="upload" s={14} />Import Skin PNG</button>
            <button className="h-[38px] rounded-[9px] text-[12.5px] font-medium t press flex items-center justify-center gap-2 hover:!bg-[var(--accent)] hover:!text-[var(--accent-fg)]" style={{ background: "#1B202C" }} onClick={() => setEdit(skin)}><Icon n="edit" s={14} />Pixel Skin Editor</button>
            <input ref={file} type="file" accept="image/png" hidden onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        </section>
        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Pills value={tab} onChange={setTab} items={TABS} />
            <form className="relative w-[210px] shrink-0" onSubmit={(e) => { e.preventDefault(); void lookup(); }}><Icon n="search" s={14} className="absolute left-3 top-[10px] mute pointer-events-none" /><input className="field !h-[34px] !text-[12.5px] !pl-9" placeholder="Mojang / Ely.by username" aria-label="Username lookup" value={uname} onChange={(e) => setUname(e.target.value)} /></form>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 grid grid-cols-3 gap-5 content-start">
            {tab === "skins" && allSkins(L).map((x) => <Card key={x.id} title={x.name} tag={x.model === "slim" ? "SLIM" : "CLASSIC"} on={L.skin === x.id} art={<SkinArt s={x} />} onEquip={() => setSkin(x.id)} />)}
            {tab !== "skins" && items.map((i: Item) => <Card key={i.id} title={i.name} tag={i.animated || tab === "emotes" || tab === "wings" ? "ANIMATED" : undefined} on={isEquipped(i, L)} art={i.capeFile ? <CapeArt file={i.capeFile} /> : <img src={cosmeticArt(i.id, i.cat)} alt="" className="h-full w-auto" draggable={false} />} onEquip={() => toggleEquip(i)} />)}
          </div>
        </section>
      </div>
      {msg && <div role="status" className="pop fixed bottom-6 left-1/2 -translate-x-1/2 h-10 px-5 rounded-full text-[13px] flex items-center z-50 max-w-[80vw] truncate" style={{ background: "var(--side)", boxShadow: "0 8px 30px rgba(0,0,0,.5)" }}>{msg}</div>}
      {edit && <SkinEditor src={skinSrc(edit)} name={edit.name} slim={edit.model === "slim"} mine={!!edit.custom} onSave={saveEdit} onClose={() => setEdit(null)} />}
    </Page>
  );
}
