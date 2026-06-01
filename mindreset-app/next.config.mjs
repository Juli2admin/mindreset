import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

