// App messages to the voice coach wait until the coach is free. A message sent while the coach is
// talking (or while Gemini is still answering the last one) cuts it off mid-word, and per-rep
// messages pile up behind each other so the coach praises rep 4 while the patient does rep 6.
// Each message has a key: a newer message with the same key replaces the waiting one, and its
// text is built when it is sent, from the state at that moment (null = nothing left to say).

export type Build = () => string | null;

export class Outbox {
  private items: { key: string; build: Build }[] = [];

  post(key: string, build: Build) {
    const waiting = this.items.find((i) => i.key === key);
    if (waiting) waiting.build = build;
    else this.items.push({ key, build });
  }

  /** The next message to send, skipping any that have nothing left to say. */
  next(): string | null {
    while (this.items.length) {
      const text = this.items.shift()!.build();
      if (text) return text;
    }
    return null;
  }

  get size() {
    return this.items.length;
  }

  clear() {
    this.items = [];
  }
}
