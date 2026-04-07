// ============================================================
// PULP — Web Audio Sound Engine
// 6 melody synths, 4 chord synths, 5 bass synths, 10+ drums
// Genre-aware sound selection
// ============================================================

import { NoteEvent, getGenreSoundMap, type GenreSoundMap } from './music-engine';

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.35;
    
    // Soft clipper on master
    const waveshaper = audioCtx.createWaveShaper();
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * 1.5);
    }
    waveshaper.curve = curve;
    waveshaper.oversample = '2x';
    
    masterGain.connect(waveshaper);
    waveshaper.connect(audioCtx.destination);
    
    // Create reverb
    reverbNode = createReverb(audioCtx);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// --- REVERB ---
function createReverb(ctx: AudioContext): ConvolverNode {
  const conv = ctx.createConvolver();
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 0.8; // 0.8s reverb
  const impulse = ctx.createBuffer(2, length, sampleRate);
  
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.2));
    }
  }
  conv.buffer = impulse;
  return conv;
}

// --- MIDI TO FREQUENCY ---
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ============================================================
// SYNTH PRESETS
// ============================================================

type SynthFunction = (
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  startTime: number,
  duration: number,
  velocity: number
) => void;

// --- MELODY SYNTHS ---

const melodyFmBell: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Brighter bell than `melodyBell`
  const gain = ctx.createGain();
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();

  carrier.type = 'sine';
  carrier.frequency.value = freq;

  modulator.type = 'sine';
  modulator.frequency.value = freq * 3.01;
  modGain.gain.setValueAtTime(freq * 1.2, start);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.2, start + 0.35);

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(gain);

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.22, start + 0.002);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.01, start + 0.7);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.9));

  gain.connect(dest);
  carrier.start(start);
  modulator.start(start);
  carrier.stop(start + Math.min(dur, 1.1));
  modulator.stop(start + Math.min(dur, 1.1));
};

const melodyDetunedSaw: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2200, start);
  filter.frequency.exponentialRampToValueAtTime(900, start + 0.4);
  filter.Q.value = 0.8;

  for (const detune of [-14, -6, 6, 14]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + dur + 0.25);
  }

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.12, start + 0.03);
  gain.gain.setValueAtTime((vel / 127) * 0.1, start + Math.max(0.05, dur - 0.08));
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.25);

  filter.connect(gain);
  gain.connect(dest);
};

const melodyMarimba: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Simple resonant mallet: triangle + resonant bandpass burst
  const gain = ctx.createGain();
  const osc = ctx.createOscillator();
  const bp = ctx.createBiquadFilter();
  const hp = ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.value = freq;

  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq * 2, start);
  bp.Q.value = 8;
  hp.type = 'highpass';
  hp.frequency.value = 120;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.2, start + 0.002);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.02, start + 0.25);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.35));

  osc.connect(bp);
  bp.connect(hp);
  hp.connect(gain);
  gain.connect(dest);

  osc.start(start);
  osc.stop(start + Math.min(dur, 0.5));
};

const melodyFlute: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const noise = ctx.createBufferSource();
  const noiseGain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;

  filter.type = 'lowpass';
  filter.frequency.value = 2800;
  filter.Q.value = 0.6;

  // Breath noise
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  noise.buffer = buf;
  noiseGain.gain.setValueAtTime(0, start);
  noiseGain.gain.linearRampToValueAtTime((vel / 127) * 0.02, start + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.18, start + 0.06);
  gain.gain.setValueAtTime((vel / 127) * 0.14, start + Math.max(0.08, dur - 0.08));
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.08);

  noise.connect(noiseGain);
  noiseGain.connect(filter);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc.start(start);
  noise.start(start);
  osc.stop(start + dur + 0.1);
  noise.stop(start + 0.2);
};

const melodyChoir: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Soft formant-ish pad: additive + slow envelope
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.8;

  for (const mult of [1, 2, 3, 4]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    const og = ctx.createGain();
    og.gain.value = (1 / mult) * 0.3;
    osc.connect(og);
    og.connect(filter);
    osc.start(start);
    osc.stop(start + dur + 0.6);
  }

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.1, start + 0.25);
  gain.gain.setValueAtTime((vel / 127) * 0.1, start + Math.max(0.3, dur - 0.12));
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.6);

  filter.connect(gain);
  gain.connect(dest);
};

