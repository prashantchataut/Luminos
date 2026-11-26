const base = import.meta.env.BASE_URL;
const CAPES = [
  { id: "job-application", name: "Job Application", tag: "Meme", note: "Form, name line, ticked box, signature. Please apply in person." },
  { id: "ball-knowledge-tactician", name: "Ball Knowledge Tactician", tag: "Meme · animated", note: "Chalkboard pitch, X and O arrows, one raised eyebrow." },
  { id: "touch-grass-3d", name: "Touch Grass 3D", tag: "3D relief", note: "A grass block worn as a cloak." },
  { id: "404-skill-not-found", name: "404 Skill Not Found", tag: "Meme", note: "Your opponent ran into a problem." },
  { id: "luminos-original-moon", name: "Luminos Original Moon", tag: "3D relief", note: "The dithered moon, raised from the cloth." },
  { id: "eclipse-monarch-3d", name: "Eclipse Monarch 3D", tag: "3D relief", note: "A black sun with a violet corona." },
  { id: "crimson-ronin-3d", name: "Crimson Ronin 3D", tag: "3D relief", note: "Lacquered plates, each ridge extruded." },
  { id: "void-blossom", name: "Void Blossom", tag: "2D", note: "Petals through a violet void." },
  { id: "cobalt-prism", name: "Cobalt Prism", tag: "2D", note: "Hard-lit cobalt facets." },
  { id: "golden-veteran", name: "Golden Veteran", tag: "2D", note: "Service colours, a stripe per year." },
];

/** The cape set and the supplied artwork. Cape images are renders of the real cape textures shipped in the launcher. */
export default function Capes() {
  return (
    <section id="capes" aria-labelledby="capes-h" className="mx-auto max-w-[1120px] px-6 py-20">
      <h2 id="capes-h" className="m-0 text-3xl font-bold">Capes you can actually wear</h2>
      <p className="mt-3 max-w-[60ch] opacity-75">Ten original capes, from a job application to a 3D relief moon. Preview them on any skin in the launcher&rsquo;s Skin Showdown Studio. Capes show in the launcher; in-game rendering is not built yet.</p>
      <div className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-4">
        {CAPES.map((c, i) => (
          <figure key={c.id} className={`m-0 rounded-[14px] p-4 ${i === 0 ? "col-span-2 row-span-2" : ""}`} style={{ background: "#11141C", color: "#E2E8F0" }}>
            <div className="grid place-items-center rounded-[10px] py-4" style={{ background: "#0B0D12" }}>
              <img src={`${base}art/capes/${c.id}.png`} alt={`${c.name} cape, front view`} loading="lazy" className={i === 0 ? "h-[300px]" : "h-[140px]"} style={{ imageRendering: "pixelated", width: "auto" }} />
            </div>
            <figcaption className="mt-3"><div className="text-[13px] font-semibold">{c.name}</div><div className="text-[11px]" style={{ color: "#93C5FD" }}>{c.tag}</div>{i === 0 && <div className="text-[12.5px] mt-1.5" style={{ color: "#94A3B8" }}>{c.note}</div>}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-12 grid md:grid-cols-2 gap-4">
        {[["hero-blue-hour", "Launcher home"], ["title-bg", "In-game title screen background"]].map(([f, label]) => (
          <figure key={f} className="m-0 relative rounded-[14px] overflow-hidden">
            <img src={`${base}art/${f}.webp`} alt={label} loading="lazy" className="w-full h-[240px] object-cover" />
            <figcaption className="absolute left-4 bottom-3 text-[12px] font-semibold text-white" style={{ textShadow: "0 1px 8px rgba(0,0,0,.8)" }}>{label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
