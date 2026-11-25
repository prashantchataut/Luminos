import { memo, useEffect, useRef } from "react";

/** Player head (face + hat layer) on a plain 2D canvas. Not WebGL. */
export default memo(function Head({ src, size = 32, radius = 6 }: { src: string; size?: number; radius?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const g = ref.current?.getContext("2d"); if (!g) return;
      g.imageSmoothingEnabled = false; g.clearRect(0, 0, 8, 8);
      g.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8); g.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);
    };
    img.src = src;
  }, [src]);
  return <canvas ref={ref} width={8} height={8} className="skin-px shrink-0" style={{ width: size, height: size, borderRadius: radius, background: "var(--surface-2)" }} aria-hidden="true" />;
});