const melodyPizzicato: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Plucked string-ish: triangle + quick LPF envelope
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.value = freq;

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, start);
  filter.frequency.exponentialRampToValueAtTime(600, start + 0.12);
  filter.Q.value = 2;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.22, start + 0.002);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.03, start + 0.12);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.22));

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc.start(start);
  osc.stop(start + Math.min(dur, 0.28));
};

const melodyPluck: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  osc.type = 'square';
  osc.frequency.value = freq;
  
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000 + vel * 20, start);
  filter.frequency.exponentialRampToValueAtTime(400, start + 0.2);
  filter.Q.value = 2;
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.3, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(vel / 127 * 0.03, start + 0.2);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.5));
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  
  osc.start(start);
  osc.stop(start + Math.min(dur, 0.6));
};

const melodyPad: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1500;
  
  // Two detuned saws
  for (const detune of [-7, 7]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + dur + 0.8);
  }
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.15, start + 0.3);
  gain.gain.setValueAtTime(vel / 127 * 0.15, start + dur - 0.1);
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.8);
  
  filter.connect(gain);
  gain.connect(dest);
};

const melodyAcid: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3000 + vel * 25, start);
  filter.frequency.exponentialRampToValueAtTime(200, start + 0.15);
  filter.Q.value = 12;
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.25, start + 0.001);
  gain.gain.exponentialRampToValueAtTime(vel / 127 * 0.05, start + 0.15);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.3));
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  
  osc.start(start);
  osc.stop(start + Math.min(dur, 0.4));
};

const melodyBell: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const gain = ctx.createGain();
  
  // FM synthesis: carrier + modulator at 2.5x
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  
  carrier.type = 'sine';
  carrier.frequency.value = freq;
  
  modulator.type = 'sine';
  modulator.frequency.value = freq * 2.5;
  modGain.gain.value = freq * 0.8;
  
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(gain);
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.2, start + 0.002);
  gain.gain.exponentialRampToValueAtTime(vel / 127 * 0.01, start + 0.6);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.8));
  
  gain.connect(dest);
  
  carrier.start(start);
  modulator.start(start);
  carrier.stop(start + Math.min(dur, 1));
  modulator.stop(start + Math.min(dur, 1));
};

const melodySuperSaw: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3000;
  
  // 3 detuned saws
  for (const detune of [-12, 0, 12]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + dur + 0.3);
  }
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.12, start + 0.05);
  gain.gain.setValueAtTime(vel / 127 * 0.12, start + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.3);
  
  filter.connect(gain);
  gain.connect(dest);
};

const melodySineLead: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.value = freq;
  
  // Vibrato
  lfo.type = 'sine';
  lfo.frequency.value = 5;
  lfoGain.gain.value = 3;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.2, start + 0.01);
  gain.gain.setValueAtTime(vel / 127 * 0.12, start + 0.3);
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.1);
  
  osc.connect(gain);
  gain.connect(dest);
  
  osc.start(start);
  lfo.start(start);
  osc.stop(start + dur + 0.15);
  lfo.stop(start + dur + 0.15);
};

// --- CHORD SYNTHS ---

const chordStringPad: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Slightly brighter than warm pad
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1600;
  filter.Q.value = 0.7;

  for (const detune of [-10, 0, 10]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + dur + 1.0);
  }

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.09, start + 0.35);
  gain.gain.setValueAtTime((vel / 127) * 0.08, start + Math.max(0.4, dur - 0.12));
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 1.0);

  filter.connect(gain);
  gain.connect(dest);
};

const chordRhodes: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Bell-ish electric piano
  const gain = ctx.createGain();
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  carrier.type = 'sine';
  carrier.frequency.value = freq;
  mod.type = 'sine';
  mod.frequency.value = freq * 2;
  modGain.gain.value = freq * 0.55;

  filter.type = 'lowpass';
  filter.frequency.value = 3200;

  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(filter);
  filter.connect(gain);

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.12, start + 0.004);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.03, start + 0.5);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 1.8));

  gain.connect(dest);
  carrier.start(start);
  mod.start(start);
  carrier.stop(start + Math.min(dur, 2.0));
  mod.stop(start + Math.min(dur, 2.0));
};

