export type UserPreferences = {
  defaultGenre: string;
  defaultBpm: number | null;
  defaultKey: string;
  defaultScale: string;
  defaultBars: number;
  masterVolume: number;
  metronome: boolean;
  autoPlay: boolean;
  exportFormat: 'midi' | 'wav';
  includeTempoTrack: boolean;
  filenamePattern: string;
  customPrefix: string;
};

export const PREFERENCES_KEY = 'pulp_user_preferences';

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultGenre: 'deep_house',
  defaultBpm: null,
  defaultKey: 'A',
  defaultScale: 'minor',
  defaultBars: 4,
  masterVolume: 80,
  metronome: false,
  autoPlay: false,
  exportFormat: 'midi',
  includeTempoTrack: true,
  filenamePattern: 'pulp-{genre}-{bpm}',
  customPrefix: '',
};

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(stored) as Partial<UserPreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferencesLocally(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}
