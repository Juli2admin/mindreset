import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import createNextIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import { routing } from './i18n/routing';

// Phase i18n.1a — composition pattern (Clerk first, then next-intl):
//   1. API routes bypass next-intl entirely (no [locale] segment for APIs).
//   2. Clerk auth gate runs first so auth().protect() can redirect cleanly
//      before next-intl rewrites/redirects on locale.
//   3. next-intl middleware handles locale detection (URL > cookie >
//      defaultLocale), URL rewriting, prefix logic for /ru/, /fr/, etc.
//   4. x-pathname header passthrough preserved for the disclaimer-modal
//      gate (it reads the header to decide whether to show on /terms or
//      /privacy).
//
// Protected-route matcher patterns include an optional leading locale
// segment: /(.*)?/home(.*) matches both /home (default English) and
// /ru/home (locale-prefixed). /account is intentionally NOT protected —
// the page is a redirect to /home, and /home enforces auth from there.
// /pricing is intentionally public so prospects can browse plans before
// signing up; the Buy buttons in PricingClient detect anonymous state
// and route to /sign-up instead of calling the checkout API.

const intlMiddleware = createNextIntlMiddleware(routing);

const isProtectedRoute = createRouteMatcher([
  '/(.*)?/home(.*)',
  '/(.*)?/minimind(.*)',
  '/(.*)?/modules(.*)',
  '/(.*)?/journey(.*)',
]);

// Extract the locale segment from a pathname (e.g. /ru/home → 'ru').
// Used to make Clerk's auth().protect() redirect locale-aware: without
// this, a signed-out direct-link visitor to /ru/account would be
// redirected to /sign-in (English), losing the locale. The ClerkProvider
// signInUrl prop in the layout only affects client-side Clerk redirects;
// middleware-time protect() needs its target passed explicitly.
function localeFromPath(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  if (match && (routing.locales as readonly string[]).includes(match[1])) {
    return match[1];
  }
  return routing.defaultLocale;
}

export default clerkMiddleware((auth, req) => {
  // API routes: no locale segment, no next-intl involvement.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Clerk auth gate first.
  if (isProtectedRoute(req)) {
    const locale = localeFromPath(req.nextUrl.pathname);
    const signInPath =
      locale === routing.defaultLocale ? '/sign-in' : `/${locale}/sign-in`;
    auth().protect({
      unauthenticatedUrl: new URL(signInPath, req.url).toString(),
    });
  }

  // next-intl handles the rest (locale detection, URL rewriting).
  const response = intlMiddleware(req);

  // Preserve x-pathname for the disclaimer-modal gate in the layout.
  response.headers.set('x-pathname', req.nextUrl.pathname);
  return response;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