const chordWurlitzer: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Grittier EP: triangle with mild saturation
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const ws = ctx.createWaveShaper();

  osc.type = 'triangle';
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.frequency.value = 2400;

  const curve = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    const x = (i * 2) / 128 - 1;
    curve[i] = Math.tanh(x * 1.3);
  }
  ws.curve = curve;
  ws.oversample = '2x';

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.1, start + 0.006);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.025, start + 0.55);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 1.6));

  osc.connect(filter);
  filter.connect(ws);
  ws.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + Math.min(dur, 1.9));
};

const chordVibraphone: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Metallic mallet, longer decay
  const gain = ctx.createGain();
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();

  carrier.type = 'sine';
  carrier.frequency.value = freq;
  mod.type = 'sine';
  mod.frequency.value = freq * 2.7;
  modGain.gain.value = freq * 0.7;

  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(gain);

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.12, start + 0.003);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.012, start + 1.1);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 1.6));

  gain.connect(dest);
  carrier.start(start);
  mod.start(start);
  carrier.stop(start + Math.min(dur, 1.9));
  mod.stop(start + Math.min(dur, 1.9));
};

const chordBrassSection: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, start);
  filter.frequency.exponentialRampToValueAtTime(1200, start + 0.2);
  filter.Q.value = 0.9;

  for (const detune of [-6, 0, 6]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + dur + 0.2);
  }

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.11, start + 0.03);
  gain.gain.setValueAtTime((vel / 127) * 0.1, start + Math.max(0.05, dur - 0.06));
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.2);

  filter.connect(gain);
  gain.connect(dest);
};

const chordWarmPad: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  
  for (const detune of [-8, 8]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + dur + 1.2);
  }
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.08, start + 0.4);
  gain.gain.setValueAtTime(vel / 127 * 0.08, start + dur - 0.1);
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 1.2);
  
  filter.connect(gain);
  gain.connect(dest);
};

const chordEPiano: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const gain = ctx.createGain();
  
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  
  carrier.type = 'sine';
  carrier.frequency.value = freq;
  modulator.type = 'sine';
  modulator.frequency.value = freq * 2;
  modGain.gain.value = freq * 0.4;
  
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(gain);
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.12, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(vel / 127 * 0.04, start + 0.4);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 1.5));
  
  gain.connect(dest);
  carrier.start(start);
  modulator.start(start);
  carrier.stop(start + Math.min(dur, 1.6));
  modulator.stop(start + Math.min(dur, 1.6));
};

const chordOrgan: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const gain = ctx.createGain();
  
  // Additive synthesis: fundamental + 2x + 3x
  for (const mult of [1, 2, 3]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    const oscGain = ctx.createGain();
    oscGain.gain.value = (1 / mult) * 0.5;
    osc.connect(oscGain);
    oscGain.connect(gain);
    osc.start(start);
    osc.stop(start + dur + 0.1);
  }
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.08, start + 0.01);
  gain.gain.setValueAtTime(vel / 127 * 0.06, start + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.1);
  
  gain.connect(dest);
};

const chordGlass: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  osc.type = 'triangle';
  osc.frequency.value = freq;
  
  filter.type = 'highpass';
  filter.frequency.value = 400;
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.1, start + 0.002);
  gain.gain.exponentialRampToValueAtTime(vel / 127 * 0.01, start + 0.8);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 1));
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  
  osc.start(start);
  osc.stop(start + Math.min(dur, 1.2));
};

// --- BASS SYNTHS ---

const bassWobble: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  filter.type = 'lowpass';
  filter.frequency.value = 180;
  filter.Q.value = 10;

  lfo.type = 'sine';
  lfo.frequency.value = 2.2;
  lfoGain.gain.value = 900;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  for (const detune of [-12, 12]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + dur + 0.25);
  }

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.22, start + 0.01);
  gain.gain.setValueAtTime((vel / 127) * 0.2, start + Math.max(0.05, dur - 0.05));
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.2);

  filter.connect(gain);
  gain.connect(dest);
  lfo.start(start);
  lfo.stop(start + dur + 0.25);
};

