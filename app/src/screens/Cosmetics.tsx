import { useEffect, useMemo, useRef, useState } from "react";
import type { Boot } from "../App";
import { call, isTauri } from "../api";
import { Badge, Icon, SearchBox, SkinThumb } from "../kit";
import { addSkin, allSkins, CATS, Cat, getLocker, Item, ITEMS, isEquipped, newId, removeSkin, reportSkin, setClassic, setSkin, SkinRec, skinById, skinSrc, toggleEquip, toggleFav, updateSkin, useLocker } from "../locker/catalog";
import { EmoteId, Move, MOVES } from "../locker/pets";
import { LockerScene, Mode } from "../locker/scene";
import SkinEditor from "../locker/SkinEditor";
import { readSkinFile, toDataUrl, fromImage } from "../locker/skinfile";
import Visibility from "../locker/Visibility";
import { useSettings } from "../store";

const MOVE_LABEL: Record<Move, string> = { idle: "Idle", walk: "Walk", jump: "Jump", swim: "Swim", hurt: "Hurt" };

function CapeTile({ file }: { file: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const im = new Image(); im.src = "/" + file; im.onload = () => { const g = ref.current?.getContext("2d"); if (g) { g.imageSmoothingEnabled = false; g.drawImage(im, 1, 1, 10, 16, 0, 0, 10, 16); } }; }, [file]);
  return <canvas ref={ref} width={10} height={16} className="skin-px" style={{ width: 25, height: 40 }} />;
}

