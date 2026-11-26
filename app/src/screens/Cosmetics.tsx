import { memo, useEffect, useRef, useState } from "react";
import Page from "../components/Page";
import { LockerScene } from "../locker/scene";
import { addSkin, ITEMS, isEquipped, newId, setArmModel, setSkin, skinById, skinSrc, toggleEquip, useLocker, type Item, type SkinRec } from "../locker/catalog";
import { fromImage, readSkinFile, toDataUrl } from "../locker/skinfile";
import { snapCape } from "../locker/snapshots";
import { safeInvoke } from "../lib/tauri-bridge";
import { useSettings } from "../store";

/**
 * Capes & Character Locker. Left: the player's own character (synced from Mojang or Ely.by, or an uploaded 64x64 PNG) wearing the
 * equipped cape. Right: the 3D capes. There are no preset skins here: the skin is always the player's.
 */

/** The cape on the player's skin from a 3/4 back view with the 3D relief layer, rendered once offscreen (no WebGL context per card). */
const CapeArt = memo(function CapeArt({ file, skin, name }: { file: string; skin: SkinRec; name: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true; setUrl("");
    snapCape("/" + file, skinSrc(skin), skin.model === "slim").then((u) => live && setUrl(u)).catch(() => undefined);
    return () => { live = false; };
  }, [file, skin.id, skin.data, skin.model]);
  return url
    ? <img src={url} alt={`${name}, 3D back view`} data-3d="cape" className="h-full w-auto object-contain" draggable={false} />
    : <div className="h-[72%] aspect-[1/2] rounded-md bg-[#1C2230] animate-pulse motion-reduce:animate-none" aria-hidden />;
});

const CapeCard = memo(function CapeCard({ item, skin, on }: { item: Item; skin: SkinRec; on: boolean }) {
  return (
    <div className={`rounded-[12px] bg-[#121620] overflow-hidden flex flex-col ${on ? "ring-1 ring-[#2B4BFF]" : "ring-1 ring-white/5"}`}>
      <div className="h-[176px] flex items-center justify-center px-4 pt-4 pb-1"><CapeArt file={item.capeFile} skin={skin} name={item.name} /></div>
      <div className="px-4 h-[36px] flex items-center text-[13px] font-semibold text-white truncate" title={item.name}>{item.name}</div>
      <button onClick={() => toggleEquip(item)} aria-pressed={on} aria-label={`${on ? "Unequip" : "Equip"} ${item.name}`}
        className={`h-[40px] w-full text-[12.5px] font-semibold t press flex items-center justify-center gap-2 ${on ? "bg-[#2B4BFF] text-white" : "bg-[#1C2230] text-[#C7D2FE] hover:bg-[#2B4BFF] hover:text-white"}`}>
        {on ? "✓ Equipped" : "Equip"}
      </button>
    </div>
  );
});

function Segmented<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid p-[3px] rounded-[10px] bg-[#0B0D12]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((i) => (
        <button key={i.id} onClick={() => onChange(i.id)} aria-pressed={value === i.id}
          className={`h-8 rounded-[7px] text-[12px] font-medium t press ${value === i.id ? "bg-[#1C2230] text-white" : "text-[#8A94A6] hover:text-white"}`}>{i.label}</button>
      ))}
    </div>
  );
}

