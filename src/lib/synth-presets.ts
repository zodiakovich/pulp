import * as Tone from 'tone';

export type InstrumentCategory = 'melody' | 'chords' | 'bass';

export type LayeredInstrument = {
  /** Connect this to your FX chain / destination. */
  output: Tone.ToneAudioNode;
  /** Nodes to dispose when done. */
  nodes: Tone.ToneAudioNode[];
  /** Trigger a note. `note` is scientific pitch notation (e.g. C4). */
  trigger: (note: string, dur: number | string, time: number, velocity: number) => void;
};

function makeStereoLayeredPoly(
  SynthCtor: any,
  voiceA: any,
  voiceB: any,
  opts?: { panA?: number; panB?: number; detuneB?: number; gainA?: number; gainB?: number },
): LayeredInstrument {
  const out = new Tone.Gain(1);

  const a = new Tone.PolySynth(SynthCtor as any, {
    maxPolyphony: 10,
    ...voiceA,
  } as any);
  const b = new Tone.PolySynth(SynthCtor as any, {
    maxPolyphony: 10,
    ...voiceB,
  } as any);

  const panA = new Tone.Panner(opts?.panA ?? -0.15);
  const panB = new Tone.Panner(opts?.panB ?? 0.15);
  const gA = new Tone.Gain(opts?.gainA ?? 1);
  const gB = new Tone.Gain(opts?.gainB ?? 0.9);

  if (typeof opts?.detuneB === 'number') {
    try {
      // PolySynth forwards set to voices.
      (b as any).set({ detune: opts.detuneB });
    } catch {
      // ignore
    }
  }

  a.connect(gA);
  gA.connect(panA);
  panA.connect(out);

  b.connect(gB);
  gB.connect(panB);
  panB.connect(out);

  return {
    output: out,
    nodes: [out, a, b, panA, panB, gA, gB],
    trigger: (note, dur, time, velocity) => {
      a.triggerAttackRelease(note, dur as any, time, velocity);
      b.triggerAttackRelease(note, dur as any, time, velocity * 0.92);
    },
  };
}

function makeBassWithSub(main: LayeredInstrument, subLevel = 0.55): LayeredInstrument {
  const out = new Tone.Gain(1);
  const sub = new Tone.MonoSynth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0.8, release: 0.12 },
    filter: { type: 'lowpass', frequency: 160, rolloff: -24, Q: 0.5 },
    filterEnvelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05, baseFrequency: 80, octaves: 0.5 },
    volume: -8,
  });
  const subGain = new Tone.Gain(subLevel);

  main.output.connect(out);
  sub.connect(subGain);
  subGain.connect(out);

  return {
    output: out,
    nodes: [out, sub, subGain, ...main.nodes],
    trigger: (note, dur, time, velocity) => {
      main.trigger(note, dur, time, velocity);
      sub.triggerAttackRelease(note, dur as any, time, Math.min(1, velocity * 0.9));
    },
  };
}

