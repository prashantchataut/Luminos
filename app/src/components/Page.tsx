import type { ReactNode } from "react";

/**
 * The one page frame: 40/32 padding, content centred in a 1200px column.
 * `fill` pages (Cosmetics, HUD studio) own the full height and scroll inside their own panes; every other page scrolls here.
 */
export default function Page({ children, fill = false, wide = false }: { children: ReactNode; fill?: boolean; wide?: boolean }) {
  if (fill) return <div className="h-full min-h-0 px-10 py-8 flex flex-col"><div className="w-full mx-auto flex-1 min-h-0 flex flex-col" style={{ maxWidth: wide ? 1400 : 1200 }}>{children}</div></div>;
  return <div className="h-full min-h-0 overflow-y-auto"><div className="px-10 py-8 mx-auto w-full" style={{ maxWidth: 1200 + 80 }}>{children}</div></div>;
}
