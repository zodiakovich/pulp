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

export async function closeAudioContext(): Promise<void> {
  if (!ctx) return;
  const current = ctx;
  ctx = null;
  if (current.state !== 'closed') {
    await current.close().catch(() => {});
  }
}
