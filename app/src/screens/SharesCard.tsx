/** Settings: share options, keybinds, configs (and, opt-in, saves) between instances. Skills: better-layout [group by task], interaction-design [no silent overwrite: every disagreement is a decision],
 *  accessibility [radio groups named, focus kept in the dialog]. Pandora silently lets the newest file win; here the player chooses and the loser is backed up first. */
import { useState } from "react";
import { Badge, LRow, Modal, Switch } from "../kit";
import { engine, type Disagreement } from "../engine";

const LABEL: Record<Disagreement["kind"], string> = { options: "Option", keybind: "Keybind", config: "Config file", save: "World" };
const pretty = (d: Disagreement) => d.item.split(":").slice(1).join(":").replace(/^key_key\./, "").replace(/^key\./, "");

export default function SharesCard() {
  const [saves, setSaves] = useState(false); const [list, setList] = useState<Disagreement[] | null>(null); const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Record<string, string>>({}); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const scan = async () => { setBusy(true); setMsg(""); try { const r = await engine.sharesScan(saves); setList(r.disagreements); setPick({}); setOpen(r.disagreements.length > 0); if (!r.disagreements.length) setMsg("Every instance agrees. Nothing to decide."); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };
  const apply = async () => {
    setBusy(true); let n = 0;
    try { for (const d of list ?? []) { const c = pick[d.item]; if (c) { n += (await engine.sharesResolve(d.item, c)).length || 1; } }
      setMsg(`Applied ${Object.keys(pick).length} choice${Object.keys(pick).length === 1 ? "" : "s"}. The version you did not pick was backed up first.`); setOpen(false); setList(null); }
    catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  };
  return <div>
    <div className="eyebrow mb-1.5 px-1">Between instances</div>
    <div className="panel p-1.5">
      <LRow icon="layers" name="Include worlds" desc="Off by default. Worlds are large, so you choose when to compare them."><Switch label="Include worlds" on={saves} onChange={setSaves} /></LRow>
      <LRow icon="rot" name="Check for differences" desc={msg || "Compares options, keybinds and mod configs, and lists anything two instances disagree on."}><button className="btn" onClick={scan} disabled={busy}>{busy ? "Checking…" : "Check"}</button></LRow>
    </div>
    {open && list && <Modal title={`${list.length} difference${list.length === 1 ? "" : "s"} to decide`} onClose={() => setOpen(false)} w={620}>
      <p className="t1 mute mb-2">Nothing changes until you apply. Whatever you do not pick is saved to the shares-backup folder first.</p>
      <div className="flex flex-col gap-2" style={{ maxHeight: 380, overflow: "auto" }}>
        {list.map((d) => <fieldset key={d.item} className="panel-2 p-2 m-0" style={{ border: 0 }}>
          <legend className="t2 font-medium px-1"><Badge tone="mute">{LABEL[d.kind]}</Badge> {pretty(d)}</legend>
          <div role="radiogroup" aria-label={`Keep which version of ${pretty(d)}`} className="flex flex-col gap-1 mt-1">
            {d.sides.map((s) => <label key={s.instance} className="flex items-center gap-2 t1 cursor-pointer"><input type="radio" name={d.item} checked={pick[d.item] === s.instance} onChange={() => setPick((p) => ({ ...p, [d.item]: s.instance }))} /><span className="font-medium">{s.name}</span><span className="mute num truncate">{s.value}</span></label>)}
            {d.kind === "save" && <label className="flex items-center gap-2 t1 cursor-pointer"><input type="radio" name={d.item} checked={pick[d.item] === "both"} onChange={() => setPick((p) => ({ ...p, [d.item]: "both" }))} /><span className="font-medium">Keep both</span><span className="mute">each instance also gets the other copy, renamed</span></label>}
          </div>
        </fieldset>)}
      </div>
      <div className="flex items-center justify-end gap-2 mt-3"><span className="t1 mute">{Object.keys(pick).length} of {list.length} decided</span><button className="btn" onClick={() => setOpen(false)}>Not now</button><button className="btn btn-primary" disabled={!Object.keys(pick).length || busy} onClick={apply}>Apply {Object.keys(pick).length || ""}</button></div>
    </Modal>}
  </div>;
}
