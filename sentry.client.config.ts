import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  tracesSampleRate: 0.1,

  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 0.5,

  integrations: [
    Sentry.replayIntegration(),
  ],

  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    'ChunkLoadError',
  ],

  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',
});
