import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type ClerkEmailAddress = { id: string; email_address: string };

type ClerkUserData = {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ClerkEvent =
  | { type: 'user.created' | 'user.updated'; data: ClerkUserData }
  | { type: 'user.deleted'; data: { id: string; deleted: boolean } }
  | { type: string; data: unknown };

function primaryEmail(data: ClerkUserData): string | null {
  const id = data.primary_email_address_id;
  if (id) {
    const match = data.email_addresses.find((e) => e.id === id);
    if (match) return match.email_address;
  }
  return data.email_addresses[0]?.email_address ?? null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'missing svix headers' }, { status: 400 });
  }

  const body = await request.text();

  let event: ClerkEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent;
  } catch (err) {
    console.error('[clerk-webhook] signature verification failed', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const data = event.data as ClerkUserData;
        const email = primaryEmail(data);
        if (!email) {
          console.error('[clerk-webhook] no email on user', { id: data.id, type: event.type });
          return NextResponse.json({ ok: true, action: 'skipped:no-email' });
        }
        await prisma.user.upsert({
          where: { id: data.id },
          create: {
            id: data.id,
            email,
            locale: 'en',
            themePref: 'system',
            // tcAcceptedAt and privacyAcceptedAt deliberately left null —
            // consent must be captured explicitly via a separate UI step, not implied by signup.
          },
          update: { email },
        });
        return NextResponse.json({ ok: true, action: event.type });
      }
      case 'user.deleted': {
        const data = event.data as { id: string };
        try {
          await prisma.user.delete({ where: { id: data.id } });
          return NextResponse.json({ ok: true, action: 'deleted' });
        } catch (err) {
          const e = err as { code?: string };
          if (e.code === 'P2025') {
            return NextResponse.json({ ok: true, action: 'deleted:not-found' });
          }
          throw err;
        }
      }
      default:
        return NextResponse.json({ ok: true, action: 'ignored', type: event.type });
    }
  } catch (err) {
    console.error('[clerk-webhook] db operation failed', err);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }
}
