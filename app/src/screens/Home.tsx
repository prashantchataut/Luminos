import { memo, useEffect, useRef, useState } from "react";
import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { Modal } from "../components/ui";
import { MODULES } from "../data/modules";
import { applyPreset, PRESETS, setPref, useClient, type Preset } from "../state/client";
import { onLaunch, SEED } from "../api";
import { safeInvoke } from "../lib/tauri-bridge";
import type { Boot } from "../App";

const QUICK = [
  { id: "hideout", title: "Mira's Hideout", sub: "Survival • Played today", tag: "Singleplayer", img: "/art/hud-backdrop.jpg" },
  { id: "hearth", title: "Hearthstone SMP", sub: "play.hearthstone.example", tag: "24ms • Online", img: "/art/hero-day.jpg", pos: "88% 30%" },
  { id: "lab", title: "Redstone Lab", sub: "Creative • 3 days ago", tag: "Singleplayer", img: "/art/hero-day.jpg", pos: "8% 85%" },
];

const QCard = memo(function QCard({ q, onPlay }: { q: (typeof QUICK)[number]; onPlay: (t: string) => void }) {
  return (
    <button onClick={() => onPlay(q.title)} aria-label={`Quickplay ${q.title}`} className="group card h-[184px] rounded-[14px] overflow-hidden flex flex-col justify-between text-left">
      <div className="relative h-[124px] w-full overflow-hidden"><img src={q.img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" style={{ objectPosition: (q as { pos?: string }).pos }} /><span className="absolute top-3 right-3 h-6 px-2.5 rounded-full text-[11px] font-medium grid place-items-center" style={{ background: "rgba(11,13,18,.72)", color: "#E2E8F0" }}>{q.tag}</span></div>
      <div className="h-[60px] px-5 flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="text-[14px] font-semibold truncate">{q.title}</div><div className="text-[12px] truncate mute">{q.sub}</div></div>
        <span className="grid place-items-center w-[34px] h-[34px] rounded-[8px] shrink-0 t group-hover:!bg-[var(--accent)] group-hover:!text-[var(--accent-fg)]" style={{ background: "var(--surface-2)" }}><Icon n="play" s={13} fill /></span>
      </div>
    </button>
  );
});

function Menu({ label, items, value, onPick }: { label: string; items: string[]; value: string; onPick: (v: string) => void }) {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; addEventListener("mousedown", f); return () => removeEventListener("mousedown", f); }, [open]);
  return (
    <div ref={ref} className="relative">
      <button aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)} className="h-[46px] px-4 rounded-[10px] text-[13px] font-medium flex items-center gap-2 t press" style={{ background: "rgba(22,27,38,.9)", color: "#E2E8F0" }}>{value}<Icon n="chev" s={14} /></button>
      {open && <ul role="listbox" className="pop absolute bottom-[calc(100%+8px)] left-0 min-w-full w-max rounded-[12px] p-1.5 z-20 m-0 list-none" style={{ background: "var(--side)", boxShadow: "0 12px 40px rgba(0,0,0,.5)" }}>{items.map((i) => <li key={i}><button role="option" aria-selected={i === value} onClick={() => { onPick(i); setOpen(false); }} className="w-full h-9 px-3 rounded-[8px] text-left text-[13px] flex items-center justify-between gap-6 t hover:bg-[var(--surface)]">{i}{i === value && <Icon n="check" s={14} />}</button></li>)}</ul>}
    </div>
  );
}

