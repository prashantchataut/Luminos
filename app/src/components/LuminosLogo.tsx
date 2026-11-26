/**
 * The original Luminos mark: the glowing blue dithered moon. The artwork is the pixel grid in /luminos.svg
 * (same file as brand/luminos.svg), drawn crisp (no smoothing) at any size.
 */
export function LuminosMark({ size = 32, title = "Luminos" }: { size?: number; title?: string }) {
  return <img src="/luminos.svg" width={size} height={size} alt={title} draggable={false} className="shrink-0" style={{ display: "block", imageRendering: "pixelated" }} />;
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