const bassFingered: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Round pluck with gentle transient
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.value = freq;

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, start);
  filter.frequency.exponentialRampToValueAtTime(220, start + 0.18);
  filter.Q.value = 0.9;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.28, start + 0.003);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.06, start + 0.18);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.45));

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + Math.min(dur, 0.6));
};

const bassUpright: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Wooden body: triangle + formant-ish bandpass
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const bp = ctx.createBiquadFilter();
  const lp = ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.value = freq;
  bp.type = 'bandpass';
  bp.frequency.value = 220;
  bp.Q.value = 0.8;
  lp.type = 'lowpass';
  lp.frequency.value = 900;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.26, start + 0.006);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.05, start + 0.25);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.55));

  osc.connect(bp);
  bp.connect(lp);
  lp.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + Math.min(dur, 0.75));
};

const bassSlap: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  // Click transient
  const click = ctx.createBufferSource();
  const clickBuf = ctx.createBuffer(1, ctx.sampleRate * 0.008, ctx.sampleRate);
  const clickData = clickBuf.getChannelData(0);
  for (let i = 0; i < clickData.length; i++) clickData[i] = (Math.random() * 2 - 1) * 0.6;
  click.buffer = clickBuf;
  const clickGain = ctx.createGain();
  clickGain.gain.value = (vel / 127) * 0.08;
  click.connect(clickGain);
  clickGain.connect(dest);
  click.start(start);

  osc.type = 'square';
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, start);
  filter.frequency.exponentialRampToValueAtTime(300, start + 0.12);
  filter.Q.value = 1.2;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.25, start + 0.002);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.03, start + 0.14);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.35));

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + Math.min(dur, 0.5));
};

const bassTb303: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Alias of acid bass, but with slightly different envelope
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.value = freq;

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2800, start);
  filter.frequency.exponentialRampToValueAtTime(120, start + Math.min(dur, 0.22));
  filter.Q.value = 18;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.3, start + 0.002);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.05, start + Math.min(dur, 0.28));
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.42));

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + Math.min(dur, 0.55));
};

const bassLogDrum: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  // Amapiano log drum-ish: pitched sine + short pitch drop + saturation
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const ws = ctx.createWaveShaper();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.8, start);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.85, start + 0.06);

  const curve = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    const x = (i * 2) / 128 - 1;
    curve[i] = Math.tanh(x * 2.2);
  }
  ws.curve = curve;
  ws.oversample = '2x';

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime((vel / 127) * 0.35, start + 0.004);
  gain.gain.exponentialRampToValueAtTime((vel / 127) * 0.05, start + 0.22);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.35));

  osc.connect(ws);
  ws.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + Math.min(dur, 0.5));
};

const bassSubBass: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.value = freq;
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.35, start + 0.005);
  gain.gain.setValueAtTime(vel / 127 * 0.35, start + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.2);
  
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.25);
};

const bassReese: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  
  lfo.type = 'sine';
  lfo.frequency.value = 0.5;
  lfoGain.gain.value = 200;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  
  for (const detune of [-250, 250]) { // 5Hz detune equivalent
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + dur + 0.2);
  }
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.2, start + 0.01);
  gain.gain.setValueAtTime(vel / 127 * 0.2, start + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0.001, start + dur + 0.2);
  
  filter.connect(gain);
  gain.connect(dest);
  lfo.start(start);
  lfo.stop(start + dur + 0.25);
};

const bassAcid: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2500, start);
  filter.frequency.exponentialRampToValueAtTime(150, start + Math.min(dur, 0.25));
  filter.Q.value = 15;
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.3, start + 0.002);
  gain.gain.exponentialRampToValueAtTime(vel / 127 * 0.05, start + Math.min(dur, 0.3));
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.4));
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + Math.min(dur, 0.5));
};

const bass808: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  // Pitch envelope: drop from +12 semitones
  osc.frequency.setValueAtTime(freq * 2, start);
  osc.frequency.exponentialRampToValueAtTime(freq, start + 0.05);
  
  // Subtle distortion
  const waveshaper = ctx.createWaveShaper();
  const curve = new Float32Array(64);
  for (let i = 0; i < 64; i++) {
    const x = (i * 2) / 64 - 1;
    curve[i] = Math.tanh(x * 2);
  }
  waveshaper.curve = curve;
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.4, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(vel / 127 * 0.05, start + Math.min(dur, 0.6));
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.8));
  
  osc.connect(waveshaper);
  waveshaper.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + Math.min(dur, 1));
};

