// ============================================================
// PULP — Mix bus: gain staging, EQ, stereo width, shared reverb,
// master clip + compressor. Schedules via audio-engine.
// ============================================================

import {
  scheduleNotesToLayerBuses,
  stopAllPlayback as stopAudioEnginePlayback,
  type LayerDestinationBuses,
  type PlaybackOptions,
} from './audio-engine';

export type { PlaybackOptions } from './audio-engine';

let mixCtx: AudioContext | null = null;
const mixTimeouts: number[] = [];
let mixIsPlaying = false;

function createLongReverb(ctx: AudioContext): ConvolverNode {
  const conv = ctx.createConvolver();
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * 1.8);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.25));
    }
  }
  conv.buffer = impulse;
  return conv;
}

function buildMixGraph(ctx: AudioContext): LayerDestinationBuses {
  const layerSum = ctx.createGain();
  layerSum.gain.value = 1;

  // --- Melody in → stage → EQ → stereo width ---
  const melodyIn = ctx.createGain();
  melodyIn.gain.value = 1;

  const melodyStage = ctx.createGain();
  melodyStage.gain.value = 0.5;

  const melHP = ctx.createBiquadFilter();
  melHP.type = 'highpass';
  melHP.frequency.value = 180;
  melHP.Q.value = 0.7;

  const melPeak = ctx.createBiquadFilter();
  melPeak.type = 'peaking';
  melPeak.frequency.value = 3000;
  melPeak.Q.value = 1.5;
  melPeak.gain.value = 2;

  const haasDelay = ctx.createDelay(0.05);
  haasDelay.delayTime.value = 0.011;

  const melGainL = ctx.createGain();
  melGainL.gain.value = 1;
  const melGainR = ctx.createGain();
  melGainR.gain.value = 1;

  const melPanL = ctx.createStereoPanner();
  melPanL.pan.value = -0.4;
  const melPanR = ctx.createStereoPanner();
  melPanR.pan.value = 0.4;

  const melMerger = ctx.createChannelMerger(2);

  melodyIn.connect(melodyStage);
  melodyStage.connect(melHP);
  melHP.connect(melPeak);

  melPeak.connect(melGainL);
  melGainL.connect(melPanL);
  melPanL.connect(melMerger, 0, 0);

  melPeak.connect(haasDelay);
  haasDelay.connect(melGainR);
  melGainR.connect(melPanR);
  melPanR.connect(melMerger, 1, 1);

  const melDry = ctx.createGain();
  melDry.gain.value = 0.8;
  const melWetSend = ctx.createGain();
  melWetSend.gain.value = 1;

  melMerger.connect(melDry);
  melMerger.connect(melWetSend);

  // --- Chords in → stage → EQ ---
  const chordsIn = ctx.createGain();
  chordsIn.gain.value = 1;

  const chordsStage = ctx.createGain();
  chordsStage.gain.value = 0.35;

  const chHP = ctx.createBiquadFilter();
  chHP.type = 'highpass';
  chHP.frequency.value = 220;
  chHP.Q.value = 0.7;

  const chLP = ctx.createBiquadFilter();
  chLP.type = 'lowpass';
  chLP.frequency.value = 7000;
  chLP.Q.value = 0.8;

  const chDry = ctx.createGain();
  chDry.gain.value = 0.8;
  const chWetSend = ctx.createGain();
  chWetSend.gain.value = 1;

  chordsIn.connect(chordsStage);
  chordsStage.connect(chHP);
  chHP.connect(chLP);
  chLP.connect(chDry);
  chLP.connect(chWetSend);

  // --- Shared reverb (melody + chords only) ---
  const wetBus = ctx.createGain();
  wetBus.gain.value = 1;
  melWetSend.connect(wetBus);
  chWetSend.connect(wetBus);

  const preDelay = ctx.createDelay(0.05);
  preDelay.delayTime.value = 0.015;

  const convolver = createLongReverb(ctx);
  const wetReturn = ctx.createGain();
  wetReturn.gain.value = 0.2;

  wetBus.connect(preDelay);
  preDelay.connect(convolver);
  convolver.connect(wetReturn);
  wetReturn.connect(layerSum);

  melDry.connect(layerSum);
  chDry.connect(layerSum);

  // --- Bass ---
  const bassIn = ctx.createGain();
  bassIn.gain.value = 1;

  const bassStage = ctx.createGain();
  bassStage.gain.value = 0.63;

  const bassLP = ctx.createBiquadFilter();
  bassLP.type = 'lowpass';
  bassLP.frequency.value = 180;
  bassLP.Q.value = 0.8;

  const bassShelf = ctx.createBiquadFilter();
  bassShelf.type = 'lowshelf';
  bassShelf.frequency.value = 80;
  bassShelf.gain.value = 3;

  bassIn.connect(bassStage);
  bassStage.connect(bassLP);
  bassLP.connect(bassShelf);
  bassShelf.connect(layerSum);

  // --- Drums ---
  const drumsIn = ctx.createGain();
  drumsIn.gain.value = 1;

  const drumsStage = ctx.createGain();
  drumsStage.gain.value = 0.7;

  const drumsHP = ctx.createBiquadFilter();
  drumsHP.type = 'highpass';
  drumsHP.frequency.value = 60;
  drumsHP.Q.value = 0.7;

  drumsIn.connect(drumsStage);
  drumsStage.connect(drumsHP);
  drumsHP.connect(layerSum);

  // --- Master ---
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.22;

  const waveshaper = ctx.createWaveShaper();
  const samples = 256;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * 0.7);
  }
  waveshaper.curve = curve;
  waveshaper.oversample = '2x';

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 8;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;

  layerSum.connect(masterGain);
  masterGain.connect(waveshaper);
  waveshaper.connect(compressor);
  compressor.connect(ctx.destination);

  return {
    melody: melodyIn,
    chords: chordsIn,
    bass: bassIn,
    drums: drumsIn,
  };
}

