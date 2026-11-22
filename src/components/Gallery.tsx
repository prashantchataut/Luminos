"use client";
import { useState } from "react";
import { SCREENS, shot } from "@/lib/site";

export default function Gallery() {
  const [i, setI] = useState(5);
  const s = SCREENS[i];
  return (
    <div>
      <div className="mb-5 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Launcher screens">
        {SCREENS.map((x, n) => (
          <button
            key={x.file}
            role="tab"
            aria-selected={n === i}
            onClick={() => setI(n)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              n === i ? "border-[#4f8cff] bg-[#4f8cff]/25 text-white" : "border-[#213060] bg-[#0f1734]/70 text-[#8596c5] hover:border-[#4f8cff]/60 hover:text-white"
            }`}
          >
            {x.title}
          </button>
        ))}
      </div>
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-[#213060] bg-[#050816] shadow-[0_30px_120px_-20px_rgba(47,107,255,0.45)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={s.file} src={shot(s.file)} alt={`Luminos Launcher – ${s.title}`} className="block w-full animate-[fadein_.45s_ease-out]" loading="lazy" />
      </div>
      <p className="mx-auto mt-5 max-w-2xl text-center text-[#8596c5]">
        <span className="font-semibold text-white">{s.title}.</span> {s.desc}
      </p>
    </div>
  );
}