const bassPluckBass: SynthFunction = (ctx, dest, freq, start, dur, vel) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  osc.type = 'square';
  osc.frequency.value = freq;
  
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1500, start);
  filter.frequency.exponentialRampToValueAtTime(300, start + 0.15);
  
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vel / 127 * 0.25, start + 0.002);
  gain.gain.exponentialRampToValueAtTime(vel / 127 * 0.03, start + 0.15);
  gain.gain.linearRampToValueAtTime(0.001, start + Math.min(dur, 0.3));
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + Math.min(dur, 0.4));
};

// --- DRUM SYNTHS ---

function drumKickDeep(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, start);
  osc.frequency.exponentialRampToValueAtTime(42, start + 0.12);
  gain.gain.setValueAtTime((vel / 127) * 0.65, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + 0.4);
}

function drumKickPunchy(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const click = ctx.createBufferSource();
  const clickBuf = ctx.createBuffer(1, ctx.sampleRate * 0.006, ctx.sampleRate);
  const data = clickBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
  click.buffer = clickBuf;
  const cg = ctx.createGain();
  cg.gain.value = (vel / 127) * 0.22;
  click.connect(cg);
  cg.connect(dest);
  click.start(start);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, start);
  osc.frequency.exponentialRampToValueAtTime(55, start + 0.08);
  gain.gain.setValueAtTime((vel / 127) * 0.6, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + 0.28);
}

function drumKickDistorted(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const ws = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = Math.tanh(x * 3);
  }
  ws.curve = curve;
  ws.oversample = '2x';
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, start);
  osc.frequency.exponentialRampToValueAtTime(50, start + 0.06);
  gain.gain.setValueAtTime((vel / 127) * 0.7, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
  osc.connect(ws);
  ws.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + 0.3);
}

function drumSnareTight(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 220;
  g.gain.setValueAtTime((vel / 127) * 0.22, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + 0.045);
  osc.connect(g);
  g.connect(dest);
  osc.start(start);
  osc.stop(start + 0.06);

  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.11, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 4500;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime((vel / 127) * 0.18, start);
  ng.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(dest);
  noise.start(start);
}

function drumSnareFat(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  drumSnare(ctx, dest, start, vel);
  // Add extra low body
  const body = ctx.createOscillator();
  const bg = ctx.createGain();
  body.type = 'sine';
  body.frequency.value = 140;
  bg.gain.setValueAtTime((vel / 127) * 0.22, start);
  bg.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
  body.connect(bg);
  bg.connect(dest);
  body.start(start);
  body.stop(start + 0.1);
}

function drumSnareBrush(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.22, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
  noise.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  const g = ctx.createGain();
  g.gain.setValueAtTime((vel / 127) * 0.14, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
  noise.connect(lp);
  lp.connect(g);
  g.connect(dest);
  noise.start(start);
}

function drumClapReverb(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  if (!reverbNode) reverbNode = createReverb(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  const dry = ctx.createGain();
  dry.gain.value = 0.7;
  dry.connect(dest);
  wet.connect(reverbNode);
  reverbNode.connect(dest);
  drumClap(ctx, dry, start, vel);
  drumClap(ctx, wet, start, vel);
}

function drumPedalHat(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  // Shorter, lower hat
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 6000;
  filter.Q.value = 1.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime((vel / 127) * 0.12, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.02);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  noise.start(start);
}

function drumSizzleHat(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  // Longer noisy hat tail
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime((vel / 127) * 0.09, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
  noise.connect(hp);
  hp.connect(gain);
  gain.connect(dest);
  noise.start(start);
}

function drumTambourine(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  for (let i = 0; i < 4; i++) {
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 9000;
    bp.Q.value = 1;
    const g = ctx.createGain();
    g.gain.value = (vel / 127) * 0.06;
    noise.connect(bp);
    bp.connect(g);
    g.connect(dest);
    noise.start(start + i * 0.012);
  }
}

function drumBongo(ctx: AudioContext, dest: AudioNode, start: number, vel: number, high: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(high ? 640 : 420, start);
  osc.frequency.exponentialRampToValueAtTime(high ? 280 : 190, start + 0.08);
  gain.gain.setValueAtTime((vel / 127) * 0.18, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + (high ? 0.055 : 0.085));
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + 0.12);
}

function drumKickHouse(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, start);
  osc.frequency.exponentialRampToValueAtTime(50, start + 0.1);
  
  gain.gain.setValueAtTime(vel / 127 * 0.6, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
  
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + 0.35);
}

function drumKick808(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, start);
  osc.frequency.exponentialRampToValueAtTime(40, start + 0.15);
  
  gain.gain.setValueAtTime(vel / 127 * 0.7, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
  
  // Subtle distortion
  const ws = ctx.createWaveShaper();
  const curve = new Float32Array(64);
  for (let i = 0; i < 64; i++) { curve[i] = Math.tanh(((i*2)/64-1)*1.5); }
  ws.curve = curve;
  
  osc.connect(ws);
  ws.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + 0.55);
}

