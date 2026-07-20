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
  environment:
    process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',

  debug: false,

  // Pre-launch audit fix H12 (2026-07-11). Sentry's default HTTP
  // integration captures the request body (`event.request.data`) when
  // an error is thrown inside a request handler. On MindReset that
  // body contains user message plaintext — deep clinical content for
  // Journey turns, safety-sensitive material for MiniMind chat. UK
  // GDPR Article 9 concern to ship encrypted-at-rest user content to
  // a third-party monitoring service via error breadcrumbs.
  //
  // Also strip cookies (may carry session tokens) and headers with
  // Authorization / Cookie values. Preserve the URL, method, and
  // status code — those are the operationally useful fields.
  beforeSend(event) {
    if (event.request) {
      // Drop message-body content entirely.
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

  // sendDefaultPii already defaults to false in @sentry/nextjs; setting
  // explicitly documents intent.
  sendDefaultPii: false,
});
