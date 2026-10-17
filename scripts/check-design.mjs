// Design lint: colours, radii and shadows come from the tokens in app/assets/css/main.css (:root).
// Counts raw colour literals outside the token block and in components. The count may only go down:
// update scripts/design-baseline.json when it drops, never when it rises.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g;
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(vue|css)$/.test(name)) files.push(p);
  }
};
walk("app");

let total = 0;
const report = [];
for (const file of files) {
  let text = readFileSync(file, "utf8");
  // The token block is the one place raw values belong.
  if (file.endsWith("main.css")) text = text.replace(/:root\s*\{[\s\S]*?\n\}/, "");
  // Vue imports such as "#shared/model" are not colours.
  text = text.replace(/#shared\/[\w/]+/g, "");
  const hits = text.match(COLOR) ?? [];
  if (hits.length) report.push(`${file}: ${hits.length}`);
  total += hits.length;
}

const baselinePath = "scripts/design-baseline.json";
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).rawColors;
if (process.argv.includes("--update")) {
  writeFileSync(baselinePath, JSON.stringify({ rawColors: total }, null, 2) + "\n");
  console.log(`Baseline set to ${total}.`);
} else if (total > baseline) {
  console.error(`Raw colours: ${total} (baseline ${baseline}). Use tokens instead:\n${report.join("\n")}`);
  process.exit(1);
} else {
  console.log(`Raw colours: ${total} (baseline ${baseline}).${total < baseline ? " Lower than baseline: run with --update." : ""}`);
}
