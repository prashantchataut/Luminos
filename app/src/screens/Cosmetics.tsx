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

export default function Cosmetics({ boot }: { boot: Boot }) {
  const L = useLocker(), s = useSettings();
  const canvas = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null), scene = useRef<LockerScene | null>(null);
  const [tab, setTab] = useState<Cat | "skins">("skins"), [q, setQ] = useState(""), [favOnly, setFavOnly] = useState(false);
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
  const Seg = <T extends string>({ v, o, on, label }: { v: T; o: [T, string][]; on: (v: T) => void; label: string }) => <div role="group" aria-label={label} className="inline-flex rounded-md overflow-hidden" style={{ border: "1px solid var(--line)" }}>{o.map(([k, l]) => <button key={k} className="px-2.5 h-7 t1 font-semibold" aria-pressed={v === k} style={{ background: v === k ? "var(--accent-soft)" : "transparent", color: v === k ? "var(--fg)" : "var(--mute)" }} onClick={() => on(k)}>{l}</button>)}</div>;
  const count = (c: Cat | "skins") => (c === "skins" ? skins.length : ITEMS.filter((i) => i.cat === c).length);

  return (
    <div className="grid gap-3 max-w-[1280px]" style={{ gridTemplateColumns: "176px minmax(0,1fr) 372px", height: "calc(100vh - 44px - 20px)" }}>
      <nav className="panel p-1.5 flex flex-col gap-0.5 min-h-0 overflow-y-auto" aria-label="Locker categories">
        {CATS.map((c) => { const on = tab === c.id, eq = c.id !== "skins" && !!L.equipped[c.id as Cat]; return (
          <button key={c.id} onClick={() => { setTab(c.id); setQ(""); }} aria-current={on} className="lrow !min-h-[34px] text-left" style={{ background: on ? "var(--accent-soft)" : undefined, borderColor: on ? "var(--accent)" : undefined }}>
            <Icon n={c.icon} s={15} /><span className="t2 font-medium flex-1">{c.label}</span>
            {eq && <span title="Something is equipped" className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />}<span className="t1 mute num">{count(c.id)}</span>
          </button>); })}
        <div className="flex-1" />
        <div className="px-2 pt-2 border-t border-line">
          <div className="flex items-center justify-between min-h-[30px]"><span className="t1 font-semibold">Classic client</span><button role="switch" aria-checked={L.classic} aria-label="Classic client" className="sw" onClick={() => setClassic(!L.classic)} /></div>
          <div className="t1 mute leading-snug pb-1.5">Hides pets, wings and emotes. Everything else stays.</div>
        </div>
      </nav>

      <div className="panel flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center gap-2 p-2 border-b border-line flex-wrap">
          <Seg<Mode> label="Preview" v={mode} on={setMode} o={[["studio", "Studio"], ["scene", "Sunset scene"]]} />
          <Seg<Move> label="Pose" v={move} on={setMove} o={MOVES.map((m) => [m, MOVE_LABEL[m]] as [Move, string])} />
          <div className="flex-1" />
          <button className="ibtn" aria-pressed={spin} aria-label="Spin" title="Spin" onClick={() => setSpin(!spin)}><Icon n="refresh" s={14} /></button>
          <button className="ibtn" aria-label="Save a picture" title="Save a picture" onClick={() => canvas.current!.toBlob((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b!); a.download = `${skin.id}.png`; a.click(); })}><Icon n="download" s={14} /></button>
        </div>
        <div ref={wrap} className="flex-1 min-h-0 relative"><canvas ref={canvas} className="absolute inset-0 w-full h-full" aria-label={`3D preview of ${skin.name}`} />
          {L.classic && <div className="absolute left-2 bottom-2 badge">Classic client: pets, wings and emotes hidden</div>}
        </div>
        <div className="p-2 border-t border-line flex items-center gap-1.5 flex-wrap min-h-[44px]" aria-label="Equipped">
          <span className="eyebrow mr-1">Equipped</span>
          <span className="chip" data-on="true"><Icon n="shirt" s={11} />{skin.name}</span>
          {worn.map(({ c, item }) => <button key={c} className="chip" title={`Unequip ${item.name}`} onClick={() => equip(item)}><Icon n={CATS.find((x) => x.id === c)!.icon} s={11} />{item.name}<Icon n="x" s={10} /></button>)}
          {!worn.length && <span className="t1 mute">No cosmetics worn.</span>}
        </div>
      </div>

      <div className="flex flex-col gap-2 min-h-0 overflow-y-auto pr-0.5" onDragOver={(e) => { if (tab === "skins") { e.preventDefault(); setDrag(true); } }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); if (tab === "skins") importFile(e.dataTransfer.files?.[0]); }}>
        <div className="flex gap-1.5"><SearchBox value={q} onChange={setQ} placeholder={tab === "skins" ? "Search skins" : `Search ${CATS.find((c) => c.id === tab)!.label.toLowerCase()}`} /><button className="chip !h-[30px]" data-on={favOnly} onClick={() => setFavOnly(!favOnly)} aria-label="Favourites only"><Icon n="star" s={12} />Favourites</button></div>
        {note && <div role="status" className="panel-2 px-2.5 py-1.5 t2" style={{ color: note.ok ? "var(--ok)" : "var(--bad)", borderColor: note.ok ? "var(--ok)" : "var(--bad)" }}>{note.t}</div>}

        {tab === "skins" ? (<>
          <div className="panel p-2.5" style={drag ? { borderColor: "var(--accent)", background: "var(--accent-soft)" } : undefined}>
            <div className="flex items-center gap-2"><label className="btn cursor-pointer"><Icon n="upload" s={13} />Import PNG<input type="file" accept="image/png" className="hidden" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} /></label><span className="t1 mute">or drop a file here. 64×64 or 64×32.</span></div>
            <div className="flex gap-1.5 mt-2"><input className="field plain" placeholder="Minecraft username" value={uname} onChange={(e) => setUname(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup()} aria-label="Minecraft username" /><button className="btn" disabled={busy || !uname.trim()} onClick={lookup}>{busy ? "Looking…" : "Look up"}</button></div>
            {found && <div className="mt-2 flex items-center gap-2.5 panel-2 p-2"><SkinThumb src={found.png} scale={2.4} /><div className="flex-1 min-w-0"><div className="t2 font-semibold truncate">{found.name}</div><div className="t1 mute leading-snug">{found.slim ? "Slim" : "Classic"} model. This saves a copy. It does not follow their future changes.</div></div><button className="btn btn-primary" onClick={useFound}>Use this skin</button></div>}
            <div className="t1 mute mt-1.5">Username lookups go to Mojang only.</div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {shownSkins.map((x) => { const on = x.id === L.skin; return (
              <div key={x.id} className="relative group panel-2 flex flex-col items-center pt-2 pb-1.5 px-1" style={{ borderColor: on ? "var(--accent)" : undefined, background: on ? "var(--accent-soft)" : undefined }}>
                <button onClick={() => setSkin(x.id)} aria-pressed={on} aria-label={`Use ${x.name}`} className="grid place-items-center"><SkinThumb src={skinSrc(x)} scale={3} /></button>
                <div className="t1 font-semibold truncate max-w-full mt-1">{x.name}</div>
                <div className="flex gap-1 mt-0.5"><span className="badge">{x.model === "slim" ? "Slim" : "Classic"}</span>{on && <span className="badge accent">Worn</span>}</div>
                <button aria-label={`${L.favs.includes(x.id) ? "Unfavourite" : "Favourite"} ${x.name}`} onClick={() => toggleFav(x.id)} className="absolute top-1 right-1 ibtn !w-6 !h-6" style={{ color: L.favs.includes(x.id) ? "var(--accent)" : undefined }}><Icon n="star" s={12} /></button>
              </div>); })}
          </div>
          <div className="panel p-2.5">
            <div className="flex items-center gap-2"><div className="flex-1 min-w-0"><div className="t2 font-semibold truncate">{skin.name}</div><div className="t1 mute truncate">{skin.builtin ? "Luminos original. Free to use." : skin.source === "mojang" ? "Copy of a Mojang skin" : skin.description}</div></div>{skin.reported && <Badge tone="warn">Reported</Badge>}</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button className="btn btn-primary" onClick={() => setEdit(skin)}><Icon n="edit" s={13} />{skin.custom ? "Edit" : "Edit a copy"}</button>
              <button className="btn" onClick={() => duplicate(skin)}><Icon n="copy" s={13} />Duplicate</button>
              {skin.custom && <button className="btn" onClick={() => { removeSkin(skin.id); say("Deleted."); }}><Icon n="trash" s={13} />Delete</button>}
              {skin.custom && skin.source !== "editor" && !skin.reported && <button className="btn" onClick={() => { reportSkin(skin.id); say("Reported. It is hidden from the shared library and flagged for review."); }}><Icon n="flag" s={13} />Report this skin</button>}
            </div>
          </div>
          <Visibility skin={skin} account={boot.account || {}} />
        </>) : (<>
          <div className="grid grid-cols-3 gap-1.5">
            {shownItems.map((it) => { const on = isEquipped(it, L); return (
              <div key={it.id} className="relative panel-2" style={{ borderColor: on ? "var(--accent)" : undefined, background: on ? "var(--accent-soft)" : undefined }}>
                <button onClick={() => equip(it)} aria-pressed={on} aria-label={`${on ? "Unequip" : "Equip"} ${it.name}`} className="w-full flex flex-col items-center gap-1 pt-3 pb-2 px-1">
                  <span className="grid place-items-center h-10">{it.capeFile ? <CapeTile file={it.capeFile} /> : <Icon n={CATS.find((c) => c.id === it.cat)!.icon} s={26} />}</span>
                  <span className="t1 font-semibold truncate max-w-full">{it.name}</span>
                  <span className={`badge ${on ? "accent" : ""}`}>{on ? "Equipped" : "Equip"}</span>
                </button>
                <button aria-label={`${L.favs.includes(it.id) ? "Unfavourite" : "Favourite"} ${it.name}`} onClick={() => toggleFav(it.id)} className="absolute top-1 right-1 ibtn !w-6 !h-6" style={{ color: L.favs.includes(it.id) ? "var(--accent)" : undefined }}><Icon n="star" s={12} /></button>
              </div>); })}
          </div>
          {!shownItems.length && <div className="panel p-4 t2 mute text-center">{favOnly ? "No favourites in this category yet. Star an item to keep it here." : `Nothing matches “${q}”.`}</div>}
          {(() => { const it = focus && focus.cat === tab ? focus : shownItems.find((i) => isEquipped(i, L)) || shownItems[0]; return it ? (
            <div className="panel p-2.5"><div className="flex items-center gap-2"><div className="t2 font-semibold flex-1">{it.name}</div>{tab === "emotes" && <button className="btn" onClick={() => scene.current?.playEmote(it.id.slice(6) as EmoteId)}><Icon n="play" s={12} />Play</button>}<button className="btn btn-primary" onClick={() => equip(it)}>{isEquipped(it, L) ? "Unequip" : "Equip"}</button></div>
              <div className="t1 mute mt-1 leading-snug">{it.blurb}</div>
              <div className="t1 mt-1.5 leading-snug"><b>Visible to:</b> <span className="mute">{it.visible}</span></div>
              {(tab === "wings" || tab === "cloaks" || tab === "back") && <div className="t1 mute mt-1 leading-snug">Wings, cloaks and back items share the back. Wearing one removes the others. Pets can be worn with any of them.</div>}
              {it.cat === "pets" && <div className="t1 mute mt-1 leading-snug">Pets stack with wings, hats and back items.</div>}
            </div>) : null; })()}
        </>)}
      </div>
      {edit && <SkinEditor src={skinSrc(edit)} name={edit.name} slim={edit.model === "slim"} mine={!!edit.custom} onSave={saveEdit} onClose={() => setEdit(null)} />}
    </div>
  );
}
