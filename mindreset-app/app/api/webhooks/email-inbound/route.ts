import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { categoriseSupport } from '@/lib/support/categorise';

export const dynamic = 'force-dynamic';

// POST /api/webhooks/email-inbound
//
// Resend Inbound webhook receiver. Resend forwards every email sent to
// any address @mindreset.ai (per the MX record we set up) here, signed
// via svix-style headers.
//
// We only care about `email.received` events. Resend sends every event
// the endpoint subscribed to — outbound delivery events (email.sent,
// email.delivered, etc.) hit this URL too because the owner ticked them
// all in the Resend webhook config. Those events are gracefully ignored
// with a `{ received: true, ignored: true }` response.
//
// Idempotency: Resend retries on non-2xx. The SupportEmail.resendInboundId
// column has a unique constraint; a retried delivery hits the P2002 path
// and we short-circuit with `{ received: true, deduped: true }`.
//
// Async pipeline: createSupportEmail runs synchronously (cheap DB write),
// but the AI categoriser is fired via waitUntil so the webhook response
// returns within milliseconds — keeps Resend retry pressure low.

type ResendInboundEvent = {
  type: string;
  data?: {
    // Resend Inbound payload — fields vary subtly between SDK versions
    // so we treat each as optional and parse defensively.
    id?: string;
    email_id?: string;
    from?: string | { email?: string; name?: string };
    to?: string[] | Array<{ email?: string; name?: string }>;
    subject?: string;
    text?: string;
    html?: string;
    created_at?: string;
  };
};

function isP2002(err: unknown): boolean {
  return !!(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

function extractFromEmail(from: ResendInboundEvent['data'] extends infer T
  ? T extends { from?: infer F }
    ? F
    : never
  : never): { email: string; name: string | null } | null {
  if (!from) return null;
  if (typeof from === 'string') {
    // Resend may give us "Name <email@x.com>" or just "email@x.com"
    const angleMatch = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    if (angleMatch) {
      const name = angleMatch[1].trim().replace(/^["']|["']$/g, '');
      return { email: angleMatch[2].trim().toLowerCase(), name: name || null };
    }
    return { email: from.trim().toLowerCase(), name: null };
  }
  if (typeof from === 'object' && from && 'email' in from && typeof from.email === 'string') {
    return {
      email: from.email.toLowerCase(),
      name: (from as { name?: string }).name?.trim() || null,
    };
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[email-inbound] RESEND_INBOUND_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'missing svix headers' }, { status: 400 });
  }

  const body = await request.text();

  let event: ResendInboundEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendInboundEvent;
  } catch (err) {
    console.error('[email-inbound] signature verification failed', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  // Ignore non-inbound events. Resend sends every subscribed event type
  // here; we only act on emails received TO the domain.
  if (event.type !== 'email.received') {
    return NextResponse.json({ received: true, ignored: true });
  }

  const data = event.data ?? {};
  const fromParsed = extractFromEmail(data.from);
  if (!fromParsed) {
    console.warn('[email-inbound] missing from address', { eventId: svixId });
    return NextResponse.json({ received: true, error: 'no from' });
  }

  const subject = (data.subject ?? '').toString().trim().slice(0, 998);
  const bodyText = (data.text ?? '').toString();
  const bodyHtml = data.html ? data.html.toString() : null;
  const resendInboundId = data.id ?? data.email_id ?? svixId;
  const receivedAt = data.created_at ? new Date(data.created_at) : new Date();

  let created;
  try {
    created = await prisma.supportEmail.create({
      data: {
        fromEmail: fromParsed.email,
        fromName: fromParsed.name,
        subject: subject || '(no subject)',
        bodyText,
        bodyHtml,
        resendInboundId,
        receivedAt,
      },
    });
  } catch (err) {
    if (isP2002(err)) {
      console.log('[email-inbound] duplicate inbound id — already processed', {
        resendInboundId,
      });
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error('[email-inbound] create failed', err);
    return NextResponse.json({ error: 'persistence failed' }, { status: 500 });
  }

  // Trigger the AI categoriser asynchronously — Resend's retry pressure
  // prefers fast 2xx responses. The categoriser updates the SupportEmail
  // row in-place when it completes (locale, category, urgency, draftReply,
  // status='drafted'). If it fails, the row stays at status='pending' and
  // the admin can hit "Run AI" on the detail page to retry manually.
  waitUntil(
    (async () => {
      try {
        const result = await categoriseSupport({
          subject: created.subject,
          bodyText: created.bodyText,
        });
        await prisma.supportEmail.update({
          where: { id: created.id },
          data: {
            locale: result.locale,
            category: result.category,
            urgency: result.urgency,
            draftReply: result.draftReply,
            draftLocale: result.draftLocale,
            status: 'drafted',
          },
        });
      } catch (err) {
        console.error('[email-inbound] AI categoriser failed', {
          supportEmailId: created.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    })(),
  );

  return NextResponse.json({ received: true, supportEmailId: created.id });
}
