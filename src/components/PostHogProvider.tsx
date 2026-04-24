'use client';

import posthog from 'posthog-js';
import { useEffect } from 'react';

export { posthog };

export function PostHogProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
      session_recording: {
        maskAllInputs: false,
      },
    });
  }, []);

  return null;
}
