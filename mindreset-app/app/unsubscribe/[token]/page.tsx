import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';

// Public unsubscribe landing — no auth, no Clerk, no locale routing.
// User clicks the link in their email → token is verified server-side
// → marketingConsent flipped to false → confirmation rendered.
//
// Layout is intentionally minimal and self-contained (own <html>/<body>)
// because /unsubscribe sits outside [locale] and we don't want to drag
// the customer app's full provider stack onto a page that should load
// instantly with no JS dependencies.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Unsubscribed · MindReset.ai',
  robots: { index: false, follow: false },
};

async function applyUnsubscribe(token: string): Promise<'ok' | 'invalid'> {
  const verified = verifyUnsubscribeToken(token);
  if (!verified) return 'invalid';

  // updateMany is safe when the userId doesn't exist (deleted account).
  await prisma.user.updateMany({
    where: { id: verified.userId },
    data: {
      marketingConsent: false,
      marketingUnsubAt: new Date(),
    },
  });
  return 'ok';
}

export default async function UnsubscribePage({
  params,
}: {
  params: { token: string };
}) {
  const result = await applyUnsubscribe(params.token);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          background: '#FAF7F2',
          color: '#2A2723',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <main
          style={{
            maxWidth: '32rem',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#7F7565',
              marginBottom: 16,
            }}
          >
            MindReset.ai
          </div>
          {result === 'ok' ? (
            <>
              <h1
                style={{
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: '2rem',
                  fontWeight: 400,
                  lineHeight: 1.2,
                  marginBottom: 20,
                }}
              >
                You&rsquo;ve been unsubscribed.
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.65, color: '#544A3B' }}>
                You won&rsquo;t receive any more marketing emails from us.
                Account-related notifications (sign-up confirmations, billing
                receipts, security notices) will continue — those are required
                for the service.
              </p>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: '#7F7565',
                  marginTop: 24,
                }}
              >
                Changed your mind? You can opt in again anytime from your
                account page.
              </p>
            </>
          ) : (
            <>
              <h1
                style={{
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontSize: '2rem',
                  fontWeight: 400,
                  lineHeight: 1.2,
                  marginBottom: 20,
                }}
              >
                This link isn&rsquo;t valid.
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.65, color: '#544A3B' }}>
                It may have been copied incorrectly. If you&rsquo;re trying to
                unsubscribe and this keeps happening, email{' '}
                <a
                  href="mailto:support@mindreset.ai"
                  style={{ color: '#8B6F47' }}
                >
                  support@mindreset.ai
                </a>{' '}
                and we&rsquo;ll handle it manually.
              </p>
            </>
          )}
        </main>
      </body>
    </html>
  );
}
