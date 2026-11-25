/** Settings: Discord Rich Presence controls + a preview of exactly what friends see. Rules: taste-skill [card-family, nesting, text-contrast, a11y-name], game-ui-design 1,2.
 *  The preview is `buildPresence()` output, the same function the golden test locks to the launcher's Rust sender. */
import { useEffect, useState } from "react";
import { Badge, LRow, Switch } from "../kit";
import { set, useSettings } from "../store";
import { buildPresence } from "../presence";

const STATES = [["menus", "In menus"], ["singleplayer", "Singleplayer"], ["multiplayer", "Server"]] as const;
const SAMPLE = { instanceName: "Survival 1.21", loader: "fabric", mcVersion: "1.21.11", serverAddress: "play.example.net" };
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function PresenceCard() {
  const s = useSettings(); const [state, setState] = useState<(typeof STATES)[number][0]>("singleplayer");
  const [t0] = useState(() => Math.floor(Date.now() / 1000) - 754); const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => { const i = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(i); }, []);
  const a = buildPresence({ ...SAMPLE, enabled: s.presenceOn, state, shareServer: s.presenceServer, shareInstanceName: s.presenceName, startedUnix: t0 });
  return (
    <div>
      <div className="eyebrow mb-1.5 px-1">Discord</div>
      <div className="panel p-1.5">
        <LRow icon="user" name="Show Luminos on Discord" desc="Friends see “Playing Luminos”. Off removes it immediately."><Switch label="Show Luminos on Discord" on={s.presenceOn} onChange={(v) => set("presenceOn", v)} /></LRow>
        <LRow icon="layers" name="Share the instance name" desc="Shown as the first line. Off shows “Playing with Luminos”."><Switch label="Share the instance name" on={s.presenceName} onChange={(v) => set("presenceName", v)} /></LRow>
        <LRow icon="globe" name="Share the server address" desc="Off by default. When off, servers show as just “Multiplayer”."><Switch label="Share the server address" on={s.presenceServer} onChange={(v) => set("presenceServer", v)} /></LRow>
        <div className="grid gap-3 p-2" style={{ gridTemplateColumns: "minmax(0,300px) minmax(0,1fr)" }}>
          <div>
            <div className="inline-flex gap-1 mb-2" role="group" aria-label="Preview state">{STATES.map(([k, l]) => <button key={k} className="chip" data-on={state === k} aria-pressed={state === k} onClick={() => setState(k)}>{l}</button>)}</div>
            <div className="panel-2 p-3" aria-label="Discord preview" data-presence-preview>
              {a ? <>
                <div className="t1 mute mb-2">Playing <b style={{ color: "var(--fg)" }}>{a.name}</b></div>
                <div className="flex gap-3">
                  <div className="relative shrink-0"><img src="/luminos.png" alt="Luminos logo" width={60} height={60} className="rounded-lg" />
                    {a.assets.small_image && <span className="absolute -right-1.5 -bottom-1.5 grid place-items-center w-[22px] h-[22px] rounded-full t1 font-semibold" title={a.assets.small_text} style={{ background: "var(--surface)", border: "2px solid var(--surface-2)" }}>{a.assets.small_image[0].toUpperCase()}</span>}</div>
                  <div className="min-w-0 leading-[16px]"><div className="t2 font-semibold truncate">{a.details}</div><div className="t2 truncate">{a.state}</div><div className="t1 mute num">{mmss(Math.max(0, now - a.timestamps.start))} elapsed</div></div>
                </div>
              </> : <div className="t2 mute py-4 text-center">Nothing is shown on Discord.</div>}
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1"><span className="t2 font-medium">Exactly what is sent</span><Badge tone="mute">no tokens · no account name</Badge></div>
            <pre className="panel-2 p-2 t1 num overflow-auto m-0" style={{ maxHeight: 190 }} aria-label="Presence payload">{a ? JSON.stringify(a, null, 2) : "null (activity cleared)"}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
