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
});
