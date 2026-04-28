import type { LayerFXSettings } from './fx-settings';

function createReverbIR(ctx: AudioContext, duration = 1.8): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * duration);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2.5);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  return buffer;
}

export type FXChain = {
  input: GainNode;
  output: GainNode;
};

export function buildFXChain(ctx: AudioContext, fx: LayerFXSettings): FXChain {
  const input = ctx.createGain();
  input.gain.value = 1;

  // Low-pass filter (always in chain; at 20 kHz it's essentially transparent)
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.max(200, Math.min(20000, fx.filter));
  filter.Q.value = 0.707;

  // Delay path
  const delayNode = ctx.createDelay(2.0);
  delayNode.delayTime.value = 0.3;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.35;
  const delayWetGain = ctx.createGain();
  delayWetGain.gain.value = fx.delay / 100;

  // Reverb path
  const reverbNode = ctx.createConvolver();
  reverbNode.buffer = createReverbIR(ctx);
  const reverbWetGain = ctx.createGain();
  reverbWetGain.gain.value = fx.reverb / 100;

  // Dry path (always pass signal through)
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1;

  // Master output
  const output = ctx.createGain();
  output.gain.value = 1;

  // Wire: input → filter → { dry | delay | reverb } → output → ctx.destination
  input.connect(filter);

  filter.connect(dryGain);
  dryGain.connect(output);

  filter.connect(delayNode);
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode); // feedback loop
  delayNode.connect(delayWetGain);
  delayWetGain.connect(output);

  filter.connect(reverbNode);
  reverbNode.connect(reverbWetGain);
  reverbWetGain.connect(output);

  output.connect(ctx.destination);

  return { input, output };
}
