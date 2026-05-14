import './globals.css';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasCookie = cookies().get(COOKIE_NAME)?.value === 'true';

  let acknowledgedInDB = false;
  if (!hasCookie) {
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

  const initialShow = !hasCookie && !acknowledgedInDB;
  const needsCookieBackfill = !hasCookie && acknowledgedInDB;

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
          <DisclaimerGate
            initialShow={initialShow}
            needsCookieBackfill={needsCookieBackfill}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
