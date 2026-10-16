// Energy-based speech detector for 40 ms microphone chunks. Used for metrics in every mode,
// and to drive Gemini's turn-taking (activityStart / activityEnd) in "app" turn mode.

export type VadEvent = "start" | "end" | null;

export class EnergyVad {
  speaking = false;
  /** Time of the last chunk above the threshold. */
  lastVoiceAt = 0;
  private loudChunks = 0;
  /** Raises the threshold, e.g. while the coach is talking, so echo is not taken for speech. */
  scale = 1;

  constructor(
    public threshold: number,
    public hangoverMs: number,
    private startChunks = 2,
  ) {}

  push(rms: number, now: number): VadEvent {
    if (rms >= this.threshold * this.scale) {
      this.loudChunks++;
      this.lastVoiceAt = now;
      if (!this.speaking && this.loudChunks >= this.startChunks) {
        this.speaking = true;
        return "start";
      }
      return null;
    }
    this.loudChunks = 0;
    if (this.speaking && now - this.lastVoiceAt >= this.hangoverMs) {
      this.speaking = false;
      return "end";
    }
    return null;
  }
}

export function rms(pcm: Int16Array) {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i]! / 32768;
    sum += v * v;
  }
  return pcm.length ? Math.sqrt(sum / pcm.length) : 0;
}
