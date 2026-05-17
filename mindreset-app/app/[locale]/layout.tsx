import '../globals.css';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ClerkProvider } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import prisma from '@/lib/prisma';
import DisclaimerGate from '@/components/DisclaimerGate';
import { routing } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';

// Phase i18n.1a — locale-scoped layout. Owns <html>/<body>/<head> so that
// `lang={locale}` can be set per request, plus the providers that used to
// live in app/layout.tsx: ClerkProvider, NextIntlClientProvider, and the
// disclaimer-modal gate. Receives `params.locale` from next-intl middleware
// via the [locale] segment.
//
// The root app/layout.tsx is now a passthrough — Next.js permits this when
// every reachable route lives under a child layout that renders <html><body>.

export const metadata: Metadata = {
  title: 'MindReset.ai — A way back to yourself',
  description:
    'A trauma-informed self-help platform. Not therapy, not a crisis service — a structured digital reflection tool for emotional clarity.',
};

const DISCLAIMER_COOKIE_NAME = 'mr_disclaimer_acknowledged';

// Pages where the disclaimer modal must NOT block content. Legal documents
// should be openly readable without prerequisites.
const DISCLAIMER_EXCLUDED_PATHS = new Set(['/terms', '/privacy']);

function pathnameWithoutLocale(pathname: string, locale: string): string {
  // Strip the leading /<locale> if present so the excluded-paths check
  // works for both /terms and /ru/terms.
  const prefix = `/${locale}`;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}

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

  const pathname = headers().get('x-pathname') ?? '';
  const pathForCheck = pathnameWithoutLocale(pathname, locale);
  const isExcludedPath = DISCLAIMER_EXCLUDED_PATHS.has(pathForCheck);

  const hasCookie = cookies().get(DISCLAIMER_COOKIE_NAME)?.value === 'true';

  let acknowledgedInDB = false;
  if (!isExcludedPath && !hasCookie) {
    try {
      const user = await currentUser();
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { disclaimerAcknowledgedAt: true },
        });
        acknowledgedInDB = dbUser?.disclaimerAcknowledgedAt != null;
      }
    } catch (err) {
      // Fail-safe: on DB error, default to showing the modal.
      console.error('[layout] disclaimer status check failed:', err);
    }
  }

  const initialShow = !isExcludedPath && !hasCookie && !acknowledgedInDB;
  const needsCookieBackfill = !isExcludedPath && !hasCookie && acknowledgedInDB;

  const messages = await getMessages();

  // Phase i18n.1a — locale-preserved Clerk redirects. Without these,
  // auth().protect() on /ru/account would redirect a signed-out user to
  // /sign-in (English) because Clerk's defaults come from
  // NEXT_PUBLIC_CLERK_SIGN_IN_URL env (an unprefixed path). next-intl
  // can only recover the locale on the follow-up request via the
  // mr_locale cookie, which a first-time direct-link visitor won't have.
  // getPathname respects localePrefix='as-needed': returns /sign-in for
  // 'en' and /ru/sign-in for 'ru'.
  const signInUrl = getPathname({ href: '/sign-in', locale });
  const signUpUrl = getPathname({ href: '/sign-up', locale });
  const afterAuthUrl = getPathname({ href: '/account', locale });

  return (
    <ClerkProvider
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
            {!isExcludedPath && (
              <DisclaimerGate
                initialShow={initialShow}
                needsCookieBackfill={needsCookieBackfill}
              />
            )}
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
