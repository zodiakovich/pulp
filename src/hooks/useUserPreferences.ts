'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  UserPreferences,
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferencesLocally,
} from '@/lib/user-preferences';

export function useUserPreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  const update = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      savePreferencesLocally(next);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).catch(() => {});
      }, 500);

      if (flashRef.current) clearTimeout(flashRef.current);
      setSaved(true);
      flashRef.current = setTimeout(() => setSaved(false), 1500);

      return next;
    });
  }, []);

  return { prefs, update, saved };
}