export const melodyPresets: Array<() => LayeredInstrument> = [
  // 1) Airy FM lead (wide, soft transient)
  () =>
    makeStereoLayeredPoly(
      Tone.FMSynth,
      {
        harmonicity: 1.5,
        modulationIndex: 6,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.18, sustain: 0.55, release: 0.9 },
        modulationEnvelope: { attack: 0.01, decay: 0.22, sustain: 0.1, release: 0.4 },
        volume: -12,
      },
      {
        harmonicity: 1.48,
        modulationIndex: 7,
        oscillator: { type: 'triangle' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.012, decay: 0.2, sustain: 0.5, release: 1.05 },
        modulationEnvelope: { attack: 0.01, decay: 0.25, sustain: 0.1, release: 0.45 },
        volume: -13,
      },
      { detuneB: 7, panA: -0.22, panB: 0.22, gainB: 0.85 },
    ),

  // 2) Glassy AM pluck
  () =>
    makeStereoLayeredPoly(
      Tone.AMSynth,
      {
        harmonicity: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.16, sustain: 0.0, release: 0.35 },
        modulation: { type: 'triangle' },
        modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0.0, release: 0.25 },
        volume: -10,
      },
      {
        harmonicity: 2.01,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.002, decay: 0.18, sustain: 0.0, release: 0.4 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.001, decay: 0.14, sustain: 0.0, release: 0.28 },
        volume: -11,
      },
      { detuneB: -6, panA: -0.18, panB: 0.18, gainB: 0.8 },
    ),

  // 3) Warm FM reed
  () =>
    makeStereoLayeredPoly(
      Tone.FMSynth,
      {
        harmonicity: 1,
        modulationIndex: 10,
        oscillator: { type: 'sine' },
        modulation: { type: 'square' },
        envelope: { attack: 0.03, decay: 0.2, sustain: 0.65, release: 0.8 },
        modulationEnvelope: { attack: 0.01, decay: 0.25, sustain: 0.2, release: 0.35 },
        volume: -13,
      },
      {
        harmonicity: 0.5,
        modulationIndex: 8,
        oscillator: { type: 'triangle' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.032, decay: 0.22, sustain: 0.6, release: 0.9 },
        modulationEnvelope: { attack: 0.01, decay: 0.22, sustain: 0.15, release: 0.32 },
        volume: -14,
      },
      { detuneB: 5, panA: -0.16, panB: 0.16, gainB: 0.82 },
    ),

  // 4) Soft supersine (AM body + FM air)
  () => {
    const am = makeStereoLayeredPoly(
      Tone.AMSynth,
      {
        harmonicity: 1.0,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.012, decay: 0.16, sustain: 0.7, release: 0.95 },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.3 },
        volume: -14,
      },
      {
        harmonicity: 1.01,
        oscillator: { type: 'sine' },
        modulation: { type: 'triangle' },
        envelope: { attack: 0.014, decay: 0.18, sustain: 0.68, release: 1.0 },
        modulationEnvelope: { attack: 0.01, decay: 0.22, sustain: 0.2, release: 0.32 },
        volume: -15,
      },
      { detuneB: 8, panA: -0.22, panB: 0.22, gainB: 0.85 },
    );
    const air = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 4,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.16, sustain: 0.35, release: 0.75 },
      modulationEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.2 },
      volume: -22,
    } as any);
    air.connect(am.output as any);
    return {
      output: am.output,
      nodes: [...am.nodes, air],
      trigger: (note, dur, time, velocity) => {
        am.trigger(note, dur, time, velocity);
        air.triggerAttackRelease(note, dur as any, time, velocity * 0.6);
      },
    };
  },

  // 5) Detuned FM bell lead
  () =>
    makeStereoLayeredPoly(
      Tone.FMSynth,
      {
        harmonicity: 3,
        modulationIndex: 3,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.35, sustain: 0.0, release: 0.9 },
        modulationEnvelope: { attack: 0.001, decay: 0.22, sustain: 0.0, release: 0.35 },
        volume: -10,
      },
      {
        harmonicity: 2.99,
        modulationIndex: 3.4,
        oscillator: { type: 'triangle' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.38, sustain: 0.0, release: 1.0 },
        modulationEnvelope: { attack: 0.001, decay: 0.24, sustain: 0.0, release: 0.38 },
        volume: -11,
      },
      { detuneB: 12, panA: -0.2, panB: 0.2, gainB: 0.82 },
    ),

  // 6) Square-ish FM lead (edge)
  () =>
    makeStereoLayeredPoly(
      Tone.FMSynth,
      {
        harmonicity: 1,
        modulationIndex: 16,
        oscillator: { type: 'sine' },
        modulation: { type: 'square' },
        envelope: { attack: 0.006, decay: 0.12, sustain: 0.45, release: 0.55 },
        modulationEnvelope: { attack: 0.001, decay: 0.18, sustain: 0.15, release: 0.22 },
        volume: -12,
      },
      {
        harmonicity: 1,
        modulationIndex: 13,
        oscillator: { type: 'triangle' },
        modulation: { type: 'square' },
        envelope: { attack: 0.007, decay: 0.14, sustain: 0.42, release: 0.6 },
        modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0.12, release: 0.25 },
        volume: -13,
      },
      { detuneB: -9, panA: -0.18, panB: 0.18, gainB: 0.86 },
    ),
];

