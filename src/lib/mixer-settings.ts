export type MixerLayerState = { volume: number; muted: boolean; soloed: boolean };
export type AllMixerState = {
  melody: MixerLayerState;
  chords: MixerLayerState;
  bass:   MixerLayerState;
  drums:  MixerLayerState;
};

export const DEFAULT_MIXER_LAYER: MixerLayerState = { volume: 75, muted: false, soloed: false };

export function makeDefaultMixer(): AllMixerState {
  return {
    melody: { ...DEFAULT_MIXER_LAYER },
    chords: { ...DEFAULT_MIXER_LAYER },
    bass:   { ...DEFAULT_MIXER_LAYER },
    drums:  { ...DEFAULT_MIXER_LAYER },
  };
}

export function computeEffectiveGain(layer: keyof AllMixerState, mixer: AllMixerState): number {
  const m = mixer[layer];
  if (m.muted) return 0;
  const anySoloed = (Object.values(mixer) as MixerLayerState[]).some(s => s.soloed);
  if (anySoloed && !m.soloed) return 0;
  return m.volume / 100;
}
