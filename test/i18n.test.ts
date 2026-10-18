import { test } from "node:test";
import assert from "node:assert/strict";
import { LANGS } from "../shared/exercises";
import { text } from "../shared/i18n";
import { NOTIFY_KINDS } from "../shared/notifications";

// SYS-04: every text the app shows exists in English, Bahasa Indonesia and 中文.
test("SYS-04: every i18n key has EN, ID and 中文 text", () => {
  const missing: string[] = [];
  for (const [key, value] of Object.entries(text) as [string, Record<string, string>][])
    for (const lang of LANGS) if (typeof value[lang] !== "string" || !value[lang].trim()) missing.push(`${key}.${lang}`);
  assert.deepEqual(missing, []);
});

test("SYS-04: the {params} in each key are the same in all three languages", () => {
  const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const differ: string[] = [];
  for (const [key, value] of Object.entries(text) as [string, Record<string, string>][]) {
    const en = params(value.en ?? "");
    for (const lang of LANGS) if (params(value[lang] ?? "") !== en) differ.push(`${key}.${lang}`);
  }
  assert.deepEqual(differ, []);
});

test("SYS-11: every notification kind has a subject, a body and the button text", () => {
  assert.ok("ntfOpen" in text);
  for (const k of NOTIFY_KINDS) {
    assert.ok(`ntf_${k}` in text, `ntf_${k}`);
    assert.ok(`ntf_${k}_body` in text, `ntf_${k}_body`);
  }
});
