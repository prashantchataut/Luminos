import { useId } from "react";

/**
 * The Luminos mark: a sharp geometric crescent intersecting a glowing cobalt crystal prism, on a dark 9px-radius badge.
 * Single source of truth is brand/luminos-mark.svg (scripts/gen-icons.mjs renders the same drawing into the .ico/.png/.bmp files).
 */
export function LuminosMark({ size = 32, title = "Luminos" }: { size?: number; title?: string }) {
  const u = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title} className="shrink-0" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`p${u}`} x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stopColor="#60A5FA" /><stop offset="1" stopColor="#2B4BFF" /></linearGradient>
        <linearGradient id={`m${u}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#B9CCFF" /></linearGradient>
        <radialGradient id={`g${u}`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#2B4BFF" stopOpacity="0.55" /><stop offset="1" stopColor="#2B4BFF" stopOpacity="0" /></radialGradient>
        <mask id={`c${u}`} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><rect width="32" height="32" fill="#fff" /><circle cx="19.4" cy="13.2" r="8.3" fill="#000" /></mask>
      </defs>
      <rect width="32" height="32" rx="9" fill="#0B0D12" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#2A3350" />
      <circle cx="21.5" cy="15" r="9" fill={`url(#g${u})`} />
      <circle cx="14.2" cy="16.6" r="9.3" fill={`url(#m${u})`} mask={`url(#c${u})`} />
      <path d="M21.6 6.6 26.9 14 21.6 25.4 16.3 14Z" fill={`url(#p${u})`} />
      <path d="M21.6 6.6 26.9 14 21.6 15.6Z" fill="#fff" fillOpacity="0.38" />
      <path d="M21.6 6.6 16.3 14 21.6 15.6Z" fill="#fff" fillOpacity="0.16" />
      <path d="M21.6 15.6 26.9 14 21.6 25.4Z" fill="#0B0D12" fillOpacity="0.22" />
    </svg>
  );
}

/** Mark plus the bold LUMINOS wordmark, used in the sidebar, the title bar and About. */
export default function LuminosLogo({ size = 32, wordmark = true, className = "" }: { size?: number; wordmark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LuminosMark size={size} />
      {wordmark && <span className="wordmark" style={{ fontSize: Math.round(size * 0.53), lineHeight: 1 }}>LUMINOS</span>}
    </span>
  );
}
