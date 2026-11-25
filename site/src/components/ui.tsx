import type { ReactNode } from "react";
import markUrl from "../assets/luminos.svg";
import type { ReleaseState } from "../lib/useRelease";

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <img
      src={markUrl}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{ imageRendering: "pixelated" }}
      className="rounded-[22%]"
    />
  );
}

export function Wordmark({ size = "text-[1.6rem]" }: { size?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark />
      <span className={`font-serif leading-none tracking-tight ${size}`}>Luminos</span>
    </span>
  );
}

/** Four-point sparkle, drawn as a hairline. */
export function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 1C12.7 7.6 16.4 11.3 23 12 16.4 12.7 12.7 16.4 12 23 11.3 16.4 7.6 12.7 1 12 7.6 11.3 11.3 7.6 12 1Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5v9M4 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Product window frame: hairline, soft blue glow, no fake chrome (the screenshots carry their own title bar). */
export function Frame({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-ink-2 shadow-[0_50px_140px_-40px_rgba(52,100,255,0.5),0_0_0_1px_rgba(255,255,255,0.03)_inset] ${className}`}
    >
      <img
        src={src}
        alt={alt}
        width={1360}
        height={820}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="block h-auto w-full outline outline-1 -outline-offset-1 outline-white/10"
      />
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent" />
    </div>
  );
}

/** Download button. Links the specific release tag from release.json; the Android APK is a separate, labelled secondary link. */
export function DownloadCTA({
  release,
  align = "center",
}: {
  release: ReleaseState;
  align?: "center" | "start";
}) {
  const ready = release.status === "ready";
  const href = ready ? release.url : release.page;
  const label = ready ? "Download for Windows" : "Release is being built";
  const meta = ready ? (
    <>
      {release.tag}
      {release.prerelease ? " release candidate" : ""} · {release.sizeMb ? `${release.sizeMb} MB · ` : ""}
      {release.date ? `${release.date} · ` : ""}unsigned ·{" "}
      <a className="underline decoration-white/30 underline-offset-4 hover:decoration-white" href={release.sums}>
        SHA-256
      </a>
    </>
  ) : (
    <>{release.tag} is not published yet. The link opens its release page.</>
  );
  return (
    <div className={`flex flex-col gap-4 ${align === "center" ? "items-center text-center" : "items-start"}`}>
      <a className="btn btn-primary" href={href} rel="noopener">
        <ArrowDown />
        {label}
      </a>
      <p className="max-w-md rounded-full bg-ink-1/75 px-4 py-2 text-[0.8125rem] leading-relaxed text-[#b4c1e2] backdrop-blur-md" aria-live="polite">
        {meta}
      </p>
      <a className="text-[0.8125rem] text-mute underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white" href="#android">
        Android launcher preview (Minecraft does not launch on it yet)
      </a>
    </div>
  );
}

export function SectionHead({
  eyebrow,
  children,
  lead,
  className = "",
}: {
  eyebrow: string;
  children: ReactNode;
  lead?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`max-w-3xl ${className}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mt-5 text-[clamp(2.4rem,5.4vw,4.4rem)]">{children}</h2>
      {lead && <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-mute">{lead}</p>}
    </header>
  );
}
