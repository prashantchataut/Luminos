/** Mirrors luminos-core::authlib (Rust, unit-tested). Used only to show the exact launch argument the engine will add. */
export const ELY_API = "https://authserver.ely.by/api/authlib-injector";
export function validYggdrasil(url: string): string | null {
  let u: URL; try { u = new URL(url.trim()); } catch { return "That is not a URL."; }
  if (u.protocol !== "https:") return "Use an https:// address. A plain http:// auth server would send passwords in the clear.";
  if (!u.hostname.includes(".")) return "That host name has no domain.";
  return null;
}
export const authlibArg = (url: string, jar = "authlib-injector.jar") => `-javaagent:${jar}=${url.trim().replace(/\/+$/, "")}`;
