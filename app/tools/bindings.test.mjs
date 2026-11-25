// Fails when the TypeScript bindings and the Rust Tauri commands drift: every command the UI invokes must exist, be #[tauri::command], and be registered.
import { readFileSync } from "node:fs"; import assert from "node:assert/strict";
const ts = readFileSync("src/engine.ts", "utf8") + readFileSync("src/api.ts", "utf8");
const rs = readFileSync("src-tauri/src/engine.rs", "utf8") + readFileSync("src-tauri/src/lib.rs", "utf8");
const used = [...new Set([...ts.matchAll(/invoke(?:<[^>]*>)?\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]))];
const defined = new Set([...rs.matchAll(/#\[tauri::command\]\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-z0-9_]+)/g)].map((m) => m[1]));
const registered = readFileSync("src-tauri/src/lib.rs", "utf8").match(/generate_handler!\[([\s\S]*?)\]\)/)[1].split(",").map((x) => x.trim().replace(/^engine::/, "")).filter(Boolean);
let bad = 0; for (const c of used) { if (!defined.has(c)) { console.log("MISSING Rust command:", c); bad++; } if (!registered.includes(c)) { console.log("NOT REGISTERED:", c); bad++; } }
for (const c of registered) if (!defined.has(c)) { console.log("registered but not a command:", c); bad++; }
assert.equal(bad, 0); console.log(`ok   bindings: ${used.length} commands used by the UI, all defined and registered (${registered.length} registered in total)`);
