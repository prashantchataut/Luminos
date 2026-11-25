import { Component, type ReactNode } from "react";

type P = { children: ReactNode; label?: string; resetKey?: string };
type S = { err: Error | null };

/** Recovery boundary: a render error in one screen shows a calm card with a Reload button; the sidebar stays usable. */
export default class ErrorBoundary extends Component<P, S> {
  state: S = { err: null };
  static getDerivedStateFromError(err: Error): S { return { err }; }
  componentDidCatch(err: Error) { console.error("[luminos] screen crashed:", err); }
  componentDidUpdate(prev: P) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="h-full grid place-items-center p-10">
        <div className="max-w-[420px] rounded-[14px] p-8 text-center" style={{ background: "var(--surface)" }}>
          <div className="text-[16px] font-semibold">{this.props.label || "This screen"} hit a problem</div>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--mute)" }}>Your settings are safe. Reload the screen to continue.</p>
          <button className="btn-primary mt-5" onClick={() => this.setState({ err: null })}>Reload screen</button>
        </div>
      </div>
    );
  }
}
