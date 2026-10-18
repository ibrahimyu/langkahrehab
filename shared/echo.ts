// GAP-VIDEO #3: on a phone speaker the Live input transcript sometimes picks up the coach's own
// voice, and the caption then showed the coach's sentence as "You:". A transcript that is mostly
// words the coach just said is treated as echo, not as the patient. Short answers ("ya", "tiga")
// are always kept, because the patient often repeats a word the coach used.

const words = (s: string): string[] => {
  const clean = s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, " ");
  // Chinese has no spaces: compare characters instead.
  return /[㐀-鿿]/.test(clean) ? [...clean.replace(/\s+/g, "")] : clean.split(/\s+/).filter(Boolean);
};

export function isEcho(heard: string, coachRecent: string, minWords = 3, share = 0.7): boolean {
  const w = words(heard);
  if (w.length < minWords) return false;
  const coach = new Set(words(coachRecent));
  if (!coach.size) return false;
  return w.filter((x) => coach.has(x)).length / w.length >= share;
}
