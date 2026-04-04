// ============================================================
// PULP — Web Audio Sound Engine
// 6 melody synths, 4 chord synths, 5 bass synths, 10+ drums
// Genre-aware sound selection
// ============================================================

import { NoteEvent } from './music-engine';

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
// GENRE → SOUND MAPPING
// ============================================================

export type SynthPresetName = 
  'pluck' | 'pad' | 'acid' | 'bell' | 'supersaw' | 'sinelead' |
  'warmpad' | 'epiano' | 'organ' | 'glass' |
  'sub' | 'reese' | 'acidbass' | '808' | 'pluckbass';

const MELODY_SYNTHS: Record<string, SynthFunction> = {
  pluck: melodyPluck, pad: melodyPad, acid: melodyAcid,
  bell: melodyBell, supersaw: melodySuperSaw, sinelead: melodySineLead,
};

const CHORD_SYNTHS: Record<string, SynthFunction> = {
  warmpad: chordWarmPad, epiano: chordEPiano,
  organ: chordOrgan, glass: chordGlass,
};

const BASS_SYNTHS: Record<string, SynthFunction> = {
  sub: bassSubBass, reese: bassReese, acidbass: bassAcid,
  '808': bass808, pluckbass: bassPluckBass,
};

interface GenreSoundMap {
  melody: string[];
  chords: string[];
  bass: string[];
  kick: 'house' | '808' | 'techno';
  snare: 'clap' | 'snare' | 'rim';
}

const GENRE_SOUNDS: Record<string, GenreSoundMap> = {
  deep_house:       { melody: ['bell', 'pluck'], chords: ['epiano'], bass: ['sub'], kick: 'house', snare: 'clap' },
  melodic_house:    { melody: ['pad', 'bell'], chords: ['warmpad'], bass: ['sub'], kick: 'house', snare: 'clap' },
  tech_house:       { melody: ['pluck', 'acid'], chords: ['epiano'], bass: ['pluckbass'], kick: 'techno', snare: 'rim' },
  minimal_tech:     { melody: ['pluck', 'sinelead'], chords: ['glass'], bass: ['pluckbass'], kick: 'techno', snare: 'rim' },
  techno:           { melody: ['acid', 'sinelead'], chords: ['glass'], bass: ['reese'], kick: 'techno', snare: 'clap' },
  melodic_techno:   { melody: ['pad', 'supersaw'], chords: ['warmpad'], bass: ['reese'], kick: 'techno', snare: 'snare' },
  hard_techno:      { melody: ['acid'], chords: ['glass'], bass: ['acidbass'], kick: 'techno', snare: 'rim' },
  progressive_house:{ melody: ['supersaw', 'pad'], chords: ['warmpad'], bass: ['sub'], kick: 'house', snare: 'clap' },
  afro_house:       { melody: ['bell', 'pluck'], chords: ['epiano'], bass: ['sub'], kick: 'house', snare: 'clap' },
  organic_house:    { melody: ['bell', 'sinelead'], chords: ['warmpad'], bass: ['sub'], kick: 'house', snare: 'clap' },
  trance:           { melody: ['supersaw'], chords: ['warmpad'], bass: ['sub'], kick: 'house', snare: 'clap' },
  uk_garage:        { melody: ['pluck', 'bell'], chords: ['epiano'], bass: ['sub'], kick: 'house', snare: 'snare' },
  drum_and_bass:    { melody: ['pad', 'supersaw'], chords: ['glass'], bass: ['reese'], kick: 'techno', snare: 'snare' },
  amapiano:         { melody: ['bell'], chords: ['epiano'], bass: ['sub'], kick: '808', snare: 'rim' },
  lofi_hiphop:      { melody: ['sinelead'], chords: ['epiano'], bass: ['sub'], kick: 'house', snare: 'snare' },
  hiphop:           { melody: ['bell', 'sinelead'], chords: ['epiano'], bass: ['808'], kick: '808', snare: 'snare' },
  trap:             { melody: ['sinelead', 'bell'], chords: ['warmpad'], bass: ['808'], kick: '808', snare: 'clap' },
  pop:              { melody: ['pluck', 'supersaw'], chords: ['warmpad'], bass: ['sub'], kick: 'house', snare: 'clap' },
  rnb:              { melody: ['sinelead', 'bell'], chords: ['epiano'], bass: ['sub'], kick: 'house', snare: 'snare' },
  disco_nu_disco:   { melody: ['pluck', 'bell'], chords: ['organ'], bass: ['sub'], kick: 'house', snare: 'clap' },
};

function pickFromGenre(genre: string): GenreSoundMap {
  return GENRE_SOUNDS[genre] || GENRE_SOUNDS.deep_house;
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
  
  const kickFn = sounds.kick === '808' ? drumKick808 : sounds.kick === 'techno' ? drumKickTechno : drumKickHouse;
  const snareFn = sounds.snare === 'rim' ? drumRim : sounds.snare === 'snare' ? drumSnare : drumClap;
  
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
      else if (pitch === 42) drumClosedHat(ctx, dest, start, vel);
      else if (pitch === 46) drumOpenHat(ctx, dest, start, vel);
      else if (pitch === 51) drumClosedHat(ctx, dest, start, vel); // ride as hat
      else if (pitch === 37) drumRim(ctx, dest, start, vel);
      else if (pitch === 62) drumConga(ctx, dest, start, vel, true);
      else if (pitch === 63) drumConga(ctx, dest, start, vel, false);
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