export default function Home({ boot, go }: { boot: Boot; go: (r: string) => void }) {
  const c = useClient();
  const [phase, setPhase] = useState<"idle" | "launching" | "playing">("idle"), [host, setHost] = useState(false), [toast, setToast] = useState("");
  const inst = boot.instances[0], inst_id = inst?.id ?? "luminos";
  const versions = [...new Set([c.prefs.gameVersion, ...SEED.instances.map((i) => i.mc), ...boot.instances.map((i) => i.mc)])].filter((v) => /^\d/.test(v)).slice(0, 6);
  useEffect(() => { let un = () => {}; void onLaunch((e) => { if (e?.state === "running") setPhase("playing"); else if (e?.state === "exited" || e?.state === "idle") setPhase("idle"); }).then((f) => { un = f; }).catch(() => undefined); return un; }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);
  const launch = async (target?: string) => {
    if (phase !== "idle") return;
    setPhase("launching");
    const r = await safeInvoke<string | null | undefined>("launch_instance", { id: inst_id }, "__failed__", 20000);
    if (r === "__failed__") { setPhase("idle"); setToast(target ? `Quickplay ${target} runs in the desktop app.` : "Launch runs in the desktop app."); return; }
    setPhase("playing"); setToast(target ? `Starting ${target}…` : "Starting Minecraft…");
  };
  return (
    <Page>
      <div className="space-y-8">
        <section className="relative h-[310px] rounded-[18px] overflow-hidden flex items-end p-10" style={{ background: "var(--surface)" }}>
          <img src="/art/hero-day.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" decoding="async" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #0B0D12 0%, rgba(11,13,18,0.78) 50%, rgba(11,13,18,0.15) 100%)" }} />
          <div className="relative max-w-[520px] space-y-3">
            <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: "#6882FF" }}>Fabric {c.prefs.gameVersion} • Built-in performance engine</span>
            <h1 className="m-0 text-[34px] font-bold leading-tight text-white">Luminos Client</h1>
            <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: "#94A3B8" }}>{MODULES.length} built-in PvP and survival modules, with the performance stack and Shard asset verification already inside.</p>
            <div className="pt-3 flex items-center gap-3 flex-wrap">
              <button onClick={() => launch()} disabled={phase === "launching"} className="h-[46px] px-8 rounded-[10px] text-white text-[14px] font-semibold flex items-center gap-2.5 t press" style={{ background: phase === "playing" ? "#16A34A" : "#2B4BFF", boxShadow: "0 4px 20px rgba(43,75,255,0.35)" }}>
                <Icon n="play" s={14} fill />{phase === "launching" ? "Launching…" : phase === "playing" ? "Playing" : "Launch Game"}
              </button>
              <Menu label="Version and preset" value={`${c.prefs.gameVersion} • ${c.prefs.preset}`} items={[...versions, ...(Object.keys(PRESETS) as Preset[])]} onPick={(v) => (v in PRESETS ? applyPreset(v as Preset) : setPref("gameVersion", v))} />
              <button onClick={() => setHost(true)} className="h-[46px] px-4 rounded-[10px] text-[13px] font-medium t hover:!text-white" style={{ background: "rgba(22,27,38,.9)", color: "#94A3B8" }}>Host World</button>
            </div>
          </div>
        </section>
        <section className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="m-0 text-[16px] font-semibold">Quickplay</h2><button className="text-[13px] t hover:underline" style={{ color: "var(--accent-text)" }} onClick={() => go("profiles")}>Manage Worlds & Servers →</button></div>
          <div className="grid grid-cols-3 gap-6">{QUICK.map((q) => <QCard key={q.id} q={q} onPlay={launch} />)}</div>
        </section>
      </div>
      {toast && <div role="status" className="pop fixed bottom-6 left-1/2 -translate-x-1/2 h-10 px-5 rounded-full text-[13px] flex items-center z-50" style={{ background: "var(--side)", boxShadow: "0 8px 30px rgba(0,0,0,.5)" }}>{toast}</div>}
      {host && (
        <Modal title="Host World" onClose={() => setHost(false)} w={440}>
          <p className="m-0 mb-4 text-[13px] leading-relaxed mute">Open one of your worlds to friends on your network. Online invite codes need the Luminos relay, which is not live yet.</p>
          <div className="space-y-2">{SEED.worlds.map((w) => <button key={w.name} className="w-full h-[52px] px-4 rounded-[10px] flex items-center justify-between text-left card" onClick={() => { setHost(false); void launch(w.name); }}><span><span className="block text-[13.5px] font-medium">{w.name}</span><span className="block text-[11.5px] mute">{w.mode} • {w.played}</span></span><Icon n="play" s={13} fill /></button>)}</div>
        </Modal>
      )}
    </Page>
  );
}