function drumKickTechno(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  // Click transient
  const click = ctx.createBufferSource();
  const clickBuf = ctx.createBuffer(1, ctx.sampleRate * 0.005, ctx.sampleRate);
  const clickData = clickBuf.getChannelData(0);
  for (let i = 0; i < clickData.length; i++) clickData[i] = (Math.random() * 2 - 1) * 0.8;
  click.buffer = clickBuf;
  const clickGain = ctx.createGain();
  clickGain.gain.value = vel / 127 * 0.3;
  click.connect(clickGain);
  clickGain.connect(dest);
  click.start(start);
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, start);
  osc.frequency.exponentialRampToValueAtTime(45, start + 0.05);
  
  gain.gain.setValueAtTime(vel / 127 * 0.55, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
  
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + 0.25);
}

function drumClap(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000;
  filter.Q.value = 1;
  
  // 3 micro-bursts for clap texture
  for (let burst = 0; burst < 3; burst++) {
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const burstGain = ctx.createGain();
    burstGain.gain.value = vel / 127 * 0.2;
    noise.connect(burstGain);
    burstGain.connect(filter);
    noise.start(start + burst * 0.015);
  }
  
  gain.gain.setValueAtTime(vel / 127 * 0.3, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
  
  filter.connect(gain);
  gain.connect(dest);
}

function drumSnare(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  // Body (sine)
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = 'sine';
  body.frequency.value = 200;
  bodyGain.gain.setValueAtTime(vel / 127 * 0.3, start);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, start + 0.05);
  body.connect(bodyGain);
  bodyGain.connect(dest);
  body.start(start);
  body.stop(start + 0.06);
  
  // Noise
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  const noiseGain = ctx.createGain();
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 3500;
  noiseGain.gain.setValueAtTime(vel / 127 * 0.25, start);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);
  noise.start(start);
}

function drumRim(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 400;
  gain.gain.setValueAtTime(vel / 127 * 0.25, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.03);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + 0.04);
  
  // High noise burst
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.01, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  const nf = ctx.createBiquadFilter();
  nf.type = 'highpass';
  nf.frequency.value = 5000;
  const ng = ctx.createGain();
  ng.gain.value = vel / 127 * 0.15;
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(dest);
  noise.start(start);
}

function drumClosedHat(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 8000;
  filter.Q.value = 2;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vel / 127 * 0.15, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.03);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  noise.start(start);
}

function drumOpenHat(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 7000;
  filter.Q.value = 1;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vel / 127 * 0.12, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  noise.start(start);
}

function drumShaker(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  for (let i = 0; i < 3; i++) {
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.015, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = Math.random() * 2 - 1;
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.value = vel / 127 * 0.08;
    noise.connect(filter);
    filter.connect(g);
    g.connect(dest);
    noise.start(start + i * 0.01);
  }
}

function drumConga(ctx: AudioContext, dest: AudioNode, start: number, vel: number, high: boolean) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(high ? 500 : 300, start);
  osc.frequency.exponentialRampToValueAtTime(high ? 250 : 150, start + 0.1);
  gain.gain.setValueAtTime(vel / 127 * 0.2, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + (high ? 0.06 : 0.1));
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + 0.15);
}

