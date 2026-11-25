/** Per-instance, gzip-compressed metadata cache for the store. Opens instantly from cache, then re-checks only what changed.
 *  Stored as base64(gzip(json)). Uses the platform CompressionStream (WebView2 and Node 22 both have it). */
export type Entry = { id: string; title: string; kind: string; updated: string; [k: string]: unknown };
export type Cached = { at: number; entries: Entry[] };

async function pipe(data: Uint8Array, ts: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(ts)); return new Uint8Array(await out.arrayBuffer());
}
export async function pack(c: Cached): Promise<string> {
  const z = await pipe(new TextEncoder().encode(JSON.stringify(c)), new CompressionStream("gzip"));
  let s = ""; for (let i = 0; i < z.length; i += 0x8000) s += String.fromCharCode(...z.subarray(i, i + 0x8000)); return btoa(s);
}
export async function unpack(s: string): Promise<Cached | null> {
  try { const bin = atob(s); const z = Uint8Array.from(bin, (ch) => ch.charCodeAt(0)); return JSON.parse(new TextDecoder().decode(await pipe(z, new DecompressionStream("gzip")))); } catch { return null; }
}
/** Which entries must be fetched again: new ids and ids whose `updated` stamp moved. Everything else is kept as cached. */
export function changed(cached: Entry[], fresh: { id: string; updated: string }[]): string[] {
  const have = new Map(cached.map((e) => [e.id, e.updated])); return fresh.filter((f) => have.get(f.id) !== f.updated).map((f) => f.id);
}
const key = (instance: string, kind: string) => `luminos.meta.${instance}.${kind}`;
export async function load(instance: string, kind: string, store: Pick<Storage, "getItem"> = localStorage) { const s = store.getItem(key(instance, kind)); return s ? unpack(s) : null; }
export async function save(instance: string, kind: string, c: Cached, store: Pick<Storage, "setItem"> = localStorage) { try { store.setItem(key(instance, kind), await pack(c)); return true; } catch { return false; } }
