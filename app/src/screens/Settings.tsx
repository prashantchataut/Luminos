import { useState } from "react";
import { Badge, Icon, Row, Segmented, Slider, Toggle } from "../ui";
import { SEED, call } from "../api";
export default function Settings({ settings, setBeta, beta }: { settings: any; setBeta: (v: boolean) => void; beta: boolean }) {
  const [mem, setMem] = useState(settings?.memory_mb || 4096); const [upd, setUpd] = useState(true); const [skins, setSkins] = useState(true); const [theme, setTheme] = useState("night"); const [motion, setMotion] = useState(true);
  const total = SEED.storage.reduce((a, b) => a + b.bytes, 0);
  const colors = ["#3b6cf0", "#8fb4ff", "#7fe0b0", "#ffd37a"];
  return (
    <div className="page-in h-full overflow-y-auto px-12 py-10 max-w-[1280px]">
      <div className="mb-7"><div className="eyebrow">Settings</div><h1 className="display text-[56px] mt-1">Make it <span className="accent-word">yours</span></h1></div>
      <div className="grid grid-cols-2 gap-6 items-start">
        <div className="grid gap-6">
          <section className="panel p-5"><div className="flex items-center justify-between mb-1"><div className="font-semibold text-[16px]">Updates</div><Badge tone="ok"><Icon n="check" s={12} />Luminos 0.6.0 is current</Badge></div>
            <Row title="Check for updates" desc="One request to api.github.com on start. Installers are verified against the published SHA-256 before they run."><Toggle on={upd} onChange={setUpd} label="Updates" /></Row>
            <Row title="Update mods automatically" desc="Only to stable builds the solver has checked against your Minecraft."><Toggle on={true} onChange={() => {}} label="Auto" /></Row></section>
          <section className="panel p-5"><div className="font-semibold text-[16px] mb-1">Mods and versions</div>
            <Row title="Allow beta mods" desc="Off: only stable releases are installed. On: betas are used when they are the only build, and the solver still checks every dependency."><Toggle on={beta} onChange={(v) => { setBeta(v); call("set_setting", { key: "allow_beta_mods", value: v }); }} label="Allow beta" /></Row>
            <Row title="Memory for the game" desc="Luminos picks a safe value for your PC. Raise it only for very large packs."><Slider value={mem} min={1024} max={16384} step={512} onChange={(v) => { setMem(v); call("set_setting", { key: "memory_mb", value: v }); }} fmt={(v) => (v / 1024).toFixed(1) + " GB"} /></Row>
            <Row title="Show my skin to the game" desc="A local server hands your skin and cape to Minecraft, so you see them even offline."><Toggle on={skins} onChange={setSkins} label="Skins" /></Row></section>
          <section className="panel p-5"><div className="font-semibold text-[16px] mb-1">Appearance</div>
            <Row title="Theme"><Segmented value={theme} onChange={setTheme} options={[{ v: "night", l: "Night" }, { v: "dusk", l: "Dusk" }, { v: "dawn", l: "Dawn" }]} /></Row>
            <Row title="Animations" desc="Turn off for a still sky and instant transitions."><Toggle on={motion} onChange={(v) => { setMotion(v); document.documentElement.classList.toggle("reduce", !v); }} label="Animations" /></Row></section>
        </div>
        <div className="grid gap-6">
          <section className="panel p-5"><div className="flex items-center justify-between mb-4"><div className="font-semibold text-[16px]">Storage</div><span className="num text-mute text-[13px]">{total.toFixed(1)} GB used</span></div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-5">{SEED.storage.map((s, i) => <div key={s.name} style={{ width: `${(s.bytes / total) * 100}%`, background: colors[i] }} />)}</div>
            {SEED.storage.map((s, i) => <div key={s.name} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} /><div className="flex-1"><div className="font-medium text-[13.5px]">{s.name}</div><div className="text-[12px] text-mute">{s.detail}</div></div><span className="num text-[13px] w-16 text-right">{s.human}</span>{s.reclaimable ? <button className="btn btn-ghost btn-sm" onClick={() => call("clear_cache")}>Clear</button> : <span className="w-[62px] text-[11.5px] text-mute text-right">Yours</span>}</div>)}</section>
          <section className="panel p-5"><div className="flex items-center justify-between mb-1"><div className="font-semibold text-[16px]">Privacy</div><Badge tone="ok"><Icon n="lock" s={12} />No telemetry</Badge></div>
            <p className="text-[12.5px] text-mute leading-relaxed mb-3">Luminos contacts only these hosts, and only for the reason listed. No analytics, no ads, no accounts of ours.</p>
            {SEED.hosts.map(([h, why]) => <div key={h} className="flex items-center gap-3 py-2 border-b border-line last:border-0"><Icon n="globe" s={15} className="text-accent" /><span className="num text-[13px]">{h}</span><span className="text-[12px] text-mute ml-auto">{why}</span></div>)}</section>
        </div>
      </div>
    </div>
  );
}
