import '../globals.css';
import { cookies } from 'next/headers';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/react';
import {
  enUS,
  ruRU,
  frFR,
  deDE,
  esES,
  itIT,
  plPL,
  ptBR,
} from '@clerk/localizations';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';
import { THEME_COOKIE_NAME, isValidTheme } from '@/lib/theme/cookie';
import { SITE_URL, pageAlternates } from '@/lib/seo/alternates';

// Clerk widget translation — maps our app locale codes to the localisation
// objects shipped by @clerk/localizations. Used on the SignIn / SignUp
// widgets and the Clerk-rendered UserButton menu. Without this, Clerk
// renders in English regardless of the user's UI locale.
//
// 'pt' is mapped to Brazilian Portuguese (ptBR) — @clerk/localizations
// does not ship a European Portuguese (ptPT) bundle at v3, and ptBR is
// the closer reading for any pt-speaking user than English fallback.
const CLERK_LOCALIZATIONS = {
  en: enUS,
  ru: ruRU,
  fr: frFR,
  de: deDE,
  es: esES,
  it: itIT,
  pl: plPL,
  pt: ptBR,
} as const;

// Phase i18n.1a — locale-scoped layout. Owns <html>/<body>/<head> so that
// `lang={locale}` can be set per request, plus the providers ClerkProvider
// and NextIntlClientProvider. Receives `params.locale` from next-intl
// middleware via the [locale] segment.
//
// The root app/layout.tsx is now a passthrough — Next.js permits this when
// every reachable route lives under a child layout that renders <html><body>.
//
// Disclaimer modal: lives in app/[locale]/minimind/page.tsx, NOT here. The
// modal acknowledges the not-therapy / not-medical stance and is only
// relevant on the chat surface. Mounting it in the root layout previously
// forced it on every page (landing, FAQ, /home, /pricing etc.), which was
// a conversion killer for prospects and required a denylist of pages to
// suppress it — a pattern that proved fragile (the x-pathname middleware
// signal didn't propagate reliably to server components). Moving the
// component into the /minimind subtree removes the URL-detection problem
// entirely: pages that don't render the component cannot show the modal.

// Default sitewide metadata. Per-page metadata exports merge on top of
// this (Next.js Metadata API spec — page values override layout values
// per field). metadataBase resolves any relative URL (OG images,
// canonical, etc.) to the production domain even when previewing on a
// Vercel-generated URL — keeps social-share previews stable across
// preview/prod.
const DEFAULT_TITLE = 'MindReset.ai — A way back to yourself';
const DEFAULT_DESCRIPTION =
  'A trauma-informed self-help platform. Not therapy, not a crisis service — a structured digital reflection tool for emotional clarity.';

// Locale-aware base metadata. Pages override `alternates` with their
// own locale-correct canonical via pageAlternates(path, params.locale);
// this layout-level metadata is the fallback for any page that doesn't
// declare its own metadata export.
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: DEFAULT_TITLE,
      template: '%s · MindReset.ai',
    },
    description: DEFAULT_DESCRIPTION,
    applicationName: 'MindReset.ai',
    alternates: pageAlternates('/', params.locale),
    icons: {
      icon: [
        { url: '/logo-light.png', media: '(prefers-color-scheme: light)' },
        { url: '/logo-dark.png', media: '(prefers-color-scheme: dark)' },
      ],
      apple: '/logo-light.png',
    },
    openGraph: {
      type: 'website',
      siteName: 'MindReset.ai',
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: SITE_URL,
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'MindReset.ai — A way back to yourself',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: ['/og-image.png'],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

// Without this, mobile browsers render every page at a fixed ~980px CSS
// width and shrink to fit, making text tiny and breaking all responsive
// Tailwind breakpoints. Required for the rest of this PR's mobile fixes.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;

  // Validate locale; unknown segment → 404.
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  // Tells next-intl this rendering pass is for a known locale (enables
  // getTranslations() etc. in child server components).
  setRequestLocale(locale);

  const messages = await getMessages();

  // Phase i18n.1a — locale-preserved Clerk redirects. Without these,
  // auth().protect() on /ru/home would redirect a signed-out user to
  // /sign-in (English) because Clerk's defaults come from
  // NEXT_PUBLIC_CLERK_SIGN_IN_URL env (an unprefixed path). next-intl
  // can only recover the locale on the follow-up request via the
  // mr_locale cookie, which a first-time direct-link visitor won't have.
  // getPathname respects localePrefix='as-needed': returns /sign-in for
  // 'en' and /ru/sign-in for 'ru'. Post-auth landing is /home — the
  // personal-space dashboard (formerly /account, which now redirects).
  const signInUrl = getPathname({ href: '/sign-in', locale });
  const signUpUrl = getPathname({ href: '/sign-up', locale });
  const afterAuthUrl = getPathname({ href: '/home', locale });

  // Read theme cookie at request time so the first server render matches
  // the user's stored preference exactly (no day → night flash on
  // navigation). If no cookie is present, default to 'day' and let the
  // ThemeProvider check OS preference on first client mount.
  const themeCookie = cookies().get(THEME_COOKIE_NAME)?.value;
  const initialTheme = isValidTheme(themeCookie) ? themeCookie : 'day';
  const cookieWasSet = themeCookie !== undefined;

  return (
    <ClerkProvider
      localization={CLERK_LOCALIZATIONS[locale as keyof typeof CLERK_LOCALIZATIONS] ?? enUS}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      signInFallbackRedirectUrl={afterAuthUrl}
      signUpFallbackRedirectUrl={afterAuthUrl}
    >
      <html lang={locale}>
        <head>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Geist:wght@400;500&display=swap"
            rel="stylesheet"
          />
          {/* JSON-LD: Organization + WebSite. Inline (not via next/script)
              so the markup is in the initial HTML response — Google
              indexes it on first crawl, no need for JS execution. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'MindReset.ai',
                url: SITE_URL,
                logo: `${SITE_URL}/logo-light.png`,
                description: DEFAULT_DESCRIPTION,
                sameAs: [],
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'MindReset.ai',
                url: SITE_URL,
                inLanguage: routing.locales,
              }),
            }}
          />
        </head>
        <body>
          <NextIntlClientProvider messages={messages}>
            <ThemeProvider initialTheme={initialTheme} cookieWasSet={cookieWasSet}>
              {children}
            </ThemeProvider>
          </NextIntlClientProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}

// Pre-render for each known locale at build time. Each individual page
// remains dynamic (uses cookies()/auth()) so build-time per-locale
// rendering is cheap.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
