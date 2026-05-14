import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/account(.*)',
  '/minimind(.*)',
  '/modules(.*)',
  '/journey(.*)',
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }
  // Expose the current pathname to server components via a request header.
  // Used by app/layout.tsx to skip the disclaimer modal on legal pages.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
