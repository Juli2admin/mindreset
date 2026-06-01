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
  data?: Record<string, unknown>;
};

function isP2002(err: unknown): boolean {
  return !!(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

// Defensive field extraction. The Resend Inbound payload shape varies
// (and we're not 100% sure which fields exist on this account). Walk a
// list of known field paths and return the first non-empty string.
function pickString(data: Record<string, unknown>, paths: string[]): string {
  for (const path of paths) {
    const parts = path.split('.');
    let cur: unknown = data;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === 'string' && cur.length > 0) return cur;
  }
  return '';
}

function extractFromEmail(data: Record<string, unknown>): { email: string; name: string | null } | null {
  // Try common shapes: from string, from object, nested email object
  const fromRaw =
    (data.from as unknown) ??
    (data.sender as unknown) ??
    (typeof data.email === 'object' && data.email !== null
      ? (data.email as Record<string, unknown>).from
      : undefined);

  if (!fromRaw) return null;

  if (typeof fromRaw === 'string') {
    const angleMatch = fromRaw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    if (angleMatch) {
      const name = angleMatch[1].trim().replace(/^["']|["']$/g, '');
      return { email: angleMatch[2].trim().toLowerCase(), name: name || null };
    }
    return { email: fromRaw.trim().toLowerCase(), name: null };
  }
  if (typeof fromRaw === 'object' && fromRaw !== null) {
    const o = fromRaw as Record<string, unknown>;
    const email = typeof o.email === 'string' ? o.email.toLowerCase() : null;
    const name = typeof o.name === 'string' ? o.name.trim() : null;
    if (email) return { email, name: name || null };
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

  // DIAGNOSTIC: log the top-level keys of the inbound payload so we can
  // confirm which field names Resend is using on this account. Cheap
  // (a few keys, ~50 chars total) and only fires on real inbound events.
  // Remove this log line once the field-name set has been confirmed.
  console.log('[email-inbound] payload keys:', {
    topLevelKeys: Object.keys(data),
    hasEmailNested:
      typeof data.email === 'object' && data.email !== null
        ? Object.keys(data.email as Record<string, unknown>)
        : null,
  });

  const fromParsed = extractFromEmail(data);
  if (!fromParsed) {
    console.warn('[email-inbound] missing from address', { eventId: svixId });
    return NextResponse.json({ received: true, error: 'no from' });
  }

  // Try multiple known field paths. Resend's shape varies between
  // SDK versions and beta endpoints; the first non-empty value wins.
  const subject = pickString(data, [
    'subject',
    'email.subject',
  ]).trim().slice(0, 998);

  const bodyText = pickString(data, [
    'text',
    'body_plain',
    'stripped_text',
    'body_text',
    'email.text',
    'email.body_plain',
    'email.body_text',
  ]);

  const bodyHtml =
    pickString(data, [
      'html',
      'body_html',
      'stripped_html',
      'email.html',
      'email.body_html',
    ]) || null;

  const resendInboundId = pickString(data, [
    'id',
    'email_id',
    'message_id',
    'email.id',
  ]) || svixId;

  const createdAtRaw = pickString(data, ['created_at', 'received_at', 'email.created_at']);
  const receivedAt = createdAtRaw ? new Date(createdAtRaw) : new Date();

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
