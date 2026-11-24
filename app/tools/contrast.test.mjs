import { readFileSync } from "node:fs";
import { check, ratio, REQUIRED } from "../src/themes/contrast.js";
let fails = 0;
for (const id of ["clean", "lunar", "light"]) {
  const t = JSON.parse(readFileSync(new URL(`../src/themes/${id}.json`, import.meta.url)));
  const bad = check(t.tokens);
  console.log(`${id.padEnd(6)} ${bad.length ? "FAIL" : "pass"}  min text ratio ${Math.min(...REQUIRED.filter(r => r[2] >= 4.5).map(([f, b]) => ratio(t.tokens[f], t.tokens[b]))).toFixed(2)}:1`);
  bad.forEach((b) => console.log("   ", b)); fails += bad.length;
}
if (fails) process.exit(1);
