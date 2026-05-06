'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import posthog from 'posthog-js';

type PlanType = 'free' | 'pro' | 'studio';

export function PostHogIdentify() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (user) {
      let cancelled = false;
      posthog.identify(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        name: user.fullName,
      });
      void (async () => {
        try {
          const res = await fetch('/api/usage', { cache: 'no-store' });
          if (!res.ok) return;
          const data = await res.json() as { plan_type?: PlanType };
          if (!cancelled && data.plan_type) {
            posthog.identify(user.id, { plan: data.plan_type });
          }
        } catch {
          // ignore analytics enrichment failures
        }
      })();
      return () => {
        cancelled = true;
      };
    } else {
      posthog.reset();
    }
  }, [user, isLoaded]);

  return null;
}
