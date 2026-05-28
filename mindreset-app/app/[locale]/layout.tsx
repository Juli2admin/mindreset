import '../globals.css';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClerkProvider } from '@clerk/nextjs';
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

export const metadata: Metadata = {
  title: 'MindReset.ai — A way back to yourself',
  description:
    'A trauma-informed self-help platform. Not therapy, not a crisis service — a structured digital reflection tool for emotional clarity.',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
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
        </head>
        <body>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
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
