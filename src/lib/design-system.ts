/**
 * Strict visual tokens (single source of truth for inline styles).
 * Prefer CSS variables from globals.css when possible.
 */
export const DS = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  border: 'var(--border)',
  borderWeak: 'var(--border-weak)',
  divider: 'var(--divider)',
  text: 'var(--text)',
  muted: 'var(--muted)',
  micro: 'var(--text-micro)',
  accent: '#FF6D3F',
  success: '#00B894',
  /** Canvas / inline — resolved from CSS per theme */
  layerMelody: 'var(--layer-viz-melody)',
  layerChords: 'var(--layer-viz-chords)',
  layerBass: 'var(--layer-viz-bass)',
  layerDrums: 'var(--layer-viz-drums)',
} as const;

export const LAYER_VIZ_COLORS: Record<string, string> = {
  melody: DS.layerMelody,
  chords: DS.layerChords,
  bass: DS.layerBass,
  drums: DS.layerDrums,
  imported: 'var(--layer-viz-imported)',
};

/** Canvas `fillStyle` does not resolve `var()`; read computed hex/rgba from the document root. */
export function readCssColor(property: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  return v || fallback;
}

export function getLayerVizColorsForCanvas(): Record<'melody' | 'chords' | 'bass' | 'drums', string> {
  return {
    melody: readCssColor('--layer-viz-melody', '#ff6d3f'),
    chords: readCssColor('--layer-viz-chords', '#ff6d3f'),
    bass: readCssColor('--layer-viz-bass', '#ff6d3f'),
    drums: readCssColor('--layer-viz-drums', '#ff6d3f'),
  };
}