export const chordPresets: Array<() => LayeredInstrument> = [
  // 1) FM pad
  () =>
    makeStereoLayeredPoly(
      Tone.FMSynth,
      {
        harmonicity: 0.75,
        modulationIndex: 3,
        oscillator: { type: 'sine' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.12, decay: 0.45, sustain: 0.75, release: 2.4 },
        modulationEnvelope: { attack: 0.08, decay: 0.4, sustain: 0.2, release: 1.0 },
        volume: -18,
      },
      {
        harmonicity: 1.5,
        modulationIndex: 2.2,
        oscillator: { type: 'triangle' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.14, decay: 0.5, sustain: 0.72, release: 2.6 },
        modulationEnvelope: { attack: 0.1, decay: 0.45, sustain: 0.18, release: 1.1 },
        volume: -19,
      },
      { detuneB: 6, panA: -0.25, panB: 0.25, gainB: 0.9 },
    ),

  // 2) AM soft triangle pad
  () =>
    makeStereoLayeredPoly(
      Tone.AMSynth,
      {
        harmonicity: 0.5,
        oscillator: { type: 'triangle' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.18, decay: 0.6, sustain: 0.78, release: 2.8 },
        modulationEnvelope: { attack: 0.1, decay: 0.5, sustain: 0.2, release: 1.2 },
        volume: -19,
      },
      {
        harmonicity: 1,
        oscillator: { type: 'triangle' },
        modulation: { type: 'triangle' },
        envelope: { attack: 0.2, decay: 0.65, sustain: 0.75, release: 3.0 },
        modulationEnvelope: { attack: 0.1, decay: 0.55, sustain: 0.18, release: 1.3 },
        volume: -20,
      },
      { detuneB: -7, panA: -0.22, panB: 0.22, gainB: 0.92 },
    ),

  // 3) Lush FM (slow, wide)
  () =>
    makeStereoLayeredPoly(
      Tone.FMSynth,
      {
        harmonicity: 2,
        modulationIndex: 1.2,
        oscillator: { type: 'sine' },
        modulation: { type: 'triangle' },
        envelope: { attack: 0.22, decay: 0.5, sustain: 0.8, release: 3.2 },
        modulationEnvelope: { attack: 0.12, decay: 0.45, sustain: 0.15, release: 1.4 },
        volume: -20,
      },
      {
        harmonicity: 1,
        modulationIndex: 1.8,
        oscillator: { type: 'triangle' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.24, decay: 0.55, sustain: 0.78, release: 3.4 },
        modulationEnvelope: { attack: 0.12, decay: 0.5, sustain: 0.12, release: 1.5 },
        volume: -21,
      },
      { detuneB: 9, panA: -0.28, panB: 0.28, gainB: 0.9 },
    ),

  // 4) Soft keys (AM with a hint of FM air)
  () => {
    const pad = makeStereoLayeredPoly(
      Tone.AMSynth,
      {
        harmonicity: 1,
        oscillator: { type: 'triangle' },
        modulation: { type: 'sine' },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 1.8 },
        modulationEnvelope: { attack: 0.02, decay: 0.25, sustain: 0.15, release: 0.8 },
        volume: -17,
      },
      {
        harmonicity: 0.5,
        oscillator: { type: 'triangle' },
        modulation: { type: 'triangle' },
        envelope: { attack: 0.06, decay: 0.32, sustain: 0.58, release: 1.9 },
        modulationEnvelope: { attack: 0.02, decay: 0.26, sustain: 0.14, release: 0.85 },
        volume: -18,
      },
      { detuneB: 4, panA: -0.2, panB: 0.2, gainB: 0.92 },
    );
    const air = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.04, decay: 0.25, sustain: 0.35, release: 1.4 },
      modulationEnvelope: { attack: 0.03, decay: 0.22, sustain: 0.1, release: 0.5 },
      volume: -26,
    } as any);
    air.connect(pad.output as any);
    return {
      output: pad.output,
      nodes: [...pad.nodes, air],
      trigger: (note, dur, time, velocity) => {
        pad.trigger(note, dur, time, velocity);
        air.triggerAttackRelease(note, dur as any, time, velocity * 0.45);
      },
    };
  },
];

