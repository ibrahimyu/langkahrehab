// Pulls spoken counts out of a live transcript ("satu, dua, tiga" or "one two three" or "1, 2, 3"),
// so the app has its own count to compare with what the coach logs.

const indonesian: Record<string, number> = {
  nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7,
  delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11,
};

const english: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
};

const unitId = (w: string | undefined) => {
  const n = w === undefined ? undefined : indonesian[w];
  return n !== undefined && n >= 1 && n <= 9 ? n : undefined;
};

/** Every number spoken in `text`, in order. */
export function parseNumbers(text: string): number[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (/^\d{1,3}$/.test(w)) {
      out.push(Number(w));
      continue;
    }
    const unit = unitId(w);
    if (unit !== undefined && words[i + 1] === "belas") {
      out.push(10 + unit);
      i++;
    } else if (unit !== undefined && words[i + 1] === "puluh") {
      let n = unit * 10;
      i++;
      const ones = unitId(words[i + 1]);
      // In "dua puluh dua puluh satu" the second "dua" starts the next number.
      const startsNext = words[i + 2] === "puluh" || words[i + 2] === "belas";
      if (ones !== undefined && !startsNext) {
        n += ones;
        i++;
      }
      out.push(n);
    } else if (indonesian[w] !== undefined) {
      out.push(indonesian[w]!);
    } else if (english[w] !== undefined) {
      let n = english[w]!;
      const ones = english[words[i + 1] ?? ""];
      if (n >= 20 && ones !== undefined && ones >= 1 && ones <= 9) {
        n += ones;
        i++;
      }
      out.push(n);
    }
  }
  return [...out, ...chineseNumbers(text)];
}

const chineseDigits: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** Chinese numerals: 一 … 九, 十, 十一, 二十, 二十一. Runs like 一二三 are separate counts. */
function chineseNumbers(text: string): number[] {
  const out: number[] = [];
  for (const [m] of text.matchAll(/[一二两三四五六七八九]?十[一二三四五六七八九]?|[零〇一二两三四五六七八九]/g)) {
    const at = m.indexOf("十");
    if (at < 0) out.push(chineseDigits[m]!);
    else {
      const tens = at === 0 ? 1 : chineseDigits[m[0]!]!;
      const ones = at === m.length - 1 ? 0 : chineseDigits[m[m.length - 1]!]!;
      out.push(tens * 10 + ones);
    }
  }
  return out;
}

/** The highest count heard in a set's transcript, or null if no number was heard. */
export function heardCount(text: string): number | null {
  const n = parseNumbers(text).filter((v) => v >= 1 && v <= 60);
  return n.length ? Math.max(...n) : null;
}
