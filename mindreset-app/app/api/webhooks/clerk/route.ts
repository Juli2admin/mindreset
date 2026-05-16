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
  unsafe_metadata?: Record<string, unknown>;
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
      case 'user.created': {
        const data = event.data as ClerkUserData;
        const email = primaryEmail(data);
        if (!email) {
          console.error('[clerk-webhook] no email on user', { id: data.id, type: 'user.created' });
          return NextResponse.json({ ok: true, action: 'skipped:no-email' });
        }

        // Carry-forward fix — look up screening backfill data BEFORE
        // creating the User row so the upsert can include it atomically.
        // The screeningId in unsafe_metadata is user-controllable (Clerk
        // accepts any value the client passes), so we MUST validate it
        // against the DB before trusting it. Invalid → fields stay null
        // and MiniMind degrades gracefully (memory loader falls back to
        // "not given" and screeningResult: none).
        let backfill: {
          preferredName: string | null;
          screeningResult: string;
          screeningResultAt: Date;
        } | null = null;

        const claimedScreeningId =
          typeof data.unsafe_metadata?.screeningId === 'string'
            ? data.unsafe_metadata.screeningId
            : null;

        if (claimedScreeningId) {
          try {
            const screening = await prisma.screeningResponse.findUnique({
              where: { id: claimedScreeningId },
              select: {
                id: true,
                result: true,
                preferredName: true,
                createdAt: true,
              },
            });
            if (screening) {
              backfill = {
                preferredName: screening.preferredName,
                screeningResult: screening.result,
                screeningResultAt: screening.createdAt,
              };
              console.log('[clerk-webhook] backfilled from screening', {
                userId: data.id,
                screeningId: screening.id,
                hadPreferredName: !!screening.preferredName,
                screeningResult: screening.result,
              });
            } else {
              console.warn('[clerk-webhook] invalid screening id in metadata', {
                userId: data.id,
                claimedScreeningId,
              });
            }
          } catch (err) {
            console.error('[clerk-webhook] screening lookup failed', err);
            // Continue without backfill; graceful degradation.
          }
        } else {
          console.log('[clerk-webhook] no screening id in metadata', {
            userId: data.id,
          });
        }

        await prisma.user.upsert({
          where: { id: data.id },
          create: {
            id: data.id,
            email,
            locale: 'en',
            themePref: 'system',
            // Consent captured at sign-up via the explicit T&C + Privacy checkboxes
            // on /sign-up; by the time this webhook fires the user has ticked both.
            tcAcceptedAt: new Date(),
            privacyAcceptedAt: new Date(),
            preferredName: backfill?.preferredName ?? null,
            screeningResult: backfill?.screeningResult ?? null,
            screeningResultAt: backfill?.screeningResultAt ?? null,
          },
          // Idempotency: rare Clerk retries of user.created hit the update
          // branch. Only sync email here — preserving the first pass's
          // backfill (which would otherwise get clobbered to null on retry).
          update: { email },
        });
        return NextResponse.json({ ok: true, action: 'user.created' });
      }
      case 'user.updated': {
        // Backfill does NOT run on user.updated. Future preferredName edits
        // belong to the account-settings page, not this webhook. Only email
        // mirrors are kept in sync here.
        const data = event.data as ClerkUserData;
        const email = primaryEmail(data);
        if (!email) {
          console.error('[clerk-webhook] no email on user', { id: data.id, type: 'user.updated' });
          return NextResponse.json({ ok: true, action: 'skipped:no-email' });
        }
        await prisma.user.upsert({
          where: { id: data.id },
          create: {
            id: data.id,
            email,
            locale: 'en',
            themePref: 'system',
            tcAcceptedAt: new Date(),
            privacyAcceptedAt: new Date(),
          },
          update: { email },
        });
        return NextResponse.json({ ok: true, action: 'user.updated' });
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