export const bassPresets: Array<() => LayeredInstrument> = [
  // 1) FM punch bass + sine sub
  () =>
    makeBassWithSub(
      makeStereoLayeredPoly(
        Tone.FMSynth,
        {
          harmonicity: 0.5,
          modulationIndex: 12,
          oscillator: { type: 'sine' },
          modulation: { type: 'square' },
          envelope: { attack: 0.005, decay: 0.12, sustain: 0.45, release: 0.2 },
          modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.0, release: 0.1 },
          volume: -10,
        },
        {
          harmonicity: 1,
          modulationIndex: 9,
          oscillator: { type: 'triangle' },
          modulation: { type: 'square' },
          envelope: { attack: 0.006, decay: 0.13, sustain: 0.4, release: 0.22 },
          modulationEnvelope: { attack: 0.001, decay: 0.11, sustain: 0.0, release: 0.11 },
          volume: -11,
        },
        { detuneB: 4, panA: -0.1, panB: 0.1, gainB: 0.9 },
      ),
      0.6,
    ),

  // 2) AM growl bass + sine sub
  () =>
    makeBassWithSub(
      makeStereoLayeredPoly(
        Tone.AMSynth,
        {
          harmonicity: 0.5,
          oscillator: { type: 'sawtooth' },
          modulation: { type: 'sine' },
          envelope: { attack: 0.003, decay: 0.12, sustain: 0.55, release: 0.18 },
          modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.2, release: 0.12 },
          volume: -12,
        },
        {
          harmonicity: 1,
          oscillator: { type: 'square' },
          modulation: { type: 'triangle' },
          envelope: { attack: 0.003, decay: 0.14, sustain: 0.5, release: 0.2 },
          modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0.2, release: 0.14 },
          volume: -13,
        },
        { detuneB: -5, panA: -0.1, panB: 0.1, gainB: 0.9 },
      ),
      0.65,
    ),

  // 3) Clean sub bass (mostly sine) + tiny FM edge
  () => {
    const edge = new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0.5, release: 0.12 },
      filter: { type: 'lowpass', frequency: 450, rolloff: -24, Q: 0.8 },
      filterEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.08, baseFrequency: 120, octaves: 1.0 },
      volume: -18,
    });
    const sub = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0.85, release: 0.14 },
      filter: { type: 'lowpass', frequency: 140, rolloff: -24, Q: 0.5 },
      filterEnvelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05, baseFrequency: 80, octaves: 0.6 },
      volume: -7,
    });
    const out = new Tone.Gain(1);
    edge.connect(out);
    sub.connect(out);
    return {
      output: out,
      nodes: [out, edge, sub],
      trigger: (note, dur, time, velocity) => {
        sub.triggerAttackRelease(note, dur as any, time, velocity);
        edge.triggerAttackRelease(note, dur as any, time, velocity * 0.45);
      },
    };
  },

  // 4) Reese-ish FM bass + sine sub
  () =>
    makeBassWithSub(
      makeStereoLayeredPoly(
        Tone.FMSynth,
        {
          harmonicity: 1,
          modulationIndex: 20,
          oscillator: { type: 'sine' },
          modulation: { type: 'sawtooth' },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.55, release: 0.25 },
          modulationEnvelope: { attack: 0.002, decay: 0.18, sustain: 0.2, release: 0.2 },
          volume: -14,
        },
        {
          harmonicity: 0.5,
          modulationIndex: 16,
          oscillator: { type: 'triangle' },
          modulation: { type: 'sawtooth' },
          envelope: { attack: 0.012, decay: 0.22, sustain: 0.5, release: 0.28 },
          modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0.2, release: 0.22 },
          volume: -15,
        },
        { detuneB: 10, panA: -0.1, panB: 0.1, gainB: 0.9 },
      ),
      0.62,
    ),

  // 5) 808 bass (pitch envelope sweep) + sine sub
  () => {
    const out = new Tone.Gain(1);
    const main = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0.6, release: 0.35 },
      filter: { type: 'lowpass', frequency: 900, rolloff: -24, Q: 0.7 },
      filterEnvelope: { attack: 0.001, decay: 0.12, sustain: 0.2, release: 0.12, baseFrequency: 80, octaves: 3 },
      volume: -8,
    });
    const sub = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0.9, release: 0.2 },
      filter: { type: 'lowpass', frequency: 140, rolloff: -24, Q: 0.5 },
      filterEnvelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05, baseFrequency: 80, octaves: 0.6 },
      volume: -6,
    });
    const drive = new Tone.Distortion({ distortion: 0.12, wet: 0.12 });

    main.connect(drive);
    drive.connect(out);
    sub.connect(out);

    return {
      output: out,
      nodes: [out, main, sub, drive],
      trigger: (note, dur, time, velocity) => {
        // Pitch envelope sweep via detune automation (in cents)
        (main.detune as any).cancelScheduledValues(time);
        (main.detune as any).setValueAtTime(1200, time);
        (main.detune as any).exponentialRampToValueAtTime(0.001, time + 0.06);

        main.triggerAttackRelease(note, dur as any, time, velocity);
        sub.triggerAttackRelease(note, dur as any, time, Math.min(1, velocity * 0.9));
      },
    };
  },
];

export function pickPresetIndex(seed: number, count: number): number {
  if (count <= 1) return 0;
  const s = Math.abs(Math.floor(seed));
  return s % count;
}

