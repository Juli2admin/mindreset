import * as Sentry from '@sentry/nextjs';

// Sentry — CLIENT runtime (browser).
//
// Captures unhandled JavaScript errors, unhandled promise rejections,
// and React render errors on every page. Source maps are uploaded at
// build time via withSentryConfig so stack traces show real code, not
// minified gibberish — IF SENTRY_AUTH_TOKEN is set in Vercel; without
// it, traces still arrive but show minified frames.
//
// Performance monitoring (tracesSampleRate) is intentionally off for
// soft launch — keeps within free-tier quotas + reduces noise. Turn on
// later if user-perceived performance becomes a concern.
//
// Session Replay is also off for now — adds significant quota usage
// and needs more thought about PII redaction before it's safe to
// enable on a trauma-informed surface.

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance + replay disabled at launch.
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Show our build's release tag in Sentry's UI so we can correlate
  // errors with deploys. Vercel injects VERCEL_GIT_COMMIT_SHA at build.
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? 'development',

  // Drop noise that isn't ours — browser extensions and the SDK's
  // own internal warnings.
  ignoreErrors: [
    // Browser-extension noise (Chrome extensions injecting into pages)
    /chrome-extension:\/\//,
    // ResizeObserver loop warning — known browser noise, not a real bug
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
  ],

  beforeSend(event) {
    // Final filter: extension URLs anywhere in the stack
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
    if (frames.some((f) => f.filename?.includes('chrome-extension://'))) {
      return null;
    }
    return event;
  },

  debug: false,
});
