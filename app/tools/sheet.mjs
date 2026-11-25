// Contact sheet for review: node tools/sheet.mjs <round> <out.png> name1,name2,...
import { chromium } from "playwright"; import fs from "node:fs";
const [round, out, names] = process.argv.slice(2), dir = "../docs/design/rounds", list = names.split(",");
const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(2,1fr);gap:6px">${list.map((n) => `<img style="width:100%" src="data:image/png;base64,${fs.readFileSync(`${dir}/${n}-${round}.png`).toString("base64")}">`).join("")}</body>`;
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1700, height: 400 * Math.ceil(list.length / 2) + 20 } });
await p.setContent(html); await p.waitForTimeout(400); await p.screenshot({ path: out, fullPage: true }); await b.close();
