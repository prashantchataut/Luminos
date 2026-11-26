const base = import.meta.env.BASE_URL;
const CAPES = [
  { id: "luminos-original-moon", name: "Luminos Original Moon 3D", tag: "3D relief", note: "The dithered crescent over midnight cloth, a silver clasp at the shoulders." },
  { id: "job-application", name: "Job Application 3D", tag: "Meme", note: "A wooden clipboard, a steel clip, and a form that wants 0 hours of experience." },
  { id: "ball-knowledge-tactician", name: "Ball Knowledge Tactician 3D", tag: "Meme", note: "" },
  { id: "touch-grass-3d", name: "Touch Grass 3D", tag: "3D relief", note: "" },
  { id: "404-skill-not-found", name: "404 Skill Not Found", tag: "Meme", note: "" },
  { id: "crimson-ronin-3d", name: "Crimson Ronin 3D", tag: "3D relief", note: "" },
  { id: "eclipse-monarch-3d", name: "Eclipse Monarch 3D", tag: "3D relief", note: "" },
  { id: "cobalt-prism-3d", name: "Cobalt Prism 3D", tag: "3D relief", note: "" },
  { id: "sakura-nightfall-3d", name: "Sakura Nightfall 3D", tag: "3D relief", note: "" },
  { id: "void-dragon-3d", name: "Void Dragon 3D", tag: "3D relief", note: "" },
];

/** The cape set and the supplied artwork. Cape images are renders of the real cape textures shipped in the launcher. */
export default function Capes() {
  return (
    <section id="capes" aria-labelledby="capes-h" className="mx-auto max-w-[1120px] px-6 py-20">
      <h2 id="capes-h" className="m-0 text-3xl font-bold">Capes you can actually wear</h2>
      <p className="mt-3 max-w-[60ch] opacity-75">Ten original HD (512&times;256) capes, drawn on a real 3D player from behind with an extruded relief layer. Preview them on any skin in the launcher&rsquo;s Skin Showdown Studio. The same textures ship in the in-game client; the in-game cape swap has not been run in a real game yet.</p>
      <div className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-4">
        {CAPES.map((c, i) => (
          <figure key={c.id} className={`m-0 rounded-[14px] p-4 ${i === 0 ? "col-span-2 row-span-2" : ""}`} style={{ background: "#11141C", color: "#E2E8F0" }}>
            <div className="grid place-items-center rounded-[10px] py-4" style={{ background: "#0B0D12" }}>
              <img src={`${base}art/capes/${c.id}.png`} alt={`${c.name} cape, worn, 3/4 back view`} loading="lazy" className={i === 0 ? "h-[330px]" : "h-[160px]"} style={{ width: "auto" }} />
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
