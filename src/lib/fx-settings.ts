export type LayerFXSettings = {
  reverb: number;  // 0–100
  delay:  number;  // 0–100
  filter: number;  // 200–20000 Hz
};

export type AllLayerFX = {
  melody: LayerFXSettings;
  chords: LayerFXSettings;
  bass:   LayerFXSettings;
  drums:  LayerFXSettings;
};

export const DEFAULT_FX: LayerFXSettings = { reverb: 20, delay: 0, filter: 20000 };

export const DEFAULT_ALL_FX: AllLayerFX = {
  melody: { ...DEFAULT_FX },
  chords: { ...DEFAULT_FX },
  bass:   { ...DEFAULT_FX },
  drums:  { ...DEFAULT_FX },
};
