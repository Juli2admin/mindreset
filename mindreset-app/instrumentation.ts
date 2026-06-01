// Next.js 13+ instrumentation hook. Runs once per server runtime.
// Loads the right Sentry config based on which runtime started:
// - 'nodejs' → API routes, server actions, route handlers
// - 'edge'   → middleware.ts and edge-runtime routes
//
// The client config is loaded automatically from sentry.client.config.ts
// by Next.js's Sentry plugin — no entry needed here for that.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Sentry SDK v8+ uses this hook to capture nested server-action errors
// that the App Router doesn't otherwise surface. captureRequestError is
// the exported function; aliased to Next.js's expected name.
import * as Sentry from '@sentry/nextjs';
export const onRequestError = Sentry.captureRequestError;
