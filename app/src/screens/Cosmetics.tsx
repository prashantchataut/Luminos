import { useEffect, useMemo, useRef, useState } from "react";
import type { Boot } from "../App";
import { call, isTauri } from "../api";
import { Badge, Icon, SearchBox, SkinThumb } from "../kit";
import { addSkin, allSkins, BUNDLES, bundleOn, equipBundle, CATS, Cat, getLocker, Item, ITEMS, isEquipped, newId, removeSkin, reportSkin, setClassic, setSkin, SkinRec, skinById, skinSrc, toggleEquip, toggleFav, updateSkin, useLocker } from "../locker/catalog";
import { EmoteId, Move, MOVES } from "../locker/pets";
import { LockerScene, Mode } from "../locker/scene";
import { snap, snapCached } from "../locker/snap";
import SkinEditor from "../locker/SkinEditor";
import { readSkinFile, toDataUrl, fromImage } from "../locker/skinfile";
import Visibility from "../locker/Visibility";
import { useSettings } from "../store";

type Tab = "all" | "skins" | "cloaks" | "wings" | "emotes" | "pets" | "hats" | "bundles";
const TABS: [Tab, string][] = [["all", "All"], ["skins", "Skins"], ["cloaks", "Cloaks"], ["wings", "Wings"], ["emotes", "Emotes"], ["pets", "Pets"], ["hats", "Hats & Masks"], ["bundles", "Bundles"]];
type Card = { key: string; id: string; kind: "skin" | "item" | "bundle"; name: string; sub: string; badge: string; on: boolean; fav: boolean; item?: Item; skin?: SkinRec; bundle?: (typeof BUNDLES)[number] };
const BADGE: Record<string, string> = { pets: "PET", wings: "WINGS", hats: "HAT", masks: "MASK", bandanas: "BAND", cloaks: "CLOAK", back: "BACK", emotes: "EMOTE" };
const MOVE_LABEL: Record<Move, string> = { idle: "Idle", walk: "Walk", jump: "Jump", swim: "Swim", hurt: "Hurt" };

function CapeTile({ file }: { file: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const im = new Image(); im.src = "/" + file; im.onload = () => { const g = ref.current?.getContext("2d"); if (g) { g.imageSmoothingEnabled = false; g.drawImage(im, 1, 1, 10, 16, 0, 0, 10, 16); } }; }, [file]);
  return <canvas ref={ref} width={10} height={16} className="skin-px" style={{ width: 25, height: 40 }} />;
}

