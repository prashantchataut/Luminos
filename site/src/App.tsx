import { useEffect, useState } from "react";
import Hero from "./components/Hero";
import Tour from "./components/Tour";
import Themes from "./components/Themes";
import Android from "./components/Android";
import { Features, Client, Worlds, Limits } from "./components/Sections";
import { Changelog, FAQ, Closing } from "./components/Closing";
import Legal from "./components/Legal";
import Capes from "./components/Capes";
import { DownloadCTA, Wordmark } from "./components/ui";
import { REPO_URL, useRelease } from "./lib/useRelease";

const links = [
  ["Launcher", "#tour"],
  ["Themes", "#themes"],
  ["Android", "#android"],
  ["Client", "#client"],
  ["Not yet", "#limits"],
  ["FAQ", "#faq"],
];

function Nav({ ready }: { ready: boolean }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ${
        solid ? "border-b border-line bg-ink-1/70 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 md:px-10">
        <a href="#" aria-label="Luminos home">
          <Wordmark />
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-8 text-sm text-fg/80 md:flex">
          {links.map(([t, h]) => (
            <a key={t} href={h} className="transition-colors hover:text-white">
              {t}
            </a>
          ))}
          <a href={REPO_URL} className="transition-colors hover:text-white">
            GitHub
          </a>
        </nav>
        <a
          href="#download"
          className="btn btn-primary !h-10 !px-5 !text-sm"
          aria-label={ready ? "Download Luminos" : "Go to download"}
        >
          Download
        </a>
      </div>
    </header>
  );
}

function useHashRoute() {
  const get = () => window.location.hash;
  const [hash, setHash] = useState(get);
  useEffect(() => {
    const on = () => setHash(get());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export default function App() {
  const release = useRelease();
  const hash = useHashRoute();
  const page = hash === "#/privacy" ? "privacy" : hash === "#/license" ? "license" : null;

  // after leaving a legal page, scroll to the section the hash points at
  useEffect(() => {
    if (page || !hash || hash.startsWith("#/")) return;
    const el = document.getElementById(hash.slice(1));
    if (el) requestAnimationFrame(() => el.scrollIntoView());
  }, [page, hash]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-ink-1"
      >
        Skip to content
      </a>
      <Nav ready={release.status === "ready"} />
      {page ? (
        <Legal page={page} />
      ) : (
        <main id="main">
          <Hero release={release} />
          <Tour />
          <Themes />
          <Capes />
          <Features />
          <Client />
          <Worlds />
          <Android state={release} />
          <Limits />
          <Changelog />
          <FAQ />
          <Closing release={release} />
        </main>
      )}
      {page && (
        <footer className="border-t border-line px-6 py-10 text-center text-sm text-mute">
          <DownloadCTA release={release} />
        </footer>
      )}
    </>
  );
}