export default function Cosmetics() {
  const L = useLocker(), settings = useSettings();
  const skin = skinById(L.skin);
  const cape = ITEMS.find((i) => i.id === L.equipped.cloaks) ?? null;
  const [uname, setUname] = useState(""), [src, setSrc] = useState<"mojang" | "ely">("mojang"), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false), [back, setBack] = useState(!!cape);
  const canvas = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null), scene = useRef<LockerScene | null>(null), file = useRef<HTMLInputElement>(null);

  // One WebGL context for the whole screen: the character preview.
  useEffect(() => {
    const el = wrap.current!, sc = new LockerScene(canvas.current!, Math.max(120, el.clientWidth), Math.max(160, el.clientHeight));
    scene.current = sc;
    const ro = new ResizeObserver(() => sc.resize(Math.max(120, el.clientWidth), Math.max(160, el.clientHeight))); ro.observe(el);
    return () => { ro.disconnect(); sc.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { if (scene.current) { scene.current.reduced = settings.reduceMotion; scene.current.setPose("idle"); } }, [settings.reduceMotion]);
  useEffect(() => { void scene.current?.setSkin(skinSrc(skin), skin.model === "slim").catch(() => setMsg("That skin could not be drawn.")); }, [skin.id, skin.data, skin.model]);
  useEffect(() => {
    const files = cape ? cape.frameFiles.map((f) => "/" + f) : null;
    void scene.current?.setCape(files, !!cape?.relief, cape?.frameMs ?? 0).catch(() => setMsg("That cape could not be drawn."));
    if (cape) setBack(true);
  }, [cape?.id]);
  useEffect(() => { scene.current?.faceBack(back); }, [back, cape?.id]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 5000); return () => clearTimeout(t); }, [msg]);

  const take = (img: HTMLImageElement, name: string, from: "mojang" | "ely", slim: boolean) => {
    const c = fromImage(img, img.height === 32);
    if ("error" in c) return setMsg(c.error);
    addSkin({ id: newId(from === "ely" ? "ely" : "mj"), name, model: slim ? "slim" : "classic", description: from === "ely" ? "Synced from Ely.by" : "Synced from Mojang", data: toDataUrl(c.canvas), custom: true, source: from });
    setMsg(`Synced ${name}.`); setBack(false);
  };
  const sync = async () => {
    const n = uname.trim();
    if (!n) return setMsg("Type a Minecraft username first.");
    setBusy(true);
    try {
      if (src === "ely") {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => take(img, n, "ely", false);
        img.onerror = () => setMsg(`Ely.by has no skin for “${n}”, or it blocked this request.`);
        img.src = `https://skinsystem.ely.by/skins/${encodeURIComponent(n)}.png`;
        return;
      }
      const r: any = await safeInvoke("mojang_skin_lookup", { name: n }, null, 8000);
      if (!r) return setMsg("Mojang lookup runs in the desktop app. Mojang's servers refuse requests made from a web page.");
      if (r.status === "no_such_player") return setMsg(`No Minecraft account is named “${n}”.`);
      if (r.status === "no_skin") return setMsg(`“${r.name}” has not set a skin.`);
      const img = new Image(); img.onload = () => take(img, r.name, "mojang", !!r.slim); img.onerror = () => setMsg("The skin image could not be read."); img.src = r.png;
    } finally { setBusy(false); }
  };
  const upload = async (f?: File | null) => {
    if (!f) return;
    const r = await readSkinFile(f);
    if ("error" in r) return setMsg(r.error);
    addSkin({ id: newId("imp"), name: f.name.replace(/\.png$/i, "").slice(0, 32) || "My skin", model: r.slim ? "slim" : "classic", description: "Uploaded PNG", data: toDataUrl(r.canvas), custom: true, source: "file" });
    setMsg(`Loaded “${f.name}”.`); setBack(false);
  };
  const useDefault = () => { setSkin("default"); setMsg("Back to the neutral default character."); };

  const field = "w-full h-10 px-3 rounded-[10px] text-[13px] outline-none bg-[#0B0D12] text-white placeholder:text-[#64748B] focus-visible:ring-2 focus-visible:ring-[#2B4BFF]";
  return (
    <Page fill wide>
      <div className="flex gap-6 flex-1 min-h-0">
        <section aria-label="Your character" className="w-[320px] shrink-0 min-h-0 flex flex-col gap-5 rounded-[16px] bg-[#121620] p-6 overflow-y-auto">
          <header className="space-y-0.5">
            <h1 className="m-0 text-[16px] font-bold text-white">Your Character</h1>
            <p className="m-0 text-[12px] text-[#8A94A6] truncate" title={skin.name}>{skin.name} · {skin.model === "slim" ? "Slim arms" : "Classic arms"}{cape ? ` · ${cape.name}` : ""}</p>
          </header>
          <div ref={wrap} className="relative flex-1 min-h-[260px] rounded-[12px] overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 28%, #1B2236 0%, #0B0D12 74%)" }}>
            <canvas ref={canvas} className="absolute inset-0 w-full h-full" aria-label={`3D preview: ${skin.name}${cape ? " wearing " + cape.name : ""}`} />
            <div className="absolute bottom-3 inset-x-0 flex justify-center"><div className="w-[140px]"><Segmented label="View" value={back ? "back" : "front"} onChange={(v) => setBack(v === "back")} items={[{ id: "front", label: "Front" }, { id: "back", label: "Back" }]} /></div></div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={uname} onChange={(e) => setUname(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void sync()} placeholder="Minecraft username" aria-label="Minecraft username" maxLength={16} className={field} />
                <div className="w-[108px] shrink-0"><Segmented<"mojang" | "ely"> label="Skin source" value={src} onChange={setSrc} items={[{ id: "mojang", label: "Mojang" }, { id: "ely", label: "Ely.by" }]} /></div>
              </div>
              <button onClick={() => void sync()} disabled={busy} className="h-10 w-full rounded-[10px] text-[13px] font-semibold text-white t press disabled:opacity-60" style={{ background: "#2B4BFF" }}>{busy ? "Syncing…" : "Sync from Minecraft Username"}</button>
            </div>
            <div className="space-y-2">
              <input ref={file} type="file" accept="image/png" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
              <button onClick={() => file.current?.click()} className="h-10 w-full rounded-[10px] text-[13px] font-medium text-white bg-[#1C2230] hover:bg-[#252D40] t press">Upload Custom Skin (.PNG)</button>
              {skin.id !== "default" && <button onClick={useDefault} className="h-8 w-full rounded-[8px] text-[12px] text-[#8A94A6] hover:text-white t">Use the neutral default instead</button>}
            </div>
            <Segmented label="Arm model" value={skin.model === "slim" ? "slim" : "classic"} onChange={(v) => setArmModel(v === "slim")} items={[{ id: "classic", label: "Classic (4px)" }, { id: "slim", label: "Slim (3px)" }]} />
            <div role="status" aria-live="polite" className="min-h-[18px] text-[12px] text-[#93C5FD]">{msg}</div>
          </div>
        </section>

        <section aria-label="3D capes" className="flex-1 min-w-0 min-h-0 flex flex-col gap-6">
          <header className="flex items-start justify-between gap-6">
            <div className="space-y-1 min-w-0">
              <h2 className="m-0 text-[20px] font-bold text-white">3D Capes &amp; Cloaks</h2>
              <p className="m-0 text-[13px] text-[#8A94A6]">Equip a 3D layered cloak for in-game third-person and Freelook</p>
            </div>
            <button onClick={() => cape && toggleEquip(cape)} disabled={!cape} className="h-10 px-4 shrink-0 rounded-[10px] text-[13px] font-medium text-white bg-[#1C2230] hover:bg-[#252D40] t press disabled:opacity-40 disabled:pointer-events-none">Unequip Cape</button>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
            <div className="grid grid-cols-3 gap-5 pb-4">
              {ITEMS.map((i) => <CapeCard key={i.id} item={i} skin={skin} on={isEquipped(i, L)} />)}
            </div>
          </div>
        </section>
      </div>
    </Page>
  );
}
