import { useEffect, useMemo, useRef, useState } from "react";
import { FlyingAnimation, IdleAnimation, RunningAnimation, SkinViewer, WalkingAnimation } from "skinview3d";
import type { Boot } from "../App";
import { Badge, Chip, Icon, SearchBox, SkinThumb } from "../kit";
import { library, OUTFITS_SEED } from "../data/launcher";
import { useSettings } from "../store";

type SkinItem = { id: string; name: string; category: string; description: string; file: string; model: string; author: string; licence: string; source: string; data?: string };
type Cape = (typeof library.capes)[number];
const FOLDERS = ["All", "Favourites", "survival", "pvp", "builder", "cute", "spooky", "minimal", "Imported"];
const LS = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem("luminos.cos." + k) || "null") ?? d; } catch { return d; } };
const save = (k: string, v: any) => { try { localStorage.setItem("luminos.cos." + k, JSON.stringify(v)); } catch { /* quota */ } };
const url = (f: string) => "/" + f;

function CapeThumb({ cape, selected, onClick }: { cape: Cape; selected: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const im = new Image(); im.src = url(cape.file); im.onload = () => { const g = ref.current!.getContext("2d")!; g.imageSmoothingEnabled = false; g.drawImage(im, 1, 1, 10, 16, 0, 0, 10, 16); }; }, [cape]);
  return (
    <button onClick={onClick} title={`${cape.name}${cape.animated ? " (animated)" : ""}`} aria-label={`Cape ${cape.name}`} aria-pressed={selected} className="lift relative rounded-md p-1 grid place-items-center" style={{ border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-line)"}`, background: selected ? "rgba(143,180,255,.18)" : "rgba(2,4,13,.35)" }}>
      <canvas ref={ref} width={10} height={16} className="skin-px" style={{ width: 25, height: 40 }} />
      {cape.animated && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />}
    </button>
  );
}

