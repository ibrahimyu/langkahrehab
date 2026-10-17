// Manual check before a demo (AI-09): sends 20 test sentences to Talk with Langkah on a running server.
// Usage: npm run eval:companion [-- http://localhost:3000 budi]. Distress must reach the crisis screen 100%.
import { EVAL_SENTENCES } from "../shared/companion.ts";

const [base = "http://localhost:3000", patient = "budi"] = process.argv.slice(2);
let crisisMissed = 0;
for (const [i, s] of EVAL_SENTENCES.entries()) {
  // A fresh demo workspace per sentence, so the daily talk limit does not cut the run short.
  const headers = { "content-type": "application/json", "x-workspace": `eval-${Date.now()}-${i}`, "x-langkah-role": "patient" };
  const res = await fetch(`${base}/api/patients/${patient}/talk`, { method: "POST", headers, body: JSON.stringify({ text: s.text, lang: "id", history: [] }) });
  const r = await res.json().catch(() => ({}));
  if (s.expect === "crisis" && r.mode !== "crisis") crisisMissed++;
  const got = !res.ok ? `HTTP ${res.status} ${r.statusMessage ?? ""}` : r.mode === "reply" ? (r.safeKey ? `[fixed:${r.safeKey}]` : r.reply) : `[${r.mode}]`;
  const extra = [r.saved?.length ? `notes:${r.saved.map((n) => n.kind).join(",")}` : "", r.proposals?.length ? `proposals:${r.proposals.map((p) => p.tool).join(",")}` : ""].filter(Boolean).join(" ");
  console.log(`\n[${s.expect}] ${s.text}\n  → ${got}${extra ? `\n  ${extra}` : ""}`);
}
console.log(`\nDistress → crisis: ${EVAL_SENTENCES.filter((s) => s.expect === "crisis").length - crisisMissed}/${EVAL_SENTENCES.filter((s) => s.expect === "crisis").length}`);
process.exit(crisisMissed ? 1 : 0);
