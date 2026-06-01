import * as Sentry from '@sentry/nextjs';

// Sentry — SERVER runtime (Node.js / serverless functions).
//
// Captures errors thrown inside API routes, server actions, route
// handlers, and other server-side code. The webhook routes
// (Stripe, Clerk, future Resend Inbound) all run here.

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0,

  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? 'development',

  debug: false,
});