function drumCowbell(ctx: AudioContext, dest: AudioNode, start: number, vel: number) {
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 700;
  filter.Q.value = 5;
  
  for (const freq of [560, 845]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(filter);
    osc.start(start);
    osc.stop(start + 0.1);
  }
  
  gain.gain.setValueAtTime(vel / 127 * 0.12, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
  filter.connect(gain);
  gain.connect(dest);
}

// ============================================================
// GENRE → SOUND MAPPING (from music-engine.ts)
// ============================================================

export type SynthPresetName = 
  'fmbell' | 'detunedsaw' | 'marimba' | 'flute' | 'choir' | 'pizzicato' |
  'pluck' | 'pad' | 'acid' | 'bell' | 'supersaw' | 'sinelead' |
  'stringpad' | 'rhodes' | 'wurlitzer' | 'vibraphone' | 'brass' |
  'warmpad' | 'epiano' | 'organ' | 'glass' |
  'wobble' | 'fingerbass' | 'uprightbass' | 'slapbass' | 'tb303' | 'logdrum' |
  'sub' | 'reese' | 'acidbass' | '808' | 'pluckbass';

const MELODY_SYNTHS: Record<string, SynthFunction> = {
  fmbell: melodyFmBell,
  detunedsaw: melodyDetunedSaw,
  marimba: melodyMarimba,
  flute: melodyFlute,
  choir: melodyChoir,
  pizzicato: melodyPizzicato,
  pluck: melodyPluck,
  pad: melodyPad,
  acid: melodyAcid,
  bell: melodyBell,
  supersaw: melodySuperSaw,
  sinelead: melodySineLead,
};

const CHORD_SYNTHS: Record<string, SynthFunction> = {
  stringpad: chordStringPad,
  rhodes: chordRhodes,
  wurlitzer: chordWurlitzer,
  vibraphone: chordVibraphone,
  brass: chordBrassSection,
  warmpad: chordWarmPad,
  epiano: chordEPiano,
  organ: chordOrgan,
  glass: chordGlass,
};

const BASS_SYNTHS: Record<string, SynthFunction> = {
  wobble: bassWobble,
  fingerbass: bassFingered,
  uprightbass: bassUpright,
  slapbass: bassSlap,
  tb303: bassTb303,
  logdrum: bassLogDrum,
  sub: bassSubBass,
  reese: bassReese,
  acidbass: bassAcid,
  '808': bass808,
  pluckbass: bassPluckBass,
};

function pickFromGenre(genre: string): GenreSoundMap {
  return getGenreSoundMap(genre);
}

// ============================================================
// PLAYBACK
// ============================================================

let activeTimeouts: number[] = [];
let isPlaying = false;

export function stopAllPlayback() {
  activeTimeouts.forEach(id => clearTimeout(id));
  activeTimeouts = [];
  isPlaying = false;
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
    masterGain = null;
  }
}

export function getIsPlaying(): boolean {
  return isPlaying;
}

export interface PlaybackOptions {
  melody?: NoteEvent[];
  chords?: NoteEvent[];
  bass?: NoteEvent[];
  drums?: NoteEvent[];
  bpm: number;
  genre: string;
  reverbMix?: number;
  onComplete?: () => void;
}

export function playLayer(
  layer: 'melody' | 'chords' | 'bass' | 'drums',
  notes: NoteEvent[],
  bpm: number,
  genre: string,
  onComplete?: () => void
) {
  playNotes({
    [layer]: notes,
    bpm,
    genre,
    onComplete,
  });
}