export default function Cosmetics({ boot, q, setQ }: { boot: Boot; q: string; setQ: (v: string) => void }) {
  const L = useLocker(), s = useSettings();
  const canvas = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null), scene = useRef<LockerScene | null>(null);
  const [tab, setTab] = useState<Cat | "skins">("skins"), [favOnly, setFavOnly] = useState(false);
  const [mode, setMode] = useState<Mode>("studio"), [move, setMove] = useState<Move>("idle"), [spin, setSpin] = useState(true);
  const [note, setNote] = useState<{ ok: boolean; t: string } | null>(null), [focus, setFocus] = useState<Item | null>(null);
  const [edit, setEdit] = useState<SkinRec | null>(null), [uname, setUname] = useState(""), [found, setFound] = useState<any>(null), [busy, setBusy] = useState(false), [drag, setDrag] = useState(false);
  const say = (t: string, ok = true) => { setNote({ ok, t }); setTimeout(() => setNote(null), 6000); };

  const skin = skinById(L.skin), skins = allSkins(L);
  // 3D scene lifecycle
  useEffect(() => {
    const el = wrap.current!, sc = new LockerScene(canvas.current!, el.clientWidth, el.clientHeight); scene.current = sc;
    const ro = new ResizeObserver(() => sc.resize(el.clientWidth, el.clientHeight)); ro.observe(el);
    return () => { ro.disconnect(); sc.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.setSkin(skinSrc(skin), skin.model === "slim").catch(() => say("That skin could not be drawn.", false)); }, [skin.id, skin.data, skin.model]);
  useEffect(() => { scene.current?.setEquipped(L.equipped); }, [L.equipped]);
  useEffect(() => { const c = ITEMS.find((i) => i.id === L.equipped.cloaks); if (!c?.capeFile) { scene.current?.setCape(null); return; } const im = new Image(); im.src = "/" + c.capeFile; im.onload = () => { const cv = document.createElement("canvas"); cv.width = 64; cv.height = 32; cv.getContext("2d")!.drawImage(im, 0, 0, 64, 32, 0, 0, 64, 32); scene.current?.setCape(cv as any); }; }, [L.equipped.cloaks]);
  useEffect(() => { scene.current?.setClassic(L.classic); }, [L.classic]);
  useEffect(() => { const sc = scene.current; if (sc) { sc.reduced = s.reduceMotion; sc.v.autoRotate = spin && !s.reduceMotion; } }, [spin, s.reduceMotion]);
  useEffect(() => { scene.current?.setMode(mode); }, [mode, s.theme]);
  useEffect(() => { scene.current?.setMove(move); }, [move]);

  const equip = (it: Item) => { const was = isEquipped(it); toggleEquip(it); setFocus(it); if (it.cat === "emotes" && !was) scene.current?.playEmote(it.id.slice(6) as EmoteId); };
  const shownItems = useMemo(() => ITEMS.filter((i) => i.cat === tab && (!favOnly || L.favs.includes(i.id)) && (!q || (i.name + i.blurb).toLowerCase().includes(q.toLowerCase()))), [tab, q, favOnly, L.favs]);
  const shownSkins = useMemo(() => skins.filter((x) => (!favOnly || L.favs.includes(x.id)) && (!q || x.name.toLowerCase().includes(q.toLowerCase()))), [skins, q, favOnly, L.favs]);

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
  const Seg = <T extends string>({ v, o, on, label }: { v: T; o: [T, string][]; on: (v: T) => void; label: string }) => <div role="group" aria-label={label} className="seg">{o.map(([k, l]) => <button key={k} aria-pressed={v === k} onClick={() => on(k)}>{l}</button>)}</div>;
  const count = (c: Cat | "skins") => (c === "skins" ? skins.length : ITEMS.filter((i) => i.cat === c).length);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      <div className="flex items-center gap-2 px-6 pb-3">
        <div className="flex gap-2 overflow-x-auto flex-1 min-w-0 py-0.5" role="tablist" aria-label="Locker categories">
          {CATS.map((c) => { const on = tab === c.id; return <button key={c.id} role="tab" aria-selected={on} data-on={on} className="pill !px-2.5 !gap-1.5" title={`${count(c.id)} items`} onClick={() => { setTab(c.id); setQ(""); }}><Icon n={c.icon} s={14} />{c.label}</button>; })}
        </div>
        <label className="flex items-center gap-2.5 shrink-0 t2 font-medium cursor-pointer pl-3" title="Hides pets, wings and emotes. Everything else stays.">Classic mode<button role="switch" aria-checked={L.classic} aria-label="Classic Client Mode" className="sw" onClick={() => setClassic(!L.classic)} /></label>
      </div>
      <div className="flex-1 min-h-0 flex gap-4 px-6 pb-4">
        <div className="relative overflow-hidden flex flex-col min-w-0" style={{ width: "55%", background: "#0f131c", borderRadius: 16 }}>
          <div ref={wrap} className="flex-1 min-h-0 relative"><canvas ref={canvas} className="absolute inset-0 w-full h-full" aria-label={`3D preview of ${skin.name}`} />
            {L.classic && <div className="absolute left-3 top-3 badge">Classic client: pets, wings and emotes hidden</div>}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex items-center gap-2 p-1.5 rounded-xl" style={{ background: "#151922" }}>
              <Seg<Mode> label="Preview" v={mode} on={setMode} o={[["studio", "Studio"], ["scene", "Sunset"]]} />
              <Seg<Move> label="Pose" v={move} on={setMove} o={MOVES.map((m) => [m, MOVE_LABEL[m]] as [Move, string])} />
              <button className="ibtn !w-8 !h-8" aria-pressed={spin} aria-label="Orbit" title="Orbit" onClick={() => setSpin(!spin)}><Icon n="refresh" s={14} /></button>
              <button className="ibtn !w-8 !h-8" aria-label="Orbit reset" title="Orbit reset" onClick={() => { (scene.current?.v as any)?.resetCameraPose?.(); }}><Icon n="target" s={14} /></button>
              <button className="ibtn !w-8 !h-8" aria-label="Screenshot" title="Screenshot" onClick={() => canvas.current!.toBlob((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b!); a.download = `${skin.id}.png`; a.click(); })}><Icon n="download" s={14} /></button>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center gap-1.5 flex-wrap min-h-[52px]" aria-label="Equipped" style={{ background: "#151922" }}>
            <span className="eyebrow mr-1">Equipped</span>
            <span className="chip"><Icon n="shirt" s={11} />{skin.name}</span>
            {worn.map(({ c, item }) => <button key={c} className="chip" title={`Unequip ${item.name}`} onClick={() => equip(item)}><Icon n={CATS.find((x) => x.id === c)!.icon} s={11} />{item.name}<Icon n="x" s={10} /></button>)}
            {!worn.length && <span className="t1 mute">No cosmetics worn.</span>}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto pr-1" onDragOver={(e) => { if (tab === "skins") { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (tab === "skins") importFile(e.dataTransfer.files?.[0]); }}>
          {note && <div role="status" className="panel-2 px-3 py-2 t2" style={{ color: note.ok ? "var(--ok)" : "var(--bad)" }}>{note.t}</div>}
          {tab === "skins" ? (<>
            <div className="flex items-center gap-2 flex-wrap" style={drag ? { outline: "2px dashed var(--accent)", outlineOffset: 4, borderRadius: 8 } : undefined}>
              <label className="btn cursor-pointer" title="64×64 or 64×32. Slim arms are detected."><Icon n="upload" s={13} />Import PNG<input type="file" accept="image/png" className="hidden" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
              <input className="field plain !w-[170px]" placeholder="Mojang or Ely.by name" value={uname} onChange={(e) => setUname(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup()} aria-label="Minecraft username" />
              <button className="btn" disabled={busy || !uname.trim()} onClick={lookup}>{busy ? "Looking…" : "Look up"}</button>
              <div className="flex-1" /><button className="btn btn-primary" onClick={() => setEdit(skin)}><Icon n="brush" s={13} />Open Pixel Skin Editor</button>
            </div>
            {found && <div className="flex items-center gap-3 panel p-3"><SkinThumb src={found.png} scale={2.4} /><div className="flex-1 min-w-0"><div className="t2 font-semibold truncate">{found.name}</div><div className="t1 mute leading-snug">{found.slim ? "Slim" : "Classic"} model. Saves a copy; it does not follow their future changes.</div></div><button className="btn btn-primary" onClick={useFound}>Use this skin</button></div>}
            <div className="grid grid-cols-3 gap-3">
              {shownSkins.map((x) => { const on = x.id === L.skin; return (
                <div key={x.id} className="mod" data-on={on} style={{ aspectRatio: "auto", height: 176 }}>
                  <button className="mod-icon" onClick={() => setSkin(x.id)} aria-label={`Use ${x.name}`}><SkinThumb src={skinSrc(x)} scale={3} /></button>
                  <button aria-label={`${L.favs.includes(x.id) ? "Unfavourite" : "Favourite"} ${x.name}`} onClick={() => toggleFav(x.id)} className="absolute top-1.5 right-1.5 ibtn !w-7 !h-7" style={{ color: L.favs.includes(x.id) ? "var(--accent-text)" : undefined }}><Icon n="star" s={13} /></button>
                  <span className="absolute left-2.5 top-2.5 badge">{x.model === "slim" ? "Slim" : "Classic"}</span>
                  <button className="mod-bar" aria-pressed={on} onClick={() => setSkin(x.id)}>{x.name}</button>
                </div>); })}
            </div>
            <div className="panel p-4"><div className="flex items-center gap-2"><div className="flex-1 min-w-0"><div className="t3 font-semibold truncate">{skin.name}</div><div className="t2 mute truncate">{skin.builtin ? "Luminos original. Free to use." : skin.source === "mojang" ? "Copy of a Mojang skin" : skin.description}</div></div>{skin.reported && <Badge tone="warn">Reported</Badge>}</div>
              <div className="flex flex-wrap gap-2 mt-3"><button className="btn" onClick={() => duplicate(skin)}><Icon n="copy" s={13} />Duplicate</button>{skin.custom && <button className="btn" onClick={() => { removeSkin(skin.id); say("Deleted."); }}><Icon n="trash" s={13} />Delete</button>}{skin.custom && skin.source !== "editor" && !skin.reported && <button className="btn" onClick={() => { reportSkin(skin.id); say("Reported. It is hidden from the shared library and flagged for review."); }}><Icon n="flag" s={13} />Report</button>}</div></div>
            <details className="panel"><summary className="flex items-center gap-2 px-4 h-12 cursor-pointer t2 font-semibold list-none"><Icon n="eye" s={15} />Who sees this skin<span className="flex-1" /><Icon n="chev" s={13} /></summary><div className="px-4 pb-4"><Visibility skin={skin} account={boot.account || {}} /></div></details>
          </>) : (<>
            <div className="grid grid-cols-3 gap-3">
              {shownItems.map((it) => { const on = isEquipped(it, L); return (
                <div key={it.id} className="mod" data-on={on} style={{ aspectRatio: "auto", height: 136 }}>
                  <button className="mod-icon" onClick={() => equip(it)} aria-label={`${on ? "Unequip" : "Equip"} ${it.name}`}>{it.capeFile ? <CapeTile file={it.capeFile} /> : <Icon n={CATS.find((c) => c.id === it.cat)!.icon} s={30} />}</button>
                  <button aria-label={`${L.favs.includes(it.id) ? "Unfavourite" : "Favourite"} ${it.name}`} onClick={() => toggleFav(it.id)} className="absolute top-1.5 right-1.5 ibtn !w-7 !h-7" style={{ color: L.favs.includes(it.id) ? "var(--accent-text)" : undefined }}><Icon n="star" s={13} /></button>
                  <button className="mod-bar" aria-pressed={on} onClick={() => equip(it)}>{it.name}</button>
                </div>); })}
            </div>
            {!shownItems.length && <div className="panel p-4 t2 mute text-center">{favOnly ? "No favourites in this category yet. Star an item to keep it here." : `Nothing matches “${q}”.`}</div>}
            {(() => { const it = focus && focus.cat === tab ? focus : shownItems.find((i) => isEquipped(i, L)) || shownItems[0]; return it ? (
              <div className="panel p-4"><div className="flex items-center gap-2"><div className="t3 font-semibold flex-1">{it.name}</div>{tab === "emotes" && <button className="btn" onClick={() => scene.current?.playEmote(it.id.slice(6) as EmoteId)}><Icon n="play" s={12} />Play</button>}<button className="btn btn-primary" onClick={() => equip(it)}>{isEquipped(it, L) ? "Unequip" : "Equip"}</button></div>
                <div className="t2 mute mt-1.5 leading-snug">{it.blurb}</div><div className="t2 mt-2 leading-snug"><b>Visible to:</b> <span className="mute">{it.visible}</span></div>
                {(tab === "wings" || tab === "cloaks" || tab === "back") && <div className="t1 mute mt-2 leading-snug">Wings, cloaks and back items share the back. Wearing one removes the others. Pets can be worn with any of them.</div>}</div>) : null; })()}
          </>)}
        </div>
      </div>
      {edit && <SkinEditor src={skinSrc(edit)} name={edit.name} slim={edit.model === "slim"} mine={!!edit.custom} onSave={saveEdit} onClose={() => setEdit(null)} />}
    </div>
  );
}
