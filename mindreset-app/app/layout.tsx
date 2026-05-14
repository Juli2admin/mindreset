import './globals.css';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { ClerkProvider } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import DisclaimerGate from '@/components/DisclaimerGate';

export const metadata: Metadata = {
  title: 'MindReset.ai — A way back to yourself',
  description:
    'A trauma-informed self-help platform. Not therapy, not a crisis service — a structured digital reflection tool for emotional clarity.',
};

const COOKIE_NAME = 'mr_disclaimer_acknowledged';

// Pages where the disclaimer modal must NOT block content. Legal documents
// should be openly readable without prerequisites. Add to this list when
// adding more legal pages (e.g. /cookies, /accessibility).
const DISCLAIMER_EXCLUDED_PATHS = new Set(['/terms', '/privacy']);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = headers().get('x-pathname') ?? '';
  const isExcludedPath = DISCLAIMER_EXCLUDED_PATHS.has(pathname);

  const hasCookie = cookies().get(COOKIE_NAME)?.value === 'true';

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

  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Geist:wght@400;500&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          {children}
          {!isExcludedPath && (
            <DisclaimerGate
              initialShow={initialShow}
              needsCookieBackfill={needsCookieBackfill}
            />
          )}
        </body>
      </html>
    </ClerkProvider>
  );
}
