let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}