export function playNotes(options: PlaybackOptions) {
  stopAllPlayback();
  isPlaying = true;
  
  const ctx = getAudioContext();
  const dest = masterGain!;
  const secPerBeat = 60 / options.bpm;
  const sounds = pickFromGenre(options.genre);
  
  // Pick random synth from genre options
  const melodySynth = MELODY_SYNTHS[sounds.melody[Math.floor(Math.random() * sounds.melody.length)]];
  const chordSynth = CHORD_SYNTHS[sounds.chords[Math.floor(Math.random() * sounds.chords.length)]];
  const bassSynth = BASS_SYNTHS[sounds.bass[Math.floor(Math.random() * sounds.bass.length)]];
  
  const kickFn =
    sounds.kick === 'deep' ? drumKickDeep :
    sounds.kick === 'punchy' ? drumKickPunchy :
    sounds.kick === 'distorted' ? drumKickDistorted :
    sounds.kick === '808' ? drumKick808 :
    sounds.kick === 'techno' ? drumKickTechno :
    drumKickHouse;

  const snareFn =
    sounds.snare === 'tight' ? drumSnareTight :
    sounds.snare === 'fat' ? drumSnareFat :
    sounds.snare === 'brush' ? drumSnareBrush :
    sounds.snare === 'clapreverb' ? drumClapReverb :
    sounds.snare === 'rim' ? drumRim :
    sounds.snare === 'snare' ? drumSnare :
    drumClap;
  
  let maxEndTime = 0;
  const currentTime = ctx.currentTime + 0.1;
  
  // Schedule melody
  if (options.melody) {
    for (const note of options.melody) {
      const start = currentTime + note.startTime * secPerBeat;
      const dur = note.duration * secPerBeat;
      melodySynth(ctx, dest, midiToFreq(note.pitch), start, dur, note.velocity);
      maxEndTime = Math.max(maxEndTime, start + dur);
    }
  }
  
  // Schedule chords
  if (options.chords) {
    for (const note of options.chords) {
      const start = currentTime + note.startTime * secPerBeat;
      const dur = note.duration * secPerBeat;
      chordSynth(ctx, dest, midiToFreq(note.pitch), start, dur, note.velocity);
      maxEndTime = Math.max(maxEndTime, start + dur);
    }
  }
  
  // Schedule bass
  if (options.bass) {
    for (const note of options.bass) {
      const start = currentTime + note.startTime * secPerBeat;
      const dur = note.duration * secPerBeat;
      bassSynth(ctx, dest, midiToFreq(note.pitch), start, dur, note.velocity);
      maxEndTime = Math.max(maxEndTime, start + dur);
    }
  }
  
  // Schedule drums
  if (options.drums) {
    for (const note of options.drums) {
      const start = currentTime + note.startTime * secPerBeat;
      const pitch = note.pitch;
      const vel = note.velocity;
      
      if (pitch === 36) kickFn(ctx, dest, start, vel);
      else if (pitch === 38) snareFn(ctx, dest, start, vel);
      else if (pitch === 39) drumClap(ctx, dest, start, vel);
      else if (pitch === 42) {
        const hat = sounds.hats[Math.floor(Math.random() * sounds.hats.length)] ?? 'closed';
        if (hat === 'pedal') drumPedalHat(ctx, dest, start, vel);
        else if (hat === 'sizzle') drumSizzleHat(ctx, dest, start, vel);
        else if (hat === 'tambourine') drumTambourine(ctx, dest, start, vel);
        else drumClosedHat(ctx, dest, start, vel);
      }
      else if (pitch === 46) drumOpenHat(ctx, dest, start, vel);
      else if (pitch === 51) drumClosedHat(ctx, dest, start, vel); // ride as hat
      else if (pitch === 37) drumRim(ctx, dest, start, vel);
      else if (pitch === 62) drumConga(ctx, dest, start, vel, true);
      else if (pitch === 63) {
        // Afro house request: bongo + conga
        if (options.genre === 'afro_house') drumBongo(ctx, dest, start, vel, false);
        else drumConga(ctx, dest, start, vel, false);
      }
      else if (pitch === 70) drumShaker(ctx, dest, start, vel);
      else drumClosedHat(ctx, dest, start, vel); // fallback
      
      maxEndTime = Math.max(maxEndTime, start + 0.3);
    }
  }
  
  // On complete callback
  if (options.onComplete) {
    const totalDuration = (maxEndTime - currentTime) * 1000 + 500;
    const id = window.setTimeout(() => {
      isPlaying = false;
      options.onComplete?.();
    }, totalDuration);
    activeTimeouts.push(id);
  }
}

// Export synth names for UI display
export function getSynthNames(genre: string): { melody: string; chords: string; bass: string; kick: string; snare: string } {
  const sounds = pickFromGenre(genre);
  return {
    melody: sounds.melody[Math.floor(Math.random() * sounds.melody.length)],
    chords: sounds.chords[Math.floor(Math.random() * sounds.chords.length)],
    bass: sounds.bass[Math.floor(Math.random() * sounds.bass.length)],
    kick: sounds.kick,
    snare: sounds.snare,
  };
}
