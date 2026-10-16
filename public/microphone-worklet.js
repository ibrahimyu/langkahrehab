class LangkahMicrophone extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = [];
    this.position = 0;
    this.pending = [];
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    this.pending.push(...input);
    const ratio = sampleRate / 16000;
    while (this.position + ratio <= this.pending.length) {
      const first = Math.floor(this.position),
        last = Math.max(first + 1, Math.floor(this.position + ratio));
      let sum = 0;
      for (let i = first; i < last; i++) sum += this.pending[i];
      this.samples.push(Math.max(-1, Math.min(1, sum / (last - first))));
      this.position += ratio;
      if (this.samples.length === 640) {
        const pcm = new Int16Array(
          this.samples.map((n) => (n < 0 ? n * 32768 : n * 32767)),
        );
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
        this.samples = [];
      }
    }
    const consumed = Math.floor(this.position);
    this.pending.splice(0, consumed);
    this.position -= consumed;
    return true;
  }
}
registerProcessor("langkah-microphone", LangkahMicrophone);
