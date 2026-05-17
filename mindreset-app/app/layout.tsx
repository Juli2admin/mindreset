// Phase i18n.1a — root layout is a passthrough. The real layout (with
// <html>, <body>, ClerkProvider, NextIntlClientProvider, disclaimer gate,
// metadata, and globals.css) lives in app/[locale]/layout.tsx so that the
// `lang` attribute can be set from the URL segment.
//
// next-intl middleware ensures every non-API request is rewritten under
// [locale], so this passthrough is never the surface that renders <html>.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
