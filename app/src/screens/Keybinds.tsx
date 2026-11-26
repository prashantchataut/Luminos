import { memo, useEffect, useState } from "react";
import Page from "../components/Page";
import { Icon } from "../components/Icon";
import { PageHeader, Pills } from "../components/ui";
import { BINDS, KEY_CATS, keyName, type Bind, type KeyCat } from "../data/keybinds";
import { resetKeys, setKey, setMode, useClient } from "../state/client";

const BindRow = memo(function BindRow({ b, key_, mode, recording, onRecord }: { b: Bind; key_: string; mode?: "Hold" | "Toggle"; recording: boolean; onRecord: (id: string | null) => void }) {
  return (
    <div className="h-[62px] px-6 rounded-[12px] flex items-center justify-between gap-6" style={{ background: "var(--surface)" }}>
      <div className="flex items-center gap-4 min-w-0">
        <span className="grid place-items-center w-9 h-9 rounded-[8px] shrink-0" style={{ background: "var(--surface-2)", color: "var(--accent-text)" }}><Icon n={b.icon} s={18} /></span>
        <div className="min-w-0"><div className="text-[14px] font-medium truncate">{b.name}</div><div className="text-[12px] truncate mute">{b.hint}</div></div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {b.mode && (
          <div className="h-[32px] px-1 rounded-[7px] flex items-center" style={{ background: "var(--side)" }} role="group" aria-label={`${b.name} mode`}>
            {(["Hold", "Toggle"] as const).map((m) => <button key={m} aria-pressed={mode === m} onClick={() => setMode(b.id, m)} className="h-[24px] px-2.5 rounded-[5px] text-[12px] t" style={{ background: mode === m ? "var(--surface-2)" : "transparent", color: mode === m ? "var(--fg)" : "var(--mute)" }}>{m}</button>)}
          </div>
        )}
        <button onClick={() => onRecord(recording ? null : b.id)} aria-label={`${b.name}: ${key_}. Change key`}
          className="min-w-[116px] h-[36px] px-4 rounded-[8px] text-[12.5px] mono font-semibold flex items-center justify-center t press"
          style={{ background: recording ? "var(--accent)" : "var(--surface-2)", color: recording ? "var(--accent-fg)" : key_ === "None" ? "var(--mute)" : "var(--fg)" }}>
          {recording ? "Press a key..." : key_}
        </button>
      </div>
    </div>
  );
});

export default function Keybinds() {
  const c = useClient();
  const [cat, setCat] = useState<KeyCat | "all">("all"), [rec, setRec] = useState<string | null>(null);
  useEffect(() => {
    if (!rec) return;
    const down = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); if (e.key === "Escape") return setRec(null); setKey(rec, e.key === "Backspace" ? "None" : keyName(e)); setRec(null); };
    addEventListener("keydown", down, true);
    return () => removeEventListener("keydown", down, true);
  }, [rec]);
  const list = BINDS.filter((b) => cat === "all" || b.cat === cat);
  return (
    <Page>
      <PageHeader title="Keybinds" sub="Configure client hotkeys and quick module toggles." right={<button className="btn-quiet" onClick={resetKeys}><Icon n="reset" s={14} />Reset Defaults</button>} />
      <div className="mb-7"><Pills value={cat} onChange={setCat} items={KEY_CATS} /></div>
      <div className="space-y-3">{list.map((b) => <BindRow key={b.id} b={b} key_={c.keys[b.id]?.key ?? b.key} mode={c.keys[b.id]?.mode ?? b.mode} recording={rec === b.id} onRecord={setRec} />)}</div>
      <p className="mt-6 text-[12px] mute">Click a key, then press the new one. Backspace clears it, Esc cancels. A key can only trigger one action, so binding it elsewhere moves it.</p>
    </Page>
  );
}
