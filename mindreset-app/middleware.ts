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
// segment: /(.*)?/account(.*) matches both /account (default English)
// and /ru/account (locale-prefixed).

const intlMiddleware = createNextIntlMiddleware(routing);

const isProtectedRoute = createRouteMatcher([
  '/(.*)?/account(.*)',
  '/(.*)?/minimind(.*)',
  '/(.*)?/modules(.*)',
  '/(.*)?/journey(.*)',
]);

export default clerkMiddleware((auth, req) => {
  // API routes: no locale segment, no next-intl involvement.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Clerk auth gate first.
  if (isProtectedRoute(req)) {
    auth().protect();
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
