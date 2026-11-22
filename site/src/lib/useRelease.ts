import { useEffect, useState } from "react";

const REPO = "prashantchataut/Luminos";
export const RELEASES_URL = `https://github.com/${REPO}/releases`;
export const REPO_URL = `https://github.com/${REPO}`;

export type ReleaseState =
  | { status: "loading" }
  | { status: "ready"; tag: string; url: string; sizeMb: string; date: string; sums?: string }
  | { status: "none" } // repo reachable, no installer asset attached yet
  | { status: "error" }; // offline, rate-limited, blocked

interface GhAsset {
  name: string;
  browser_download_url: string;
  size: number;
}
interface GhRelease {
  tag_name: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: GhAsset[];
}

/** Reads the newest GitHub release that carries a Windows installer. */
export function useRelease(): ReleaseState {
  const [state, setState] = useState<ReleaseState>({ status: "loading" });
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`https://api.github.com/repos/${REPO}/releases?per_page=15`, {
      signal: ctl.signal,
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<GhRelease[]>;
      })
      .then((list) => {
        for (const rel of list) {
          if (rel.draft) continue;
          const exe = rel.assets.find((a) => /^Luminos-Setup.*\.exe$/i.test(a.name));
          if (exe) {
            const sums = rel.assets.find((a) => /sha256/i.test(a.name));
            setState({
              status: "ready",
              tag: rel.tag_name,
              url: exe.browser_download_url,
              sizeMb: (exe.size / 1048576).toFixed(1),
              date: new Date(rel.published_at).toLocaleDateString("en", {
                year: "numeric",
                month: "short",
                day: "numeric",
              }),
              sums: sums?.browser_download_url,
            });
            return;
          }
        }
        setState({ status: "none" });
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setState({ status: "error" });
      });
    return () => ctl.abort();
  }, []);
  return state;
}
