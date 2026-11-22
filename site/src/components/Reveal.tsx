import { useEffect, useRef, type ElementType, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
}

/** Fades content in once, the first time it scrolls into view. */
export default function Reveal({ children, as: Tag = "div", delay = 0, className = "" }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ ["--d" as string]: delay }}>
      {children}
    </Tag>
  );
}
