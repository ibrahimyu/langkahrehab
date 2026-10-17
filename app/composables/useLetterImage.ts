// DOK-01: the discharge letter photo stays in the browser. It is shrunk to 1600 px on the long side
// before it is sent once for reading, and kept in memory (not storage) for the review screen.

const LONG_SIDE = 1600;
export const MAX_LETTER_CHARS = 5_600_000; // about 4 MB

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This file is not a photo we can open."));
    img.src = src;
  });
}

/** A JPEG data URL of the photo, at most 1600 px on the long side. */
export async function compressLetterPhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPEG or PNG photo.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, LONG_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.85);
    if (data.length > MAX_LETTER_CHARS) throw new Error("The photo is too large. Try again with a smaller one.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draws a synthetic sample letter as a paper photo (MED-04: labelled as a fictional patient). */
export function drawSampleLetter(lines: string[]): string {
  const w = 1100;
  const lineH = 44;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = 120 + lines.length * lineH;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "white";
  g.fillRect(0, 0, canvas.width, canvas.height);
  lines.forEach((line, i) => {
    const y = 80 + i * lineH;
    if (i === 0) {
      g.fillStyle = "firebrick";
      g.font = "bold 26px sans-serif";
    } else {
      g.fillStyle = "black";
      g.font = i < 3 ? "bold 30px serif" : "26px monospace";
    }
    g.fillText(line, 60, y);
  });
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** Photos by intake id, for this tab only. */
export const useLetterImages = () => useState<Record<string, string>>("letter-images", () => ({}));