export default function Cosmetics({ boot, q, setQ }: { boot: Boot; q: string; setQ: (v: string) => void }) {
  const L = useLocker(), s = useSettings();
  const canvas = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null), scene = useRef<LockerScene | null>(null);
  const [tab, setTab] = useState<Tab>("all"), [imp, setImp] = useState(false), [imgs, setImgs] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>("studio"), [move, setMove] = useState<Move>("idle"), [spin, setSpin] = useState(true);
  const [note, setNote] = useState<{ ok: boolean; t: string } | null>(null), [focus, setFocus] = useState<Item | null>(null);
  const [edit, setEdit] = useState<SkinRec | null>(null), [uname, setUname] = useState(""), [found, setFound] = useState<any>(null), [busy, setBusy] = useState(false), [drag, setDrag] = useState(false);
  const say = (t: string, ok = true) => { setNote({ ok, t }); setTimeout(() => setNote(null), 6000); };

  const skin = skinById(L.skin), skins = allSkins(L);
  // 3D scene lifecycle
  useEffect(() => {
    const el = wrap.current!, sc = new LockerScene(canvas.current!, el.clientWidth, el.clientHeight); sc.transparent = true; sc.v.zoom = 0.4; sc.setMode("studio"); scene.current = sc;
    const ro = new ResizeObserver(() => sc.resize(el.clientWidth, el.clientHeight)); ro.observe(el);
    return () => { ro.disconnect(); sc.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.setSkin(skinSrc(skin), skin.model === "slim").catch(() => say("That skin could not be drawn.", false)); }, [skin.id, skin.data, skin.model]);
  useEffect(() => { scene.current?.setEquipped(L.equipped); }, [L.equipped]);
  useEffect(() => { const c = ITEMS.find((i) => i.id === L.equipped.cloaks); if (!c?.capeFile) { scene.current?.setCape(null); return; } const im = new Image(); im.src = "/" + c.capeFile; im.onload = () => { const cv = document.createElement("canvas"); cv.width = 64; cv.height = 32; cv.getContext("2d")!.drawImage(im, 0, 0, 64, 32, 0, 0, 64, 32); scene.current?.setCape(cv as any); }; }, [L.equipped.cloaks]);
  useEffect(() => { scene.current?.setClassic(L.classic); }, [L.classic]);
  useEffect(() => { const e = L.equipped.emotes; scene.current?.playEmote(e ? (e.slice(6) as EmoteId) : null); }, [L.equipped.emotes]);
  const cards = useMemo<Card[]>(() => {
    const want = (n: string) => !q || n.toLowerCase().includes(q.toLowerCase());
    const out: Card[] = [];
    if (tab === "all" || tab === "skins") for (const x of skins) if (want(x.name)) out.push({ key: `skin:${x.id}`, id: x.id, kind: "skin", name: x.name, sub: x.model === "slim" ? "Slim skin" : "Classic skin", badge: "SKIN", on: L.skin === x.id, fav: L.favs.includes(x.id), skin: x });
    const cats = tab === "all" ? null : tab === "hats" ? ["hats", "masks", "bandanas"] : tab === "bundles" || tab === "skins" ? [] : [tab as string];
    for (const it of ITEMS) if ((cats === null || cats.includes(it.cat)) && want(it.name)) out.push({ key: `item:${it.id}:${L.skin}`, id: it.id, kind: "item", name: it.name, sub: it.blurb.split(/[.,]/)[0], badge: BADGE[it.cat] || it.cat.toUpperCase(), on: isEquipped(it, L), fav: L.favs.includes(it.id), item: it });
    if (tab === "all" || tab === "bundles") for (const b of BUNDLES) if (want(b.name)) out.push({ key: `bundle:${b.id}`, id: b.id, kind: "bundle", name: b.name, sub: b.sub, badge: "BUNDLE", on: bundleOn(b, L), fav: L.favs.includes(b.id), bundle: b });
    return out;
  }, [tab, q, L, skins]);
  useEffect(() => {
    let dead = false;
    const spec = (c: Card) => {
      const eq = (id: string) => ITEMS.find((i) => i.id === id);
      if (c.kind === "skin") return { key: c.key, skin: skinSrc(c.skin!), slim: c.skin!.model === "slim", yaw: 0.45 };
      if (c.kind === "bundle") { const sk = allSkins(L).find((x) => x.id === c.bundle!.skin)!; const eqd: any = {}; for (const id of c.bundle!.items) { const it = eq(id)!; eqd[it.cat] = it.id; } return { key: c.key, skin: skinSrc(sk), slim: sk.model === "slim", equipped: eqd, yaw: Math.PI - 0.5, zoom: 0.5 }; }
      const it = c.item!, back = it.cat === "wings" || it.cat === "cloaks" || it.cat === "back";
      return { key: c.key, skin: skinSrc(skin), slim: skin.model === "slim", equipped: it.cat === "cloaks" || it.cat === "emotes" ? {} : { [it.cat]: it.id }, cape: it.capeFile ? "/" + it.capeFile : null, emote: it.cat === "emotes" ? (it.id.slice(6) as EmoteId) : undefined, at: it.id === "emote-backflip" ? 0.5 : it.id === "emote-sword" ? 0.9 : it.id === "emote-dance" ? 0.35 : 1.1, yaw: back ? Math.PI - 0.5 : 0.45, zoom: it.cat === "wings" ? 0.46 : it.cat === "hats" || it.cat === "masks" ? 1.1 : 0.6 };
    };
    (async () => { for (const c of cards) { if (dead) return; if (snapCached(c.key)) { setImgs((m) => (m[c.key] ? m : { ...m, [c.key]: snapCached(c.key)! })); continue; } try { const u = await snap(spec(c)); if (!dead) setImgs((m) => ({ ...m, [c.key]: u })); } catch { /* card keeps its skeleton */ } } })();
    return () => { dead = true; };
  }, [cards.map((c) => c.key).join("|"), skin.id]);
  useEffect(() => { const sc = scene.current; if (sc) { sc.reduced = s.reduceMotion; sc.sway = spin; sc.v.autoRotate = false; } }, [spin, s.reduceMotion]);
  useEffect(() => { scene.current?.setMode(mode); }, [mode, s.theme]);
  useEffect(() => { scene.current?.setMove(move); }, [move]);

  const equip = (it: Item) => { const was = isEquipped(it); toggleEquip(it); setFocus(it); if (it.cat === "emotes" && !was) scene.current?.playEmote(it.id.slice(6) as EmoteId); };

  const importFile = async (f?: File | null) => {
    if (!f) return; const r = await readSkinFile(f);
    if ("error" in r) { say(r.error, false); return; }
    const rec: SkinRec = { id: newId("imp"), name: f.name.replace(/\.png$/i, "").slice(0, 32) || "Imported", model: r.slim ? "slim" : "classic", description: r.legacy ? "Imported 64×32, converted to 64×64" : "Imported file", data: toDataUrl(r.canvas), custom: true, source: "file" };
    addSkin(rec); say(`Imported “${rec.name}” as a ${rec.model === "slim" ? "slim" : "classic"} skin${r.legacy ? " (64×32 converted)" : ""}.`);
  };
  const lookup = async () => {
    const n = uname.trim(); if (!n) return; setFound(null); setBusy(true);
    if (!isTauri) { setBusy(false); say("Username lookup runs in the desktop app. Mojang's servers refuse requests made from a web page.", false); return; }
    try {
      const r: any = await call("mojang_skin_lookup", { name: n });
      if (r.status === "no_such_player") say(`No Minecraft account is named “${n}”.`, false);
      else if (r.status === "no_skin") say(`“${r.name}” exists but has not set a skin. They wear the default Steve or Alex.`, false);
      else setFound(r);
    } catch (e: any) { say(String(e?.message || e), false); } finally { setBusy(false); }
  };
  const useFound = async () => {
    const img = new Image(); img.onload = () => { const r = fromImage(img, img.height === 32); if (!("error" in r)) { addSkin({ id: newId("mj"), name: found.name, model: found.slim ? "slim" : "classic", description: "Copy of a Mojang skin", data: toDataUrl(r.canvas), custom: true, source: "mojang" }); say(`Saved a copy of ${found.name}'s skin. It does not follow their future changes.`); setFound(null); setUname(""); } }; img.src = found.png;
  };
  const duplicate = (x: SkinRec) => { const r: SkinRec = { id: newId("dup"), name: x.name + " copy", model: x.model, description: "Copy of " + x.name, data: x.data, file: x.data ? undefined : x.file, custom: true, source: "duplicate", from: x.id }; if (!r.data) { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = 64; c.height = 64; c.getContext("2d")!.drawImage(im, 0, 0); r.data = c.toDataURL(); r.file = undefined; addSkin(r); say(`Copied “${x.name}”. Edit it or leave it.`); }; im.src = skinSrc(x); } else { addSkin(r); say(`Copied “${x.name}”.`); } };
  const saveEdit = (r: { name: string; slim: boolean; data: string; asNew: boolean }) => {
    if (!edit) return;
    if (r.asNew || !edit.custom) addSkin({ id: newId("my"), name: r.name || "My skin", model: r.slim ? "slim" : "classic", description: "Edited in Luminos", data: r.data, custom: true, source: "editor", from: edit.id });
    else updateSkin({ ...edit, name: r.name || edit.name, model: r.slim ? "slim" : "classic", data: r.data, file: undefined });
    setEdit(null); say("Saved.");
  };
  const worn = Object.entries(L.equipped).filter(([, v]) => v).map(([c, v]) => ({ c: c as Cat, item: ITEMS.find((i) => i.id === v)! })).filter((w) => w.item);
  const wornNames = worn.map((w) => w.item.name);
  const equipCard = (c: Card) => {
    if (c.kind === "skin") { setSkin(c.id); return; }
    if (c.kind === "bundle") { equipBundle(c.bundle!); return; }
    equip(c.item!);
  };

  return (
    <div className="flex gap-4 px-6 pb-5" style={{ height: "calc(100vh - 56px)" }}>
      {/* ---------- stage: borderless spotlight pedestal ---------- */}
      <section className="relative shrink-0 overflow-hidden" style={{ width: 360, borderRadius: 18, background: "radial-gradient(circle at 50% 65%, #1A2440 0%, #0B0D12 75%)" }} aria-label="3D preview">
        <div ref={wrap} className="absolute inset-0"><canvas ref={canvas} className="absolute inset-0 w-full h-full" aria-label={`3D preview of ${skin.name}`} /></div>
        <div className="absolute left-0 right-0 bottom-0 h-[38%] pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 22% at 50% 78%, rgba(104,130,255,.22), transparent 70%)" }} />
        <div className="absolute left-5 top-5 right-5 pointer-events-none">
          <div className="text-[18px] font-bold leading-tight">{skin.name}</div>
          <div className="text-[12px] mt-1" style={{ color: "#9BA3B4" }}>{wornNames.length ? wornNames.join(" · ") : "Nothing equipped"}</div>
        </div>
        {L.classic && <div className="absolute left-5 top-[66px] badge">Classic client: extras hidden</div>}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-5 flex items-center gap-1 p-1.5 rounded-full" style={{ background: "rgba(21,25,34,.92)", backdropFilter: "blur(10px)" }}>
          {([["idle", "Pose"], ["walk", "Walk"], ["jump", "Fly"]] as [Move, string][]).map(([m, l]) => <button key={m} className="cos-pill" data-on={move === m} onClick={() => setMove(m)}>{l}</button>)}
          <span className="w-px h-5 mx-1" style={{ background: "#262c3b" }} />
          <button className="cos-pill" data-on={spin} onClick={() => setSpin(!spin)} aria-pressed={spin}>Sway</button>
          <button className="cos-pill" onClick={() => setEdit(skin)}>Editor</button>
          <button className="cos-pill" data-on={imp} onClick={() => setImp(!imp)} aria-expanded={imp}>Import</button>
        </div>
        {imp && (
          <div className="absolute left-4 right-4 bottom-[72px] p-4 rounded-2xl grid gap-3" style={{ background: "#151922", boxShadow: "0 20px 50px rgba(0,0,0,.55)" }} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); importFile(e.dataTransfer.files?.[0]); }}>
            <label className="btn btn-primary cursor-pointer !h-10"><Icon n="upload" s={14} />{drag ? "Drop the PNG" : "Import skin PNG"}<input type="file" accept="image/png" className="hidden" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
            <div className="flex gap-2"><input className="field plain flex-1" placeholder="Mojang or Ely.by name" aria-label="Username" value={uname} onChange={(e) => setUname(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup()} /><button className="btn" onClick={lookup} disabled={busy}>{busy ? "…" : "Look up"}</button></div>
            {found && <div className="flex items-center gap-3"><SkinThumb src={found.png} scale={2} /><div className="flex-1 min-w-0 t2 font-semibold truncate">{found.name}</div><button className="btn btn-primary" onClick={useFound}>Use</button></div>}
            <label className="flex items-center justify-between t2">Classic mode<button role="switch" aria-checked={L.classic} aria-label="Classic mode" className="sw" onClick={() => setClassic(!L.classic)} /></label>
            <details><summary className="t2 cursor-pointer list-none flex items-center gap-2 mute"><Icon n="eye" s={14} />Who sees this skin</summary><div className="pt-3"><Visibility skin={skin} account={boot.account || {}} /></div></details>
          </div>
        )}
      </section>

      {/* ---------- showcase ---------- */}
      <section className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex gap-1.5 flex-wrap flex-1" role="tablist" aria-label="Cosmetic categories">
            {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className="cos-tab" data-on={tab === id} onClick={() => { setTab(id); setQ(""); }}>{label}</button>)}
          </div>
          <div className="relative w-[190px] shrink-0"><Icon n="search" s={14} className="absolute left-3 top-[11px] mute" /><input className="field" placeholder="Search…" aria-label="Search cosmetics" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {note && <div role="status" className="t2 mb-3 px-1" style={{ color: note.ok ? "var(--ok)" : "var(--bad)" }}>{note.t}</div>}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 cos-grid">
          {cards.map((c, i) => (
            <article key={c.key} className="cos-card" data-on={c.on} style={{ animationDelay: `${Math.min(i, 12) * 28}ms` }}>
              <div className="cos-head">
                <span className="cos-badge" data-k={c.badge}>{c.badge}</span>
                <button className="cos-star" aria-label={c.fav ? "Remove favourite" : "Favourite"} aria-pressed={c.fav} data-on={c.fav} onClick={() => toggleFav(c.id)}><Icon n="star" s={15} /></button>
              </div>
              <button className="cos-stage" onClick={() => equipCard(c)} aria-label={`${c.on ? "Unequip" : "Equip"} ${c.name}`}>
                {imgs[c.key] ? <img src={imgs[c.key]} alt="" draggable={false} className="cos-img" /> : <span className="cos-skel" />}
              </button>
              <div className="cos-foot">
                <div className="min-w-0 flex-1"><div className="cos-name">{c.name}</div><div className="cos-sub">{c.sub}</div></div>
                <button className="cos-btn" onClick={() => equipCard(c)}>{c.on ? "Equipped" : "Equip"}</button>
              </div>
            </article>
          ))}
          {!cards.length && <div className="t2 mute p-6">{tab === "all" && !q ? "Nothing here yet." : "No match."}</div>}
        </div>
      </section>
      {edit && <SkinEditor src={skinSrc(edit)} name={edit.name} slim={edit.model === "slim"} mine={!!edit.custom} onSave={saveEdit} onClose={() => setEdit(null)} />}
    </div>
  );
}