export function stopAllPlayback() {
  mixTimeouts.forEach((id) => clearTimeout(id));
  mixTimeouts.length = 0;
  mixIsPlaying = false;
  if (mixCtx) {
    mixCtx.close();
    mixCtx = null;
  }
  stopAudioEnginePlayback();
}

export function getIsPlaying(): boolean {
  return mixIsPlaying;
}

/**
 * Drop-in replacement for playNotes: same options, routed through mix graph.
 */
export function playNotesWithMix(options: PlaybackOptions) {
  stopAllPlayback();
  mixIsPlaying = true;

  const ctx = new AudioContext();
  mixCtx = ctx;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const buses = buildMixGraph(ctx);
  const { maxEndTime, currentTime } = scheduleNotesToLayerBuses(ctx, buses, options);

  if (options.onComplete) {
    const totalDuration = (maxEndTime - currentTime) * 1000 + 500;
    const id = window.setTimeout(() => {
      mixIsPlaying = false;
      options.onComplete?.();
    }, totalDuration);
    mixTimeouts.push(id);
  }
}

function audioBufferToWav16(buffer: AudioBuffer, targetSampleRate = 44100): ArrayBuffer {
  // OfflineAudioContext will already render at the requested sample rate (we request 44.1kHz),
  // so we only support passthrough here.
  const sampleRate = buffer.sampleRate;
  if (sampleRate !== targetSampleRate) {
    throw new Error(`Unexpected sample rate ${sampleRate} (expected ${targetSampleRate})`);
  }

  const numChannels = Math.min(2, buffer.numberOfChannels);
  const numFrames = buffer.length;

  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  let o = 0;
  const writeU16 = (v: number) => { view.setUint16(o, v, true); o += 2; };
  const writeU32 = (v: number) => { view.setUint32(o, v, true); o += 4; };
  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o++, s.charCodeAt(i));
  };

  writeStr('RIFF');
  writeU32(36 + dataSize);
  writeStr('WAVE');

  writeStr('fmt ');
  writeU32(16);
  writeU16(1); // PCM
  writeU16(numChannels);
  writeU32(sampleRate);
  writeU32(byteRate);
  writeU16(blockAlign);
  writeU16(16); // bits

  writeStr('data');
  writeU32(dataSize);

  const chData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) chData.push(buffer.getChannelData(ch));

  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const x = Math.max(-1, Math.min(1, chData[ch]![i]!));
      const s = x < 0 ? Math.round(x * 0x8000) : Math.round(x * 0x7fff);
      view.setInt16(o, s, true);
      o += 2;
    }
  }

  return out;
}

export async function renderNotesWithMixToWav(options: PlaybackOptions): Promise<Blob> {
  const sr = 44100;
  const tailSec = 2.25; // reverb + release tail to match playback feel

  // Estimate duration by scheduling once with a throwaway context.
  // `scheduleNotesToLayerBuses` schedules relative to ctx.currentTime + 0.1.
  const probeCtx = new OfflineAudioContext(2, sr, sr);
  const probeCtxCompat = probeCtx as unknown as AudioContext;
  const probeBuses = buildMixGraph(probeCtxCompat);
  const probe = scheduleNotesToLayerBuses(probeCtxCompat, probeBuses, options);
  const mainSec = Math.max(0.1, probe.maxEndTime - probe.currentTime);
  const totalSec = mainSec + tailSec;

  const length = Math.max(1, Math.ceil(totalSec * sr));
  const ctx = new OfflineAudioContext(2, length, sr);
  const ctxCompat = ctx as unknown as AudioContext;
  const buses = buildMixGraph(ctxCompat);
  scheduleNotesToLayerBuses(ctxCompat, buses, options);

  const rendered = await ctx.startRendering();
  const wav = audioBufferToWav16(rendered, sr);
  return new Blob([wav], { type: 'audio/wav' });
}
