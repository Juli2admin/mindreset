import * as Sentry from '@sentry/nextjs';

// Sentry — EDGE runtime.
//
// Captures errors from code that runs at Vercel's edge (middleware.ts
// and any route configured with `runtime: 'edge'`). Currently the only
// edge-runtime code is middleware.ts (Clerk auth + next-intl), so this
// is mostly here for completeness.

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0,

  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? 'development',

  debug: false,

  // Pre-launch audit fix H12 (2026-07-11). Same PII-scrub posture as
  // server config — middleware sees URLs and headers, so cookie and
  // authorization scrubbing matters here too even though message body
  // isn't reachable in edge runtime.
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['Authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['Cookie'];
      }
    }
    return event;
  },
  sendDefaultPii: false,
});
