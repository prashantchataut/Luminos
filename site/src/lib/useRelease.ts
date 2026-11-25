import { useEffect, useState } from "react";
import manifest from "./release.json";

const REPO = "prashantchataut/Luminos";
export const RELEASES_URL = `https://github.com/${REPO}/releases`;
export const REPO_URL = `https://github.com/${REPO}`;
export const release = manifest;

/**
 * Download links come from release.json (written by the release job from the real SHA256SUMS.txt) and always name a specific tag:
 * /releases/latest/ skips pre-releases, so it would not resolve to a release candidate. The GitHub API is only used to add the
 * installer size and date for that exact tag; if it fails, the links still work.
 */
export type ReleaseState = {
  status: "ready" | "pending";
  tag: string;
  version: string;
  prerelease: boolean;
  url: string;
  apkUrl: string;
  sums: string;
  page: string;
  sizeMb?: string;
  date?: string;
};

export function useRelease(): ReleaseState {
  const base: ReleaseState = {
    status: manifest.published ? "ready" : "pending",
    tag: manifest.tag,
    version: manifest.version,
    prerelease: manifest.prerelease,
    url: manifest.windows.url,
    apkUrl: manifest.android.url,
    sums: manifest.checksums.url,
    page: manifest.releasePage,
  };
  const [extra, setExtra] = useState<Pick<ReleaseState, "sizeMb" | "date">>({});
  useEffect(() => {
    if (!manifest.published) return;
    const ctl = new AbortController();
    fetch(`https://api.github.com/repos/${REPO}/releases/tags/${manifest.tag}`, { signal: ctl.signal, headers: { Accept: "application/vnd.github+json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rel: { published_at: string; assets: { name: string; size: number }[] }) => {
        const exe = rel.assets.find((a) => a.name === manifest.windows.name);
        setExtra({
          sizeMb: exe ? (exe.size / 1048576).toFixed(1) : undefined,
          date: new Date(rel.published_at).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" }),
        });
      })
      .catch(() => undefined);
    return () => ctl.abort();
  }, []);
  return { ...base, ...extra };
}
