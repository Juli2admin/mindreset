import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bundle the Journey clinical specs into serverless function output so the
  // runtime can read them at module load. The .md files in docs/journey/ are
  // the canonical human-readable source of truth; lib/journey/prompts/*
  // reads them via fs.readFileSync. Without this hint, Next's file-trace
  // would not include the .md files in the function bundle.
  outputFileTracingIncludes: {
    '/api/journey/turn': ['./docs/journey/**/*.md', './docs/journey/runtime/**/*.md'],
    '/api/journey/start': ['./docs/journey/**/*.md', './docs/journey/runtime/**/*.md'],
  },
};

// Compose: next-intl wraps the base config, Sentry wraps that.
// Sentry must be outermost so it can intercept the webpack config
// next-intl produced.
const composedConfig = withNextIntl(nextConfig);

export default withSentryConfig(composedConfig, {
  // Source-map upload settings. These DO NOT activate at build time
  // unless SENTRY_AUTH_TOKEN is present — without the token,
  // withSentryConfig skips uploads gracefully. Add the token in Vercel
  // env vars later (Sentry → User Settings → Auth Tokens, scopes:
  // project:releases + org:read).
  org: 'mindreset-ai',
  project: 'javascript',

  // Quiet down build output (no Sentry chatter in Vercel logs).
  silent: !process.env.CI,

  // Upload source maps for client + serverless code paths so stack
  // traces in Sentry show real code, not minified gibberish.
  widenClientFileUpload: true,

  // Hide source maps from public access on the deployed site.
  hideSourceMaps: true,

  // Suppresses the Sentry SDK's verbose console output.
  disableLogger: true,

  // React component name annotation — Sentry breadcrumbs show
  // component names instead of '<anonymous>'.
  reactComponentAnnotation: { enabled: true },
});

