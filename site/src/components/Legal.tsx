import { useEffect } from "react";
import { Wordmark } from "./ui";
import { REPO_URL } from "../lib/useRelease";

// Generated from launcher/crates/luminos-core/src/netaudit.rs; the same list the launcher enforces at runtime.
// Regenerate: cargo run -q -p luminos-core --example hosts_json > site/src/lib/hosts.json
import registry from "../lib/hosts.json";

type Host = { host: string; purpose: string; sends: string; required_to_play: boolean; category_label: string };
const hosts = registry.hosts as Host[];
const groups = Array.from(new Set(hosts.map((h) => h.category_label))).map((label) => ({
  label,
  items: hosts.filter((h) => h.category_label === label),
}));

export default function Legal({ page }: { page: "privacy" | "license" }) {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = page === "privacy" ? "Privacy · Luminos" : "License · Luminos";
    return () => {
      document.title = "Luminos: a Minecraft launcher with a performance client built in";
    };
  }, [page]);

  return (
    <main className="min-h-screen px-6 pb-28 pt-32 md:px-10">
      <div className="mx-auto max-w-[760px]">
        <a href="#" className="inline-flex items-center gap-2 text-sm text-mute hover:text-fg">
          <span aria-hidden="true">←</span> Back to the site
        </a>
        <div className="mt-8">
          <Wordmark />
        </div>
        {page === "privacy" ? (
          <article className="mt-10">
            <h1 className="display text-[clamp(2.6rem,6vw,4rem)]">Privacy</h1>
            <p className="mt-6 text-base leading-relaxed text-mute">
              Luminos has no account system and no telemetry code. Nothing about you or your computer is sent to the
              Luminos project. This page is generated from the launcher's own host list, so you can check it against a
              firewall log.
            </p>
            <h2 className="mt-12 text-lg font-medium">Hosts the launcher contacts ({hosts.length})</h2>
            <p className="mt-3 text-base leading-relaxed text-mute">
              The launcher refuses any request to a host that is not on this list, checks every redirect hop, and lets you
              switch each host off under Settings, Network activity. Ads: {registry.ads}. Analytics: {registry.analytics}.
            </p>
            {groups.map((g) => (
              <section key={g.label} aria-label={g.label} className="mt-8">
                <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-accent">{g.label}</h3>
                <dl className="mt-3 divide-y divide-line border-y border-line">
                  {g.items.map((h) => (
                    <div key={h.host} className="grid gap-1 py-4 md:grid-cols-[1fr_1.4fr] md:gap-8">
                      <dt className="break-words font-mono text-[0.8125rem] text-fg">
                        {h.host}
                        {h.required_to_play && (
                          <span className="ml-2 rounded-sm border border-line px-1.5 py-0.5 align-middle font-sans text-[0.6875rem] text-mute">
                            needed to play
                          </span>
                        )}
                      </dt>
                      <dd className="text-[0.9375rem] text-mute">
                        {h.purpose}.
                        <span className="mt-1 block text-[0.8125rem]">Sends: {h.sends}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            <h2 className="mt-12 text-lg font-medium">What stays on your machine</h2>
            <p className="mt-3 text-base leading-relaxed text-mute">
              Instances, settings, skins, worlds, backups and playtime are stored in the Luminos data folder on your
              computer. Uninstalling the launcher leaves that folder alone so you don’t lose worlds; delete it by hand if
              you want everything gone.
            </p>
            <h2 className="mt-12 text-lg font-medium">This website</h2>
            <p className="mt-3 text-base leading-relaxed text-mute">
              The site sets no cookies and runs no analytics. The download button asks GitHub’s public API for the latest
              release when the page loads, so GitHub sees that request like any other visit to their API.
            </p>
            <p className="mt-12 text-sm text-mute">
              Plain-language summary of how the code behaves today. If the code changes, this page changes with it.
            </p>
          </article>
        ) : (
          <article className="mt-10">
            <h1 className="display text-[clamp(2.6rem,6vw,4rem)]">License</h1>
            <p className="mt-6 text-base leading-relaxed text-mute">
              Luminos is proprietary, source-available software. Copyright © 2026 Prashant Chataut. All rights reserved.
              The binding text is the{" "}
              <a className="text-accent underline underline-offset-4" href={`${REPO_URL}/blob/main/LICENSE`}>
                LICENSE file
              </a>{" "}
              in the repository. Here’s the short version.
            </p>
            <h2 className="mt-12 text-lg font-medium">You can</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-mute marker:text-accent">
              <li>Download and run the official Luminos binaries and Luminos Client for personal, non-commercial use, free of charge.</li>
              <li>Read the source, report bugs and suggest changes through issues and pull requests. Contributions are licensed to the owner under the same terms.</li>
            </ul>
            <h2 className="mt-12 text-lg font-medium">You can’t, without written permission</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-mute marker:text-accent">
              <li>Copy, fork for redistribution, modify or build derivative works from the code, artwork, logo or design.</li>
              <li>Redistribute, re-upload, sell or host the binaries or source.</li>
              <li>Use the Luminos name, logo or lumen orb for another product.</li>
              <li>Use the source to train or evaluate machine-learning models.</li>
            </ul>
            <h2 className="mt-12 text-lg font-medium">Third parties</h2>
            <p className="mt-3 text-base leading-relaxed text-mute">
              Open-source libraries and fonts keep their own licences, listed in THIRD_PARTY_NOTICES.md. Minecraft is a
              trademark of Mojang AB and Microsoft. Luminos isn’t affiliated with or endorsed by them, and contains no
              Minecraft code or assets.
            </p>
            <h2 className="mt-12 text-lg font-medium">No warranty</h2>
            <p className="mt-3 text-base leading-relaxed text-mute">
              The software is provided as is. The owner isn’t liable for damages from using it. Breaking these terms ends
              your rights under them.
            </p>
            <p className="mt-12 text-sm leading-relaxed text-mute">
              A public repository can still be forked on GitHub under GitHub’s own terms of service. To prevent that
              entirely, the source has to go in a private repository, with only the website and release downloads public.
              Have a lawyer review these terms before relying on them.
            </p>
          </article>
        )}
      </div>
    </main>
  );
}
