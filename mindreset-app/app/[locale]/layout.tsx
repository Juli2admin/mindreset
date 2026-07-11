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
import { SITE_URL, pageAlternates, isPlaceholderLocale } from '@/lib/seo/alternates';

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
// DEFAULT_DESCRIPTION is load-bearing in three places at once:
//   1. Meta description fallback for any page that doesn't set its
//      own (currently /screening, /terms, /privacy, sign-in/up).
//   2. OG and Twitter card description (the sitewide social-share
//      preview text).
//   3. Both Organization and WebSite JSON-LD descriptions (the entity
//      summary AI search engines quote when grounding brand identity).
//
// Phase B item 3 update: dropped "trauma-informed" (ASA-risk wording
// in self-help wellbeing positioning) and added the audience signal
// "women in midlife" plus the three-product generic summary. Kept the
// "not therapy, not a crisis service" legal/positioning lockup intact.
// Reads correctly as both meta description (148 chars, under the
// 155-limit) AND as a neutral entity description in JSON-LD — the
// pain-state copy "who feel stuck" lives on the landing page
// description only (pure marketing surface), not here.
const DEFAULT_DESCRIPTION =
  'A self-help wellbeing platform for women in midlife — daily reflection, focused modules, and a structured method. Not therapy, not a crisis service.';

// Locale-aware base metadata. Pages override `alternates` with their
// own locale-correct canonical via pageAlternates(path, params.locale);
// this layout-level metadata is the fallback for any page that doesn't
// declare its own metadata export.
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  // Placeholder locales serve byte-identical English content (per
  // i18n-tools/sync-placeholders.mjs) so we noindex every page under
  // /fr, /de, /es, /it, /pl, /pt until real translations ship. `follow`
  // stays true so link equity out of these pages still flows through
  // the site graph. Google Search Console (2026-07-03) was flagging
  // ~14 "Duplicate, Google chose different canonical" warnings that all
  // trace to this — Google saw /fr/pricing == /pricing content and
  // picked /pricing as the real canonical anyway. Pre-empting the
  // duplicate signal frees crawl budget for the pages we actually
  // want indexed.
  const placeholder = isPlaceholderLocale(params.locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: DEFAULT_TITLE,
      template: '%s · MindReset.ai',
    },
    description: DEFAULT_DESCRIPTION,
    applicationName: 'MindReset.ai',
    alternates: pageAlternates('/', params.locale),
    ...(placeholder && { robots: { index: false, follow: true } }),
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      title: 'MindReset',
      statusBarStyle: 'default',
    },
    // Search Console verification tokens. Each is env-gated — the meta
    // tag only renders when the token is present in env, so the surface
    // ships dark and goes live the moment the token is set in Vercel.
    //   Google: Search Console → Add property → "Other verification
    //   methods" → meta tag. Copy the `content` value into
    //   GOOGLE_SITE_VERIFICATION.
    //   Bing: Webmaster Tools → Add site → Verify ownership → HTML
    //   meta tag. Copy the `content` value into BING_SITE_VERIFICATION.
    //   (msvalidate.01 is Bing's tag name.) Bing also imports Google
    //   verification automatically if Google is already set, but pasting
    //   the explicit token short-circuits the import wait.
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      other: process.env.BING_SITE_VERIFICATION
        ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }
        : undefined,
    },
    icons: {
      icon: [
        { url: '/logo-light.png', media: '(prefers-color-scheme: light)' },
        { url: '/logo-dark.png', media: '(prefers-color-scheme: dark)' },
      ],
      apple: '/apple-touch-icon.png',
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
// themeColor drives the iOS Safari + Android status-bar tint and
// matches the brand accent (lib/brand/colors.ts day-palette accent).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2D7A85',
  // viewportFit: 'cover' opts the app in to iOS safe-area — without it
  // `env(safe-area-inset-bottom)` resolves to 0 on every device, and any
  // composer/banner padding using that env value renders identically to
  // no-safe-area code. Enables the composer safe-area fix in PR #258 to
  // actually take effect on iPhones with home-indicator bars.
  viewportFit: 'cover',
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
              so the markup is in the initial HTML response — Google +
              AI crawlers index it on first crawl, no need for JS
              execution.

              Phase B note: previously missing a description field on the
              WebSite entity. Added so AI search engines (Perplexity,
              Claude, ChatGPT browse) get a clean canonical sentence about
              what MindReset is when grounding entity identity. The
              Organization description stays on the layout DEFAULT_
              DESCRIPTION so it stays aligned with any future tweak to
              the default meta description. */}
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
                sameAs: [
                  'https://www.instagram.com/mindreset_journey',
                  'https://youtube.com/@method_to_reconnect',
                  'https://www.tiktok.com/@mindreset.ai0',
                ],
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
                description: DEFAULT_DESCRIPTION,
                inLanguage: routing.locales,
                publisher: {
                  '@type': 'Organization',
                  name: 'MindReset.ai',
                  url: SITE_URL,
                },
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