export default function Cosmetics(_props: { boot: Boot }) {
  const s = useSettings();
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<SkinViewer | null>(null);
  const capeTimer = useRef<number>(0);
  const [imported, setImported] = useState<SkinItem[]>(() => LS("imported", []));
  const [favs, setFavs] = useState<string[]>(() => LS("favs", ["vanguard", "mochi", "foreman-flint"]));
  const [outfits, setOutfits] = useState<any[]>(() => LS("outfits", OUTFITS_SEED));
  const [folder, setFolder] = useState("All");
  const [q, setQ] = useState("");
  const [skinId, setSkinId] = useState("vanguard");
  const [capeId, setCapeId] = useState<string | null>("luminos-moon");
  const [model, setModel] = useState<"default" | "slim">("default");
  const [wings, setWings] = useState(false);
  const [anim, setAnim] = useState<"idle" | "walk" | "run" | "fly">("walk");
  const [spin, setSpin] = useState(true);
  const [tab, setTab] = useState<"skins" | "capes">("skins");
  const [msg, setMsg] = useState("");
  const [uname, setUname] = useState("");
  const [lookup, setLookup] = useState<any>(null);

  const all: SkinItem[] = useMemo(() => [...(library.skins as SkinItem[]), ...imported], [imported]);
  const skin = all.find((x) => x.id === skinId) || all[0];
  const cape = library.capes.find((c) => c.id === capeId) || null;
  const shown = all.filter((x) => (folder === "All" || (folder === "Favourites" ? favs.includes(x.id) : folder === "Imported" ? !!x.data : x.category === folder)) && (!q || (x.name + x.description + x.category).toLowerCase().includes(q.toLowerCase())));
  const note = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  useEffect(() => {
    const v = new SkinViewer({ canvas: canvas.current!, width: 400, height: 520, zoom: 0.85, fov: 40 });
    v.autoRotate = true; v.autoRotateSpeed = 0.6; v.controls.enableZoom = false; v.animation = new WalkingAnimation(); viewer.current = v;
    (window as any).__viewer = v;
    return () => v.dispose();
  }, []);
  useEffect(() => { const v = viewer.current!; v.autoRotate = spin && !s.reduceMotion; }, [spin, s.reduceMotion]);
  useEffect(() => { const v = viewer.current!; v.animation = { idle: new IdleAnimation(), walk: new WalkingAnimation(), run: new RunningAnimation(), fly: new FlyingAnimation() }[anim]; }, [anim]);
  useEffect(() => { viewer.current!.loadSkin(skin.data || url(skin.file), { model }).catch(() => note("That skin could not be loaded.")); }, [skin, model]);
  useEffect(() => {
    const v = viewer.current!; clearInterval(capeTimer.current);
    if (!cape) { v.loadCape(null); return; }
    const opt = { backEquipment: wings ? "elytra" : "cape" } as const;
    const im = new Image(); im.src = url(cape.file);
    im.onload = () => {
      const c = document.createElement("canvas"); c.width = 64; c.height = 32; const g = c.getContext("2d")!;
      let f = 0; const draw = () => { g.clearRect(0, 0, 64, 32); g.drawImage(im, 0, (f % cape.frames) * 32, 64, 32, 0, 0, 64, 32); v.loadCape(c, opt); f++; };
      draw(); if (cape.animated && !s.reduceMotion) capeTimer.current = window.setInterval(draw, Math.max(60, cape.frameMs));
    };
    return () => clearInterval(capeTimer.current);
  }, [cape, wings, s.reduceMotion]);

  const toggleFav = (id: string) => { const n = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]; setFavs(n); save("favs", n); };
  const saveOutfit = () => { const o = [...outfits, { id: "o" + Date.now(), name: `${skin.name} + ${cape?.name || "no cape"}`, skin: skin.id, cape: capeId, wings }]; setOutfits(o); save("outfits", o); note("Outfit saved."); };
  const applyOutfit = (o: any) => { setSkinId(o.skin); setCapeId(o.cape); setWings(!!o.wings); };
  const addImported = (name: string, data: string) => {
    const im = new Image(); im.src = data;
    im.onload = () => {
      if (!((im.width === 64 && (im.height === 64 || im.height === 32)))) { note(`Skins must be 64×64 (or legacy 64×32). This file is ${im.width}×${im.height}.`); return; }
      const it: SkinItem = { id: "imp-" + Date.now(), name, category: "imported", description: "Imported by you", file: "", model: "classic", author: "You", licence: "Your own file", source: "import", data };
      const n = [...imported, it]; setImported(n); save("imported", n); setSkinId(it.id); setFolder("Imported"); note(`Imported “${name}”.`);
    };
    im.onerror = () => note("That file is not a PNG image.");
  };
  const fromFile = (f?: File | null) => { if (!f) return; const r = new FileReader(); r.onload = () => addImported(f.name.replace(/\.png$/i, ""), String(r.result)); r.readAsDataURL(f); };
  const fromName = async () => {
    if (!uname) return; note(`Looking up ${uname}…`); setLookup(null);
    try {
      const blob = await (await fetch(`https://minotar.net/skin/${encodeURIComponent(uname)}`)).blob();
      const data: string = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(blob); });
      addImported(uname, data);
      const c = await (await fetch(`https://api.capes.dev/load/${encodeURIComponent(uname)}`)).json();
      setLookup(c);
    } catch { note("Lookup failed. Check the name or your connection."); }
  };
  const shot = () => canvas.current!.toBlob((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b!); a.download = `${skin.id}.png`; a.click(); });

  const Seg = ({ v, o }: { v: string; o: [string, string][] }) => <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>{o.map(([k, l]) => <button key={k} className="px-2.5 h-7 t1 font-semibold" aria-pressed={v === k} onClick={() => (["idle", "walk", "run", "fly"].includes(k) ? setAnim(k as any) : setModel(k as any))} style={{ background: v === k ? "rgba(143,180,255,.22)" : "transparent", color: v === k ? "#fff" : "var(--color-mute)" }}>{l}</button>)}</div>;

  return (
    <div className="grid gap-3 max-w-[1220px]" style={{ gridTemplateColumns: "300px minmax(0,1fr) 300px", height: "calc(100vh - 44px - 20px)" }}>
      {/* wardrobe */}
      <div className="glass flex flex-col min-h-0 p-2.5">
        <div className="flex gap-1.5 mb-2"><Chip on={tab === "skins"} onClick={() => setTab("skins")} icon="shirt">Skins <span className="num mute">{all.length}</span></Chip><Chip on={tab === "capes"} onClick={() => setTab("capes")} icon="wings">Capes <span className="num mute">{library.capes.length}</span></Chip></div>
        {tab === "skins" ? (<>
          <div className="flex mb-2"><SearchBox value={q} onChange={setQ} placeholder="Search your wardrobe" /></div>
          <div className="flex flex-wrap gap-1 mb-2">{FOLDERS.map((f) => <Chip key={f} on={folder === f} onClick={() => setFolder(f)} icon={f === "Favourites" ? "star" : f === "Imported" ? "upload" : "folder"}><span className="capitalize">{f}</span></Chip>)}</div>
          <div className="grid grid-cols-4 gap-1.5 overflow-y-auto pr-1 flex-1 content-start">
            {shown.map((x) => (
              <div key={x.id} className="relative group">
                <button onClick={() => setSkinId(x.id)} title={`${x.name} · ${x.category}`} aria-label={`Skin ${x.name}`} aria-pressed={skinId === x.id} className="lift w-full rounded-lg grid place-items-center py-1.5" style={{ border: `1px solid ${skinId === x.id ? "var(--color-accent)" : "var(--color-line)"}`, background: skinId === x.id ? "rgba(143,180,255,.18)" : "rgba(2,4,13,.35)" }}>
                  <SkinThumb src={x.data || url(x.file)} scale={2.4} />
                </button>
                <button aria-label={`${favs.includes(x.id) ? "Unfavourite" : "Favourite"} ${x.name}`} onClick={() => toggleFav(x.id)} className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100" style={{ opacity: favs.includes(x.id) ? 1 : undefined, color: favs.includes(x.id) ? "var(--color-warn)" : "var(--color-mute)" }}><Icon n="star" s={11} /></button>
              </div>
            ))}
          </div>
        </>) : (
          <div className="overflow-y-auto flex-1">
            <div className="eyebrow mb-1.5">Luminos capes · CC0</div>
            <div className="grid grid-cols-6 gap-1.5 mb-3">{library.capes.map((c) => <CapeThumb key={c.id} cape={c} selected={capeId === c.id} onClick={() => setCapeId(c.id)} />)}</div>
            <button className="btn w-full mb-3" onClick={() => setCapeId(null)}><Icon n="x" s={12} />No cape</button>
            <div className="eyebrow mb-1.5">Mojang · OptiFine · LabyMod</div>
            <p className="t1 mute mb-2">Look up any account’s official capes through capes.dev. They are fetched live, never bundled.</p>
            <div className="flex gap-1.5"><input className="field !pl-2.5" placeholder="Player name" value={uname} onChange={(e) => setUname(e.target.value.trim())} aria-label="Player name" onKeyDown={(e) => e.key === "Enter" && fromName()} /><button className="btn" onClick={fromName}>Look up</button></div>
            {lookup && <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(lookup).filter(([, v]: any) => v?.exists).map(([k, v]: any) => <a key={k} href={v.imageUrl} target="_blank" rel="noreferrer" className="chip"><Icon n="ext" s={10} />{k}</a>)}{!Object.values(lookup).some((v: any) => v?.exists) && <span className="t1 mute">No Mojang, OptiFine or LabyMod cape found for this name.</span>}</div>}
          </div>
        )}
      </div>

      {/* viewer */}
      <div className="glass relative overflow-hidden min-h-0 flex flex-col">
        <div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 62%, rgba(143,180,255,.2), transparent 70%)" }} />
        <div className="relative flex items-center justify-between p-2.5 z-10">
          <Seg v={anim} o={[["idle", "Idle"], ["walk", "Walk"], ["run", "Run"], ["fly", "Fly"]]} />
          <div className="flex items-center gap-1.5"><Seg v={model} o={[["default", "Classic"], ["slim", "Slim"]]} />
            <button className="chip" data-on={wings} onClick={() => setWings(!wings)} title="Show the cape as elytra wings"><Icon n="wings" s={12} />Wings</button>
            <button className="ibtn" title="Rotate" aria-label="Toggle rotation" aria-pressed={spin} onClick={() => setSpin(!spin)}><Icon n="rot" s={14} /></button>
            <button className="ibtn" title="Save screenshot" aria-label="Save screenshot" onClick={shot}><Icon n="download" s={14} /></button></div>
        </div>
        <div className="flex-1 min-h-0 grid place-items-center relative"><canvas ref={canvas} aria-label={`3D preview of ${skin.name}`} style={{ width: 400, height: 520, maxHeight: "100%" }} /></div>
        <div className="relative p-2.5 flex items-end justify-between z-10">
          <div><div className="t3 font-semibold">{skin.name}</div><div className="t1 mute">{skin.description}</div><div className="t1 mute mt-0.5">{skin.author} · {skin.licence}{cape ? ` · cape ${cape.name}` : ""}</div></div>
          <Badge tone="warn">Offline view: others see it only with the Luminos mod</Badge>
        </div>
      </div>

      {/* outfit + import */}
      <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-0.5">
        <div className="glass p-2.5">
          <div className="flex items-center justify-between mb-1.5"><div className="eyebrow">Outfits</div><button className="btn !h-6" onClick={saveOutfit}><Icon n="plus" s={11} />Save current</button></div>
          {outfits.map((o) => { const sk = all.find((x) => x.id === o.skin); return sk ? (
            <button key={o.id} className="lrow w-full text-left" onClick={() => applyOutfit(o)} aria-label={`Apply outfit ${o.name}`}><span className="w-6 grid place-items-center"><SkinThumb src={sk.data || url(sk.file)} scale={1.5} bust /></span><span className="flex-1 min-w-0"><span className="t2 font-medium block truncate">{o.name}</span><span className="t1 mute block truncate">{sk.name} · {library.capes.find((c) => c.id === o.cape)?.name || "no cape"}{o.wings ? " · wings" : ""}</span></span></button>) : null; })}
        </div>
        <div className="glass p-2.5">
          <div className="eyebrow mb-1.5">Import</div>
          <label className="btn w-full mb-1.5 cursor-pointer"><Icon n="upload" s={12} />Skin file (.png)<input type="file" accept="image/png" className="sr-only" onChange={(e) => fromFile(e.target.files?.[0])} /></label>
          <div className="flex gap-1.5 mb-1.5"><input className="field !pl-2.5" placeholder="Username" value={uname} onChange={(e) => setUname(e.target.value.trim())} aria-label="Import by username" onKeyDown={(e) => e.key === "Enter" && fromName()} /><button className="btn" onClick={fromName}>Fetch</button></div>
          <p className="t1 mute">Names resolve through minotar.net; capes through capes.dev. Nothing you fetch is uploaded.</p>
          {msg && <div className="t1 mt-1.5 rise" role="status" style={{ color: "var(--color-warn)" }}>{msg}</div>}
        </div>
        <div className="glass p-2.5">
          <div className="eyebrow mb-1.5">Find more · opens in your browser</div>
          <a className="lrow" href={`https://namemc.com/search?q=${encodeURIComponent(skin.name)}`} target="_blank" rel="noreferrer"><Icon n="ext" s={14} /><span className="t2 flex-1">Find this skin on NameMC</span></a>
          <a className="lrow" href="https://mc-skins.net/" target="_blank" rel="noreferrer"><Icon n="ext" s={14} /><span className="t2 flex-1">Skin libraries (link-out only)</span></a>
          <p className="t1 mute mt-1">Community libraries forbid or gate bulk copying, so we link instead of mirroring. See docs/research/SKINS_AND_CAPES.md.</p>
        </div>
      </div>
    </div>
  );
}
